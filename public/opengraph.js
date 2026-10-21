import { initializePixelText } from "./wordmark.js?v=9";

export const LOGO_POSITIONS = [
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right",
];

export const DEFAULT_HEIGHT = 630;

export function imageHeight(value) {
  if (!/^\d+$/.test(value ?? "")) return undefined;
  const height = Number(value);
  return Number.isInteger(height) && height >= 200 && height <= 2160
    ? height
    : undefined;
}

export function logoPosition(value) {
  const normalized = value?.trim().toLowerCase().replaceAll(" ", "-");
  return LOGO_POSITIONS.includes(normalized) ? normalized : "bottom-left";
}

if (typeof document !== "undefined") {
  const params = new URLSearchParams(location.search);
  document.documentElement.dataset.logo = logoPosition(params.get("logo"));
  document.documentElement.style.setProperty(
    "--image-height",
    `${imageHeight(params.get("height")) ?? DEFAULT_HEIGHT}px`,
  );
  const canvas = document.querySelector("[data-pixel-text]");
  canvas.dataset.pixelAlign = document.documentElement.dataset.logo.endsWith(
    "right",
  )
    ? "right"
    : "left";
  const manual = params.has("capture");
  const animation = initializePixelText(canvas, { manual });
  // The generator reads the same rasterized frames used by the live site.
  window.opengraph = { canvas, animation };
}
