const ansiArtworkRequests = new WeakMap();

window.renderAnsiArtwork = async function renderAnsiArtwork(element, source) {
  const request = (ansiArtworkRequests.get(element) ?? 0) + 1;
  ansiArtworkRequests.set(element, request);
  element.replaceChildren();

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Could not load ANSI artwork: ${response.status}`);
  }

  const ansi = await response.text();
  if (request !== ansiArtworkRequests.get(element)) return;

  const colorCode = /\x1b\[38;2;(\d+);(\d+);(\d+)m([^\x1b])/g;
  const fragment = document.createDocumentFragment();
  const lines = ansi.trimEnd().split("\n");

  for (const [lineIndex, line] of lines.entries()) {
    for (const match of line.matchAll(colorCode)) {
      const span = document.createElement("span");
      span.style.color = `rgb(${match[1]} ${match[2]} ${match[3]})`;
      span.textContent = match[4];
      fragment.append(span);
    }
    if (lineIndex < lines.length - 1) {
      fragment.append("\n");
    }
  }

  element.append(fragment);
};

window.fitAnsiArtwork = function fitAnsiArtwork(element, columns = 30) {
  element.style.fontSize = `${element.clientWidth / (columns * 0.6)}px`;
};
