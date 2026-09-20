const canvas = document.querySelector("[data-wordmark-canvas]");

if (canvas) {
  const context = canvas.getContext("2d");
  const source = document.createElement("canvas");
  const sourceContext = source.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const text = "mosly.space";
  let frames = [];
  let frame = 0;
  let timeout;

  source.width = canvas.width;
  source.height = canvas.height;

  function renderSource() {
    sourceContext.clearRect(0, 0, source.width, source.height);
    sourceContext.fillStyle = "white";
    sourceContext.font = '700 34px "Satoshi", sans-serif';
    let x = 2;

    for (const character of text) {
      sourceContext.fillText(character, x, 31);
      x += sourceContext.measureText(character).width - 1.8;
    }
  }

  function createFrame(frameNumber) {
    const input = sourceContext.getImageData(0, 0, source.width, source.height);
    const output = context.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < source.height; y++) {
      const band = Math.floor(y / 3);
      const shiftX =
        ((frameNumber + band * 5) % 17 === 0 ? 2 : 0) -
        ((frameNumber * 2 + band * 3) % 19 === 0 ? 1 : 0);

      for (let x = 0; x < source.width; x++) {
        const sourcePixel = (y * source.width + x) * 4;
        const alpha = input.data[sourcePixel + 3];
        if (alpha < 96) continue;

        const column = Math.floor(x / 8);
        const shiftY = (frameNumber + column * 7) % 29 === 0 ? 1 : 0;
        const destinationX = x + shiftX;
        const destinationY = y + shiftY;
        if (
          destinationX < 0 ||
          destinationX >= canvas.width ||
          destinationY >= canvas.height
        ) {
          continue;
        }

        const destinationPixel = (destinationY * canvas.width + destinationX) * 4;
        output.data[destinationPixel] = 255;
        output.data[destinationPixel + 1] = 255;
        output.data[destinationPixel + 2] = 255;
        output.data[destinationPixel + 3] = 255;

        if (
          (frameNumber + x + y * 3) % 113 === 0 &&
          destinationX + 1 < canvas.width
        ) {
          output.data.set([255, 255, 255, 255], destinationPixel + 4);
        }
      }
    }

    return output;
  }

  function draw() {
    context.putImageData(frames[frame], 0, 0);
    frame = (frame + 1) % frames.length;
    if (!reducedMotion.matches) timeout = setTimeout(draw, 90);
  }

  function restart() {
    clearTimeout(timeout);
    frame = 0;
    renderSource();
    frames = Array.from({ length: 36 }, (_, index) => createFrame(index));
    draw();
  }

  reducedMotion.addEventListener("change", restart);
  document.fonts.ready.then(restart);
}
