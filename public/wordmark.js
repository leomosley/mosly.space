const canvas = document.querySelector("[data-wordmark-canvas]");

if (canvas) {
  const FRAME_COUNT = 36;
  const FRAME_DELAY = 90;
  const BAND_HEIGHT = 3;
  const COLUMN_WIDTH = 5;
  const ALPHA_THRESHOLD = 96;

  const context = canvas.getContext("2d");
  const source = document.createElement("canvas");
  const sourceContext = source.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frames = [];
  let frame = 0;
  let timeout;

  source.width = canvas.width;
  source.height = canvas.height;

  function rasterizeGlyphs() {
    const text = "mosly.space";
    const letters = [];
    let x = 2;

    sourceContext.clearRect(0, 0, source.width, source.height);
    sourceContext.fillStyle = "white";
    sourceContext.font = '700 34px "Satoshi", sans-serif';

    for (const character of text) {
      const width = sourceContext.measureText(character).width;
      sourceContext.fillText(character, x, 31);
      letters.push({ start: Math.floor(x), width });
      x += width - 1.8;
    }

    const sourcePixels = sourceContext.getImageData(
      0,
      0,
      source.width,
      source.height,
    ).data;

    return letters.map((letter, index) => {
      const end = Math.ceil(
        letters[index + 1]?.start ?? letter.start + letter.width,
      );
      const pixels = [];

      for (let y = 0; y < source.height; y++) {
        for (let x = letter.start; x < end; x++) {
          const alpha = sourcePixels[(y * source.width + x) * 4 + 3];
          if (alpha < ALPHA_THRESHOLD) continue;

          pixels.push({
            x,
            y,
            band: Math.floor(y / BAND_HEIGHT),
            column: Math.floor((x - letter.start) / COLUMN_WIDTH),
          });
        }
      }

      return {
        pixels,
        bandCount: Math.ceil(source.height / BAND_HEIGHT),
        columnCount: Math.ceil((end - letter.start) / COLUMN_WIDTH),
      };
    });
  }

  function seededUnit(...values) {
    let hash = 2166136261;
    for (const value of values) hash = Math.imul(hash ^ value, 16777619);
    return (hash >>> 0) / 4294967295;
  }

  function occasionalOffset(threshold, ...seed) {
    if (seededUnit(...seed) <= threshold) return 0;
    return Math.floor(seededUnit(...seed, 101) * 3) - 1;
  }

  function createGlyphMotion(glyph, frameNumber, letterNumber) {
    return {
      x: occasionalOffset(0.84, 1, frameNumber, letterNumber),
      y: occasionalOffset(0.9, 2, frameNumber, letterNumber),
      bands: Array.from({ length: glyph.bandCount }, (_, band) =>
        occasionalOffset(0.92, 3, frameNumber, letterNumber, band),
      ),
      columns: Array.from({ length: glyph.columnCount }, (_, column) =>
        occasionalOffset(0.97, 4, frameNumber, letterNumber, column),
      ),
    };
  }

  function paintPixel(data, x, y) {
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const pixel = (y * canvas.width + x) * 4;
    data[pixel] = 255;
    data[pixel + 1] = 255;
    data[pixel + 2] = 255;
    data[pixel + 3] = 255;
  }

  function createFrame(glyphs, frameNumber) {
    const output = context.createImageData(canvas.width, canvas.height);

    glyphs.forEach((glyph, letterNumber) => {
      const motion = createGlyphMotion(glyph, frameNumber, letterNumber);

      for (const pixel of glyph.pixels) {
        const texture = seededUnit(
          5,
          frameNumber,
          letterNumber,
          pixel.x,
          pixel.y,
        );
        if (texture > 0.997) continue;

        const x = pixel.x + motion.x + motion.bands[pixel.band];
        const y = pixel.y + motion.y + motion.columns[pixel.column];
        paintPixel(output.data, x, y);

        if (texture < 0.012) paintPixel(output.data, x + 1, y);
      }
    });

    return output;
  }

  function draw() {
    context.putImageData(frames[frame], 0, 0);
    frame = (frame + 1) % frames.length;
    if (!reducedMotion.matches) timeout = setTimeout(draw, FRAME_DELAY);
  }

  function restart() {
    clearTimeout(timeout);
    frame = 0;

    const glyphs = rasterizeGlyphs();
    frames = Array.from({ length: FRAME_COUNT }, (_, frameNumber) =>
      createFrame(glyphs, frameNumber),
    );
    draw();
  }

  reducedMotion.addEventListener("change", restart);
  document.fonts.ready.then(restart);
}
