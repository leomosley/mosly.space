const canvas = document.querySelector("[data-wordmark-canvas]");

if (canvas) {
  const context = canvas.getContext("2d");
  const source = document.createElement("canvas");
  const sourceContext = source.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const text = "mosly.space";
  let letterRanges = [];
  let frames = [];
  let frame = 0;
  let timeout;

  source.width = canvas.width;
  source.height = canvas.height;

  function renderSource() {
    sourceContext.clearRect(0, 0, source.width, source.height);
    sourceContext.fillStyle = "white";
    sourceContext.font = '700 34px "Satoshi", sans-serif';
    const letters = [];
    let x = 2;

    for (const character of text) {
      const width = sourceContext.measureText(character).width;
      sourceContext.fillText(character, x, 31);
      letters.push({ x, width });
      x += width - 1.8;
    }

    letterRanges = letters.map((letter, index) => ({
      start: Math.floor(letter.x),
      end: Math.ceil(letters[index + 1]?.x ?? letter.x + letter.width),
    }));
  }

  function random(...values) {
    let hash = 2166136261;
    for (const value of values) hash = Math.imul(hash ^ value, 16777619);
    return (hash >>> 0) / 4294967295;
  }

  function createFrame(frameNumber) {
    const input = sourceContext.getImageData(0, 0, source.width, source.height);
    const output = context.createImageData(canvas.width, canvas.height);

    for (let letter = 0; letter < letterRanges.length; letter++) {
      const range = letterRanges[letter];
      const moveX =
        random(frameNumber, letter, 1) > 0.84
          ? Math.floor(random(frameNumber, letter, 2) * 3) - 1
          : 0;
      const moveY =
        random(frameNumber, letter, 3) > 0.9
          ? Math.floor(random(frameNumber, letter, 4) * 3) - 1
          : 0;

      for (let y = 0; y < source.height; y++) {
        const band = Math.floor(y / 3);
        const tear =
          random(frameNumber, letter, band, 5) > 0.92
            ? Math.floor(random(frameNumber, letter, band, 6) * 3) - 1
            : 0;

        for (let x = range.start; x < range.end; x++) {
          const sourcePixel = (y * source.width + x) * 4;
          const alpha = input.data[sourcePixel + 3];
          if (alpha < 96 || random(frameNumber, letter, x, y, 7) > 0.997) {
            continue;
          }

          const column = Math.floor((x - range.start) / 5);
          const twitch =
            random(frameNumber, letter, column, 8) > 0.97
              ? Math.floor(random(frameNumber, letter, column, 9) * 3) - 1
              : 0;
          const destinationX = x + moveX + tear;
          const destinationY = y + moveY + twitch;
          if (
            destinationX < 0 ||
            destinationX >= canvas.width ||
            destinationY < 0 ||
            destinationY >= canvas.height
          ) {
            continue;
          }

          const destinationPixel =
            (destinationY * canvas.width + destinationX) * 4;
          output.data.set([255, 255, 255, 255], destinationPixel);

          if (
            random(frameNumber, letter, x, y, 10) > 0.988 &&
            destinationX + 1 < canvas.width
          ) {
            output.data.set([255, 255, 255, 255], destinationPixel + 4);
          }
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
