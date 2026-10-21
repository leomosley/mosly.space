import { expect, test } from "bun:test";
import {
  imageHeight,
  logoPosition,
  LOGO_POSITIONS,
} from "../public/opengraph.js";
import { generationHeight, loopDuration } from "./opengraph.mts";

test("image height accepts pixel heights within safe rendering bounds", () => {
  for (const height of [200, 300, 630, 2160]) {
    expect(imageHeight(String(height))).toBe(height);
  }
  for (const value of [
    null,
    undefined,
    "",
    "0",
    "-1",
    "199",
    "2161",
    "300.5",
    "300px",
    "Infinity",
    "1e3",
  ]) {
    expect(imageHeight(value)).toBeUndefined();
  }
});

test("CLI height defaults to 630 and rejects invalid options", () => {
  expect(generationHeight([])).toBe(630);
  expect(generationHeight(["--height", "300"])).toBe(300);
  expect(generationHeight(["--height=300"])).toBe(300);
  for (const args of [
    ["--height", "bad"],
    ["--height", "0"],
    ["--height"],
    ["--width", "1000"],
    ["extra"],
  ]) {
    expect(() => generationHeight(args)).toThrow();
  }
});

test("logo defaults to bottom-left, including unknown values", () => {
  for (const value of [null, undefined, "", "center", "<script>"]) {
    expect(logoPosition(value)).toBe("bottom-left");
  }
});

test("all four corners accept hyphens or spaces", () => {
  for (const position of LOGO_POSITIONS) {
    expect(logoPosition(position)).toBe(position);
    expect(logoPosition(position.replaceAll("-", " "))).toBe(position);
  }
  expect(logoPosition(" TOP RIGHT ")).toBe("top-right");
});

test("capture includes every logo frame and complete background loops", () => {
  expect(loopDuration(1630, 36 * 90)).toBe(3260);
  expect(loopDuration(5000, 3240)).toBe(5000);
});

test("social metadata uses the generated image, not Hubert Dingle", async () => {
  const html = await Bun.file("public/index.html").text();
  expect(html).not.toContain("hubert-dingle");
  expect(await Bun.file("public/assets/hubert-dingle.gif").exists()).toBe(
    false,
  );
  expect(
    html.match(/https:\/\/mosly.space\/assets\/opengraph\/bottom-left.gif/g),
  ).toHaveLength(2);
  expect(html).toContain('property="og:image:width" content="1200"');
  expect(html).toContain('property="og:image:height" content="630"');
});
