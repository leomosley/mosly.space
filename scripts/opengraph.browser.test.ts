import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright";
import { previewServer } from "./opengraph.mts";

const server = previewServer();
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  server.stop(true);
});

test("render page contains only background and animated logo, in all four corners", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const logo of [
    "bottom-left",
    "bottom-right",
    "top-left",
    "top-right",
    "invalid",
  ]) {
    await page.goto(`${server.url}opengraph.html?capture&logo=${logo}`);
    const result = await page.evaluate<any>(`(async () => {
      const { canvas, animation } = window.opengraph;
      await animation.ready;
      const first = canvas.toDataURL();
      animation.renderFrame(1);
      const second = canvas.toDataURL();
      const { x, y, width, height } = canvas.getBoundingClientRect();
      return {
        logo: document.documentElement.dataset.logo,
        x, y, width, height, animated: first !== second,
        children: document.body.children.length,
        background: getComputedStyle(document.body).backgroundImage,
        overlay: getComputedStyle(document.body, '::after').content,
        font: document.fonts.check('700 34px Satoshi'),
      };
    })()`);
    const expected = logo === "invalid" ? "bottom-left" : logo;
    expect(result.logo).toBe(expected);
    expect(result.x).toBeCloseTo(
      expected.endsWith("right") ? 1200 - 40 - result.width : 40,
    );
    expect(result.y).toBeCloseTo(
      expected.startsWith("top") ? 40 : 630 - 40 - result.height,
    );
    expect(result.animated).toBe(true);
    expect(result.children).toBe(1);
    expect(result.background).toContain("/assets/background.gif");
    expect(result.overlay).toBe("none");
    expect(result.font).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.close();
});

test("homepage and 404 still paint animated wordmarks after module conversion", async () => {
  const page = await browser.newPage();
  for (const path of ["/", "/not_found.html"]) {
    await page.goto(new URL(path, server.url).href);
    await page.waitForFunction(`(() => {
      const canvas = document.querySelector('[data-pixel-text]');
      return canvas && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(v => v !== 0);
    })()`);
    const first = await page
      .locator("[data-pixel-text]")
      .evaluate((canvas: any) => canvas.toDataURL());
    await page.waitForTimeout(180);
    const second = await page
      .locator("[data-pixel-text]")
      .evaluate((canvas: any) => canvas.toDataURL());
    expect(first).not.toBe(second);
  }
  await page.close();
});

test("height parameter bounds the banner and anchors every logo corner inside it", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  for (const height of ["200", "300", "900", "invalid", "-1", "2161"]) {
    const expectedHeight = ["200", "300", "900"].includes(height)
      ? Number(height)
      : 630;
    for (const logo of [
      "bottom-left",
      "bottom-right",
      "top-left",
      "top-right",
    ]) {
      await page.goto(
        `${server.url}opengraph.html?capture&height=${height}&logo=${logo}`,
      );
      const bounds = await page.evaluate<any>(`(async () => {
        await window.opengraph.animation.ready;
        const { x, y, width, height } = window.opengraph.canvas.getBoundingClientRect();
        return { x, y, width, height, bodyHeight: document.body.getBoundingClientRect().height };
      })()`);
      expect(bounds.bodyHeight).toBe(expectedHeight);
      expect(bounds.y).toBeCloseTo(
        logo.startsWith("top") ? 40 : expectedHeight - 40 - bounds.height,
      );
      expect(bounds.x).toBeCloseTo(
        logo.endsWith("right") ? 1200 - 40 - bounds.width : 40,
      );
      expect(bounds.y + bounds.height).toBeLessThan(expectedHeight);
    }
  }
  await page.close();
});

test("visible wordmark pixels stay close to the selected edge throughout the loop", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 300 },
  });
  for (const logo of ["bottom-left", "bottom-right", "top-left", "top-right"]) {
    await page.goto(
      `${server.url}opengraph.html?capture&height=300&logo=${logo}`,
    );
    const gaps = await page.evaluate<number[]>(`(async () => {
      const { canvas, animation } = window.opengraph;
      await animation.ready;
      const bounds = canvas.getBoundingClientRect();
      const scale = bounds.width / canvas.width;
      const gaps = [];
      for (let frame = 0; frame < animation.frameCount; frame++) {
        animation.renderFrame(frame);
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, right = 0;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (!pixels[(y * canvas.width + x) * 4 + 3]) continue;
            left = Math.min(left, x);
            right = Math.max(right, x + 1);
          }
        }
        gaps.push(document.documentElement.dataset.logo.endsWith('right')
          ? innerWidth - (bounds.x + right * scale)
          : bounds.x + left * scale);
      }
      return gaps;
    })()`);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(40);
      expect(gap).toBeLessThanOrEqual(52);
    }
  }
  await page.close();
});
