import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import {
  DEFAULT_HEIGHT,
  imageHeight,
  LOGO_POSITIONS,
} from "../public/opengraph.js";

const ROOT = new URL("../public/", import.meta.url).pathname;
const WIDTH = 1200;

async function command(args: string[]): Promise<string> {
  const process = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code) throw new Error(`${args[0]} failed: ${stderr.trim()}`);
  return stdout;
}

export function loopDuration(backgroundMs: number, logoMs: number): number {
  // End on a background loop boundary after every logo frame has played.
  // The source loops are 1630ms and 3240ms. Their exact joint loop would
  // take 528 seconds, too large for a social image. Two background loops
  // give us 3260ms, with only a 20ms phase reset for the logo at the seam.
  return Math.ceil(logoMs / backgroundMs) * backgroundMs;
}

export function previewServer() {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const path = resolve(
        ROOT,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (!path.startsWith(ROOT.replace(/\/$/, "") + sep)) {
        return new Response("Forbidden", { status: 403 });
      }
      const file = Bun.file(path);
      return (await file.exists())
        ? new Response(file)
        : new Response("Not found", { status: 404 });
    },
  });
}

export function generationHeight(args: string[]): number {
  const { values } = parseArgs({
    args,
    options: { height: { type: "string" } },
  });
  if (values.height === undefined) return DEFAULT_HEIGHT;
  const height = imageHeight(values.height);
  if (height === undefined)
    throw new Error("--height must be an integer between 200 and 2160 pixels");
  return height;
}

export async function generate(
  height = DEFAULT_HEIGHT,
  output = join(
    ROOT,
    "assets/opengraph",
    height === DEFAULT_HEIGHT ? "" : String(height),
  ),
) {
  if (imageHeight(String(height)) === undefined)
    throw new Error("Invalid image height");
  const temporary = await mkdtemp(join(tmpdir(), "mosly-opengraph-"));
  const server = previewServer();
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: WIDTH, height },
      deviceScaleFactor: 1,
    });
    await page.goto(`${server.url}opengraph.html?capture&height=${height}`);
    // Keep DOM-specific code inside Chromium, not Bun's TypeScript context.
    const animation = await page.evaluate<{
      frameCount: number;
      frameDelay: number;
      background: string;
    }>(`(async () => {
      const { canvas, animation } = window.opengraph;
      await animation.ready;
      const background = getComputedStyle(document.body).backgroundImage;
      return {
        frameCount: animation.frameCount,
        frameDelay: animation.frameDelay,
        background: new URL(background.slice(5, -2)).pathname,
      };
    })()`);
    for (let frame = 0; frame < animation.frameCount; frame++) {
      const data = await page.evaluate<string>(`(() => {
        window.opengraph.animation.renderFrame(${frame});
        return window.opengraph.canvas.toDataURL('image/png').split(',')[1];
      })()`);
      await Bun.write(
        join(temporary, `${frame.toString().padStart(3, "0")}.png`),
        Buffer.from(data, "base64"),
      );
    }
    const background = join(ROOT, animation.background);
    const probe = JSON.parse(
      await command([
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        background,
      ]),
    );
    const backgroundMs = Math.round(Number(probe.format.duration) * 1000);
    if (!Number.isFinite(backgroundMs) || backgroundMs <= 0)
      throw new Error("Invalid background duration");
    const duration = loopDuration(
      backgroundMs,
      animation.frameCount * animation.frameDelay,
    );
    await mkdir(output, { recursive: true });

    for (const logo of LOGO_POSITIONS) {
      await page.goto(
        `${server.url}opengraph.html?capture&logo=${logo}&height=${height}`,
      );
      const bounds = await page.evaluate<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>(`(async () => {
        await window.opengraph.animation.ready;
        const { x, y, width, height } = window.opengraph.canvas.getBoundingClientRect();
        return { x, y, width, height };
      })()`);
      await command([
        "ffmpeg",
        "-v",
        "error",
        "-y",
        "-threads",
        "2",
        "-stream_loop",
        "-1",
        "-i",
        background,
        "-stream_loop",
        "-1",
        "-framerate",
        `1000/${animation.frameDelay}`,
        "-i",
        join(temporary, "%03d.png"),
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        // 10ms ticks preserve GIF centisecond timing and the wordmark's 90ms
        // cadence. mpdecimate removes duplicate frames without changing time.
        `[0:v]scale=${WIDTH}:${height}:force_original_aspect_ratio=increase,crop=${WIDTH}:${height},setsar=1,fps=100[bg];` +
          `[1:v]scale=${Math.round(bounds.width)}:${Math.round(bounds.height)}:flags=neighbor,format=rgba,fps=100[logo];` +
          `[bg][logo]overlay=${Math.round(bounds.x)}:${Math.round(bounds.y)}:shortest=1,trim=duration=${duration / 1000},mpdecimate=hi=0:lo=0:frac=0,split[a][b];` +
          "[a]palettegen=max_colors=8[p];[b][p]paletteuse=dither=none",
        "-fps_mode",
        "vfr",
        "-loop",
        "0",
        "-final_delay",
        "2",
        join(output, `${logo}.gif`),
      ]);
      const file = Bun.file(join(output, `${logo}.gif`));
      const encoded = JSON.parse(
        await command([
          "ffprobe",
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=width,height,duration,nb_frames",
          "-of",
          "json",
          file.name!,
        ]),
      ).streams[0];
      if (
        encoded.width !== WIDTH ||
        encoded.height !== height ||
        Number(encoded.nb_frames) < 2 ||
        Math.abs(Number(encoded.duration) * 1000 - duration) > 10
      ) {
        throw new Error(`Invalid generated GIF: ${logo}`);
      }
      if (file.size > 5_000_000)
        throw new Error(`Generated GIF exceeds 5MB: ${logo}`);
      console.log(
        `${logo}: ${WIDTH}×${height}, ${duration}ms → ${join(output, `${logo}.gif`)}`,
      );
    }
  } finally {
    await browser?.close();
    server.stop(true);
    await rm(temporary, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  Promise.resolve()
    .then(() => generate(generationHeight(Bun.argv.slice(2))))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
