import { initializePixelText } from "./wordmark.js?v=8";

export const LOGO_POSITIONS = [
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right",
];

export function logoPosition(value) {
  const normalized = value?.trim().toLowerCase().replaceAll(" ", "-");
  return LOGO_POSITIONS.includes(normalized) ? normalized : "bottom-left";
}

if (typeof document !== "undefined") {
  document.documentElement.dataset.logo = logoPosition(
    new URLSearchParams(location.search).get("logo"),
  );
  const canvas = document.querySelector("[data-pixel-text]");
  const manual = new URLSearchParams(location.search).has("capture");
  const animation = initializePixelText(canvas, { manual });
  // The generator reads the same rasterized frames used by the live site.
  window.opengraph = { canvas, animation };
}
