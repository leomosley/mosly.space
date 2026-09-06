import { extname, resolve } from "node:path";

const glyphs: Record<string, number[]> = {
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

const DEFAULT = new URL("../public/assets/background.mp4", import.meta.url).pathname;

type Video = { fps: string; frames: number; height: number; width: number };
type Work = Video & { buffer: SharedArrayBuffer; id: number; workers: number };

async function probe(input: string): Promise<Video> {
  const process = Bun.spawn(
    [
      "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
      "-show_entries", "stream=width,height,avg_frame_rate,nb_read_frames", "-of", "csv=p=0", input,
    ],
    { stdout: "pipe" },
  );
  const [line, code] = await Promise.all([new Response(process.stdout).text(), process.exited]);
  if (code) {
    throw new Error("Could not read video");
  }

  const [width, height, fps, frames] = line.trim().split(",");
  if (!width || !height || !fps || !frames) {
    throw new Error("Input has no video");
  }
  return { width: +width, height: +height, fps, frames: +frames };
}

async function decode(input: string, video: Video): Promise<SharedArrayBuffer> {
  const buffer = new SharedArrayBuffer(video.width * video.height * 3 * video.frames);
  const pixels = new Uint8Array(buffer);
  const process = Bun.spawn(
    ["ffmpeg", "-v", "error", "-i", input, "-map", "0:v:0", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const error = new Response(process.stderr).text();
  let offset = 0;

  for await (const chunk of process.stdout) {
    if (offset + chunk.length > pixels.length) {
      throw new Error("Video has more frames than ffprobe reported");
    }
    pixels.set(chunk, offset);
    offset += chunk.length;
  }

  if ((await process.exited) || offset !== pixels.length) {
    throw new Error((await error).trim() || "Video decode failed");
  }
  return buffer;
}

function render({ buffer, fps, frames, height, id, width, workers }: Work): number {
  const started = performance.now();
  const frameSize = width * height * 3;
  const columns = Math.ceil(width / 6);
  const cells = columns * Math.ceil(height / 10);
  const red = new Uint32Array(cells);
  const green = new Uint32Array(cells);
  const blue = new Uint32Array(cells);
  const count = new Uint16Array(cells);
  const color = new Uint8Array(cells * 3);
  const character = new Uint8Array(cells);
  const ramp = Object.keys(glyphs);

  for (let frameNumber = id; frameNumber < frames; frameNumber += workers) {
    const frame = new Uint8Array(buffer, frameNumber * frameSize, frameSize);
    red.fill(0);
    green.fill(0);
    blue.fill(0);
    count.fill(0);

    for (let pixel = 0, y = 0; y < height; y++) {
      const row = Math.floor(y / 10) * columns;
      for (let x = 0; x < width; x++, pixel += 3) {
        const cell = row + Math.floor(x / 6);
        red[cell] += frame[pixel]!;
        green[cell] += frame[pixel + 1]!;
        blue[cell] += frame[pixel + 2]!;
        count[cell]++;
      }
    }

    for (let cell = 0; cell < cells; cell++) {
      const pixel = cell * 3;
      color[pixel] = red[cell]! / count[cell]!;
      color[pixel + 1] = green[cell]! / count[cell]!;
      color[pixel + 2] = blue[cell]! / count[cell]!;
      const light = 0.2126 * color[pixel]! + 0.7152 * color[pixel + 1]! + 0.0722 * color[pixel + 2]!;
      character[cell] = Math.round((light / 255) * (ramp.length - 1));
    }

    for (let pixel = 0, y = 0; y < height; y++) {
      const row = Math.floor(y / 10) * columns;
      const glyphY = y % 10 - 1;
      for (let x = 0; x < width; x++, pixel += 3) {
        const cell = row + Math.floor(x / 6);
        const bits = glyphs[ramp[character[cell]!]!]![glyphY] ?? 0;
        const ink = x % 6 < 5 && bits & (1 << (4 - (x % 6)));
        const source = cell * 3;
        frame[pixel] = ink ? color[source]! : 0;
        frame[pixel + 1] = ink ? color[source + 1]! : 0;
        frame[pixel + 2] = ink ? color[source + 2]! : 0;
      }
    }
  }

  return performance.now() - started;
}

async function renderAll(buffer: SharedArrayBuffer, video: Video): Promise<number> {
  const count = Math.min(video.frames, Math.max(1, navigator.hardwareConcurrency - 1));
  const jobs = Array.from({ length: count }, (_, id) => new Promise<number>((done, fail) => {
    const worker = new Worker(import.meta.url, { type: "module" });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      done(data);
    };
    worker.onerror = ({ error }) => fail(error);
    worker.postMessage({ ...video, buffer, id, workers: count });
  }));
  return (await Promise.all(jobs)).reduce((total, time) => total + time, 0);
}

async function encode(output: string, buffer: SharedArrayBuffer, video: Video): Promise<void> {
  const process = Bun.spawn(
    [
      "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pixel_format", "rgb24",
      "-video_size", `${video.width}x${video.height}`, "-framerate", video.fps, "-i", "pipe:0",
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

async function main(): Promise<void> {
  const file = Bun.argv[2] ?? DEFAULT;

  if (Bun.argv.length > 3) {
    throw new Error("Usage: bun scripts/gif.mts [video]");
  }

  const input = resolve(file);
  const output = input.slice(0, -extname(input).length) + ".gif";
  if (!(await Bun.file(input).exists())) {
    throw new Error(`File not found: ${input}`);
  }

  const started = performance.now();
  const video = await probe(input);
  const probed = performance.now();
  const buffer = await decode(input, video);
  const decoded = performance.now();
  const cpu = await renderAll(buffer, video);
  const rendered = performance.now();
  await encode(output, buffer, video);
  const finished = performance.now();

  console.log(`${video.frames} frames, ${video.width}x${video.height} @ ${video.fps}`);
  console.log(`probe ${(probed - started).toFixed(0)}ms | decode ${(decoded - probed).toFixed(0)}ms | render ${(rendered - decoded).toFixed(0)}ms (${cpu.toFixed(0)}ms CPU) | gif ${(finished - rendered).toFixed(0)}ms`);
  console.log(output);
}

if (Bun.isMainThread) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else {
  self.onmessage = ({ data }) => self.postMessage(render(data));
}
