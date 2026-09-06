import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const GLYPHS: Record<string, number[]> = {
  "@": [14, 17, 23, 21, 23, 16, 15],
  "%": [25, 26, 4, 8, 22, 6, 0],
  "#": [10, 31, 10, 10, 31, 10, 0],
  "*": [0, 21, 14, 31, 14, 21, 0],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  "-": [0, 0, 0, 31, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

const RAMP = Object.keys(GLYPHS).reverse();
const CELL_WIDTH = 6;
const CELL_HEIGHT = 10;
const DEFAULT = new URL("../public/assets/background.mp4", import.meta.url).pathname;
const USAGE = `Usage: bun scripts/gif.mts [input] [options]

Options:
  -r, --resolution WIDTHxHEIGHT  ANSI character resolution
  -o, --output FILE              Output file
  -h, --help                     Show this help`;

type Media = { fps: string; frames: number; height: number; width: number };
type Resolution = { columns: number; rows: number };
type Options = { input: string; output?: string; resolution?: Resolution };
type Work = Resolution & {
  frames: number;
  id: number;
  output: SharedArrayBuffer;
  source: SharedArrayBuffer;
  workers: number;
};

export function parseResolution(value: string): Resolution {
  const match = /^(\d+)x(\d+)$/i.exec(value);
  const columns = Number(match?.[1]);
  const rows = Number(match?.[2]);
  if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows) || columns < 1 || rows < 1) {
    throw new Error(`Invalid resolution: ${value}. Expected WIDTHxHEIGHT.`);
  }
  return { columns, rows };
}

