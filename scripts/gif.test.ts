import { describe, expect, test } from "bun:test";
import { ansiText, outputPath, parseResolution } from "./gif.mts";

describe("parseResolution", () => {
  test("parses a character grid", () => {
    expect(parseResolution("80x40")).toEqual({ columns: 80, rows: 40 });
  });

  test.each(["80", "80x", "0x40", "10.5x20"])("rejects %s", (value) => {
    expect(() => parseResolution(value)).toThrow("Expected WIDTHxHEIGHT");
  });
});

test("ansiText writes true-color rows", () => {
  const buffer = new SharedArrayBuffer(12);
  new Uint8Array(buffer).set([
    0, 0, 0, 255, 255, 255,
    255, 0, 0, 0, 255, 0,
  ]);

  expect(ansiText(buffer, { columns: 2, rows: 2 })).toBe(
    "\x1b[38;2;0;0;0m \x1b[38;2;255;255;255m@\x1b[0m\n" +
      "\x1b[38;2;255;0;0m:\x1b[38;2;0;255;0m*\x1b[0m\n",
  );
});

describe("outputPath", () => {
  test("uses text for still images", () => {
    expect(outputPath("/tmp/photo.png", undefined, false)).toBe("/tmp/photo.txt");
  });

  test("does not overwrite GIF input", () => {
    expect(outputPath("/tmp/loop.gif", undefined, true)).toBe("/tmp/loop-ansi.gif");
  });

  test("keeps the existing video output name", () => {
    expect(outputPath("/tmp/video.mp4", undefined, true)).toBe("/tmp/video.gif");
  });

  test("handles an extensionless input", () => {
    expect(outputPath("/tmp/photo", undefined, false)).toBe("/tmp/photo.txt");
  });
});
