const player = document.querySelector("[data-music-player]");
const artwork = player.querySelector("[data-ansi-art]");
const trackName = player.querySelector("[data-track-name]");
const trackArtist = player.querySelector("[data-track-artist]");
const previousButton = player.querySelector("[data-previous]");
const playButton = player.querySelector("[data-play]");
const playIcon = playButton.querySelector("[data-play-icon]");
const pauseIcon = playButton.querySelector("[data-pause-icon]");
const nextButton = player.querySelector("[data-next]");
const volumeToggle = player.querySelector("[data-volume-toggle]");
const volumePopover = player.querySelector("[data-volume-popover]");
const volumeControl = player.querySelector("[data-volume]");
const audio = player.querySelector("[data-audio]");
const catalog = window.musicCatalog;
let currentSongIndex = Math.floor(Math.random() * catalog.songs.length);
let artworkRequest = 0;

async function renderAnsiArtwork(source) {
  const request = ++artworkRequest;
  artwork.replaceChildren();
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Could not load ANSI artwork: ${response.status}`);
  }

  const ansi = await response.text();
  if (request !== artworkRequest) return;

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

  artwork.append(fragment);
}

function fitArtwork(artwork) {
  const resolution = 30;
  const width = artwork.clientWidth;
  artwork.style.fontSize = `${width / (resolution * 0.6)}px`;
}

function updateMetadataScroll() {
  for (const text of [trackName, trackArtist]) {
    const overflow = text.scrollWidth - text.parentElement.clientWidth;
    text.classList.toggle("is-overflowing", overflow > 0);

    if (overflow > 0) {
      text.style.setProperty("--scroll-distance", `${overflow}px`);
      text.style.setProperty("--scroll-duration", `${5 + overflow / 20}s`);
    } else {
      text.style.removeProperty("--scroll-distance");
      text.style.removeProperty("--scroll-duration");
    }
  }
}

function loadSong(index, continuePlaying = false) {
  currentSongIndex = (index + catalog.songs.length) % catalog.songs.length;
  const song = catalog.songs[currentSongIndex];

  trackName.textContent = song.name;
  trackArtist.textContent = `${song.artist} · ${song.album}`;
  requestAnimationFrame(updateMetadataScroll);
  audio.src = song.src;
  artwork.hidden = false;
  renderAnsiArtwork(catalog.albumArt[song.albumArt]).catch((error) => {
    console.error(error);
    artwork.hidden = true;
  });

  if (continuePlaying) {
    audio.play().catch(() => {});
  }
}

function skipSong(direction) {
  loadSong(currentSongIndex + direction, !audio.paused);
}

function updatePlaybackButton() {
  const isPlaying = !audio.paused && !audio.ended;
  playIcon.hidden = isPlaying;
  pauseIcon.hidden = !isPlaying;
  playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}

playButton.addEventListener("click", () => {
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
});

previousButton.addEventListener("click", () => skipSong(-1));
nextButton.addEventListener("click", () => skipSong(1));
volumeControl.addEventListener("input", () => {
  audio.volume = Number(volumeControl.value);
});
volumeToggle.addEventListener("click", () => {
  const isOpen = volumeToggle.getAttribute("aria-expanded") === "true";
  volumeToggle.setAttribute("aria-expanded", String(!isOpen));
  volumePopover.hidden = isOpen;

  if (!isOpen) volumeControl.focus();
});
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".music-player-volume")) return;
  volumeToggle.setAttribute("aria-expanded", "false");
  volumePopover.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || volumePopover.hidden) return;
  volumeToggle.setAttribute("aria-expanded", "false");
  volumePopover.hidden = true;
  volumeToggle.focus();
});
audio.addEventListener("playing", updatePlaybackButton);
audio.addEventListener("pause", updatePlaybackButton);
audio.addEventListener("ended", () => skipSong(1));

let dragOffsetX = 0;
let dragOffsetY = 0;

function movePlayer(clientX, clientY) {
  const maxX = window.innerWidth - player.offsetWidth;
  const maxY = window.innerHeight - player.offsetHeight;
  player.style.left = `${Math.max(0, Math.min(clientX - dragOffsetX, maxX))}px`;
  player.style.top = `${Math.max(0, Math.min(clientY - dragOffsetY, maxY))}px`;
  player.style.transform = "none";
}

player.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, input")) return;

  const bounds = player.getBoundingClientRect();
  dragOffsetX = event.clientX - bounds.left;
  dragOffsetY = event.clientY - bounds.top;
  player.setPointerCapture(event.pointerId);
  player.classList.add("is-dragging");
});

player.addEventListener("pointermove", (event) => {
  if (!player.hasPointerCapture(event.pointerId)) return;
  movePlayer(event.clientX, event.clientY);
});

player.addEventListener("pointerup", (event) => {
  if (player.hasPointerCapture(event.pointerId)) {
    player.releasePointerCapture(event.pointerId);
  }
  player.classList.remove("is-dragging");
});

window.addEventListener("resize", () => {
  const bounds = player.getBoundingClientRect();
  if (bounds.right > window.innerWidth || bounds.bottom > window.innerHeight) {
    dragOffsetX = 0;
    dragOffsetY = 0;
    movePlayer(bounds.left, bounds.top);
  }
});

audio.volume = Number(volumeControl.value);
new ResizeObserver(() => fitArtwork(artwork)).observe(artwork);
new ResizeObserver(updateMetadataScroll).observe(trackName.parentElement);
document.fonts.ready.then(updateMetadataScroll);
loadSong(currentSongIndex);
updatePlaybackButton();