function parseArgs(args: string[]): Options | undefined {
  let input: string | undefined;
  let output: string | undefined;
  let resolution: Resolution | undefined;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "-h" || argument === "--help") {
      console.log(USAGE);
      return;
    }
    if (argument === "-r" || argument === "--resolution") {
      const value = args[++index];
      if (!value) {
        throw new Error(`${argument} requires WIDTHxHEIGHT`);
      }
      resolution = parseResolution(value);
      continue;
    }
    if (argument === "-o" || argument === "--output") {
      output = args[++index];
      if (!output) {
        throw new Error(`${argument} requires a file`);
      }
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}\n\n${USAGE}`);
    }
    if (input) {
      throw new Error(`Unexpected argument: ${argument}\n\n${USAGE}`);
    }
    input = argument;
  }

  return { input: resolve(input ?? DEFAULT), output, resolution };
}

async function probe(input: string): Promise<Media> {
  const process = Bun.spawn(
    [
      "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
      "-show_entries", "stream=width,height,avg_frame_rate,nb_read_frames", "-of", "json", input,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [text, error, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code) {
    throw new Error(error.trim() || "Could not read input");
  }

  const stream = JSON.parse(text).streams?.[0];
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  const frames = Number(stream?.nb_read_frames);
  const fps = stream?.avg_frame_rate;
  if (!width || !height || !frames || !fps) {
    throw new Error("Input has no readable image or video");
  }
  return { width, height, frames, fps };
}

function defaultResolution(media: Media): Resolution {
  return {
    columns: Math.ceil(media.width / CELL_WIDTH),
    rows: Math.ceil(media.height / CELL_HEIGHT),
  };
}

async function decode(input: string, media: Media, resolution: Resolution): Promise<SharedArrayBuffer> {
  const frameSize = resolution.columns * resolution.rows * 3;
  const buffer = new SharedArrayBuffer(frameSize * media.frames);
  const pixels = new Uint8Array(buffer);
  const process = Bun.spawn(
    [
      "ffmpeg", "-v", "error", "-i", input, "-map", "0:v:0", "-fps_mode", "passthrough",
      "-vf", `scale=${resolution.columns}:${resolution.rows}:flags=area`,
      "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const error = new Response(process.stderr).text();
  let offset = 0;

  for await (const chunk of process.stdout) {
    if (offset + chunk.length > pixels.length) {
      throw new Error("Input has more frames than ffprobe reported");
    }
    pixels.set(chunk, offset);
    offset += chunk.length;
  }

  if ((await process.exited) || offset !== pixels.length) {
    throw new Error((await error).trim() || "Input decode failed");
  }
  return buffer;
}

function glyphIndex(red: number, green: number, blue: number): number {
  const light = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return Math.round((light / 255) * (RAMP.length - 1));
}

export function ansiText(source: SharedArrayBuffer, resolution: Resolution): string {
  const pixels = new Uint8Array(source);
  const lines: string[] = [];

  for (let row = 0; row < resolution.rows; row++) {
    let line = "";
    for (let column = 0; column < resolution.columns; column++) {
      const pixel = (row * resolution.columns + column) * 3;
      const red = pixels[pixel]!;
      const green = pixels[pixel + 1]!;
      const blue = pixels[pixel + 2]!;
      line += `\x1b[38;2;${red};${green};${blue}m${RAMP[glyphIndex(red, green, blue)]}`;
    }
    lines.push(`${line}\x1b[0m`);
  }
  return `${lines.join("\n")}\n`;
}

function render({ columns, frames, id, output, rows, source, workers }: Work): number {
  const started = performance.now();
  const input = new Uint8Array(source);
  const rendered = new Uint8Array(output);
  const sourceFrameSize = columns * rows * 3;
  const width = columns * CELL_WIDTH;
  const height = rows * CELL_HEIGHT;
  const outputFrameSize = width * height * 3;

  for (let frame = id; frame < frames; frame += workers) {
    const sourceOffset = frame * sourceFrameSize;
    const outputOffset = frame * outputFrameSize;
    for (let y = 0; y < height; y++) {
      const cellRow = Math.floor(y / CELL_HEIGHT) * columns;
      const glyphY = y % CELL_HEIGHT - 1;
      for (let x = 0; x < width; x++) {
        const cell = cellRow + Math.floor(x / CELL_WIDTH);
        const color = sourceOffset + cell * 3;
        const glyph = RAMP[glyphIndex(input[color]!, input[color + 1]!, input[color + 2]!)]!;
        const bits = GLYPHS[glyph]![glyphY] ?? 0;
        const ink = x % CELL_WIDTH < 5 && bits & (1 << (4 - (x % CELL_WIDTH)));
        const pixel = outputOffset + (y * width + x) * 3;
        rendered[pixel] = ink ? input[color]! : 0;
        rendered[pixel + 1] = ink ? input[color + 1]! : 0;
        rendered[pixel + 2] = ink ? input[color + 2]! : 0;
      }
    }
  }

  return performance.now() - started;
}

async function renderAll(source: SharedArrayBuffer, media: Media, resolution: Resolution): Promise<{ buffer: SharedArrayBuffer; cpu: number }> {
  const width = resolution.columns * CELL_WIDTH;
  const height = resolution.rows * CELL_HEIGHT;
  const buffer = new SharedArrayBuffer(width * height * 3 * media.frames);
  const workers = Math.min(media.frames, Math.max(1, navigator.hardwareConcurrency - 1));
  const jobs = Array.from({ length: workers }, (_, id) => new Promise<number>((done, fail) => {
    const worker = new Worker(import.meta.url, { type: "module" });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      done(data);
    };
    worker.onerror = ({ error }) => {
      worker.terminate();
      fail(error);
    };
    worker.postMessage({ ...resolution, frames: media.frames, id, output: buffer, source, workers });
  }));
  return { buffer, cpu: (await Promise.all(jobs)).reduce((total, time) => total + time, 0) };
}

async function encodeGif(output: string, buffer: SharedArrayBuffer, media: Media, resolution: Resolution): Promise<void> {
  const width = resolution.columns * CELL_WIDTH;
  const height = resolution.rows * CELL_HEIGHT;
  const process = Bun.spawn(
    [
      "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pixel_format", "rgb24",
      "-video_size", `${width}x${height}`, "-framerate", media.fps, "-i", "pipe:0",
      "-filter_complex", "split[a][b];[a]palettegen=stats_mode=single[p];[b][p]paletteuse=new=1",
      "-loop", "0", output,
    ],
    { stdin: "pipe", stderr: "pipe" },
  );
  const error = new Response(process.stderr).text();
  process.stdin.write(new Uint8Array(buffer));
  process.stdin.end();
  if (await process.exited) {
    throw new Error((await error).trim() || "GIF encode failed");
  }
}

export function outputPath(input: string, requested: string | undefined, animated: boolean): string {
  if (requested) {
    return resolve(requested);
  }
  const extension = extname(input);
  const base = extension ? input.slice(0, -extension.length) : input;
  if (!animated) {
    return `${base}.txt`;
  }
  return extension.toLowerCase() === ".gif" ? `${base}-ansi.gif` : `${base}.gif`;
}

async function assertDistinctFiles(input: string, output: string): Promise<void> {
  if (input === output) {
    throw new Error("Output must be different from input");
  }
  const [inputStat, outputStat] = await Promise.all([
    stat(input),
    stat(output).catch(() => undefined),
  ]);
  if (outputStat && inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) {
    throw new Error("Output must be different from input");
  }
}

async function main(): Promise<void> {
  const options = parseArgs(Bun.argv.slice(2));
  if (!options) {
    return;
  }
  if (!(await Bun.file(options.input).exists())) {
    throw new Error(`File not found: ${options.input}`);
  }

  const started = performance.now();
  const media = await probe(options.input);
  const probed = performance.now();
  const resolution = options.resolution ?? defaultResolution(media);
  const output = outputPath(options.input, options.output, media.frames > 1);
  await assertDistinctFiles(options.input, output);
  const source = await decode(options.input, media, resolution);
  const decoded = performance.now();

  if (media.frames === 1) {
    await Bun.write(output, ansiText(source, resolution));
    const finished = performance.now();
    console.log(`${resolution.columns}x${resolution.rows} characters`);
    console.log(`probe ${(probed - started).toFixed(0)}ms | decode ${(decoded - probed).toFixed(0)}ms | text ${(finished - decoded).toFixed(0)}ms`);
  } else {
    const { buffer, cpu } = await renderAll(source, media, resolution);
    const rendered = performance.now();
    await encodeGif(output, buffer, media, resolution);
    const finished = performance.now();
    console.log(`${media.frames} frames, ${resolution.columns}x${resolution.rows} characters @ ${media.fps}`);
    console.log(`probe ${(probed - started).toFixed(0)}ms | decode ${(decoded - probed).toFixed(0)}ms | render ${(rendered - decoded).toFixed(0)}ms (${cpu.toFixed(0)}ms CPU) | gif ${(finished - rendered).toFixed(0)}ms`);
  }
  console.log(output);
}

if (Bun.isMainThread) {
  if (import.meta.main) {
    main().catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
} else {
  self.onmessage = ({ data }) => self.postMessage(render(data));
}
