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
