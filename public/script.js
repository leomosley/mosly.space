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
  window
    .renderAnsiArtwork(artwork, catalog.albumArt[song.albumArt])
    .catch((error) => {
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
audio.addEventListener("play", updatePlaybackButton);
audio.addEventListener("pause", updatePlaybackButton);
audio.addEventListener("ended", () => skipSong(1));

audio.volume = Number(volumeControl.value);
window.makeDraggable(player);
new ResizeObserver(() => window.fitAnsiArtwork(artwork)).observe(artwork);
new ResizeObserver(updateMetadataScroll).observe(trackName.parentElement);
document.fonts.ready.then(updateMetadataScroll);
loadSong(currentSongIndex);
updatePlaybackButton();
