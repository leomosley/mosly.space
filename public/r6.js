const r6Card = document.querySelector("[data-r6-card]");
const r6Emblem = r6Card.querySelector("[data-r6-emblem]");
const r6Rp = r6Card.querySelector("[data-r6-rp]");

const rankTiers = [
  "Copper",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Champion",
];
const rankDivisions = ["V", "IV", "III", "II", "I"];

function getRank(rp) {
  const rankOffset = Math.max(0, rp - 1000);
  const tierIndex = Math.min(
    Math.floor(rankOffset / 500),
    rankTiers.length - 1,
  );

  const tier = rankTiers[tierIndex];
  const tierOffset = rankOffset - tierIndex * 500;
  const division = rankDivisions[Math.min(Math.floor(tierOffset / 100), 4)];
  return {
    name: `${tier} ${division}`,
    slug: `${tier.toLowerCase()}-${division.toLowerCase()}`,
  };
}

function displayRank(rp) {
  const rank = getRank(rp);
  r6Emblem.setAttribute("aria-label", `${rank.name} emblem`);
  r6Emblem.hidden = false;
  window
    .renderAnsiArtwork(r6Emblem, `/assets/r6-ranks/v7-${rank.slug}-small.txt`)
    .catch((error) => {
      console.error(error);
      r6Emblem.hidden = true;
    });
  r6Rp.textContent = `${rp.toLocaleString("en-US")} RP`;
  r6Card.dataset.state = "ready";
}

function parseR6Stats(output) {
  const plainText = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  const currentRank = plainText.match(
    /Current Rank\s+(.+?)\s+\u00b7\s+([\d,]+) RP(?:\s+\u00b7|$)/m,
  );

  if (!currentRank) {
    throw new Error("Current R6 rank was not found in the response");
  }

  return Number(currentRank[2].replaceAll(",", ""));
}

async function fetchR6Stats() {
  const response = await fetch("https://r6fetch.cc/pc/mosly");

  if (!response.ok) {
    throw new Error(`Could not fetch R6 stats: ${response.status}`);
  }

  return parseR6Stats(await response.text());
}

fetchR6Stats()
  .then(displayRank)
  .catch((error) => {
    console.error(error);

    if (["localhost", "127.0.0.1", "::1"].includes(location.hostname)) {
      displayRank(4300);
      return;
    }

    r6Rp.textContent = "stats unavailable";
    r6Card.dataset.state = "error";
  });

window.makeDraggable(r6Card);
new ResizeObserver(() => window.fitAnsiArtwork(r6Emblem, 25)).observe(r6Emblem);
