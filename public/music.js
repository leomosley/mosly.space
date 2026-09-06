function albumKey(album, artist) {
  return `${album} by ${artist}`;
}

const albumArt = {
  [albumKey("Who Really Cares", "TV Girl")]:
    "/assets/album-art/who-really-cares.txt",
  [albumKey("THE PEAK", "smokedope2016")]: "/assets/album-art/the-peak.txt",
  [albumKey("The Bends", "Radiohead")]: "/assets/album-art/the-bends.txt",
  [albumKey("OK Computer", "Radiohead")]: "/assets/album-art/ok-computer.txt",
  [albumKey("What The Feng", "Feng")]: "/assets/album-art/what-the-feng.txt",
  [albumKey("about u - Single", "Lil Peep")]: "/assets/album-art/about-u.txt",
  [albumKey("Blood Sugar Sex Magik", "Red Hot Chili Peppers")]:
    "/assets/album-art/blood-sugar-sex-magik.txt",
  [albumKey("I Wanna Be Adored - Single", "The Raveonnettes")]:
    "/assets/album-art/i-wanna-be-adored.txt",
  [albumKey("Night, Blooming jasmine .", "Fakemink")]:
    "/assets/album-art/night-blooming-jasmine.txt",
  [albumKey("Selected Ambient Works 85-92", "Aphex Twin")]:
    "/assets/album-art/selected-ambient-works-85-92.txt",
  [albumKey("Crystal Castles", "Crystal Castles")]:
    "/assets/album-art/crystal-castles.txt",
  [albumKey("Riviera", "The Hellp")]: "/assets/album-art/riviera.txt",
  [albumKey("Diamond Eyes", "Deftones")]: "/assets/album-art/diamond-eyes.txt",
};

const songs = [
  {
    album: "Who Really Cares",
    artist: "TV Girl",
    name: "Loving Machine",
    albumArt: albumKey("Who Really Cares", "TV Girl"),
    src: "/assets/songs/loving-machine.mp3",
  },
  {
    album: "THE PEAK",
    artist: "smokedope2016",
    name: "In Da Party",
    albumArt: albumKey("THE PEAK", "smokedope2016"),
    src: "/assets/songs/in-da-party.mp3",
  },
  {
    album: "The Bends",
    artist: "Radiohead",
    name: "Fake Plastic Trees",
    albumArt: albumKey("The Bends", "Radiohead"),
    src: "/assets/songs/fake-plastic-trees.mp3",
  },
  {
    album: "OK Computer",
    artist: "Radiohead",
    name: "Subterranean Homesick Alien",
    albumArt: albumKey("OK Computer", "Radiohead"),
    src: "/assets/songs/subterranean-homesick-alien.mp3",
  },
  {
    album: "OK Computer",
    artist: "Radiohead",
    name: "Let Down",
    albumArt: albumKey("OK Computer", "Radiohead"),
    src: "/assets/songs/let-down.mp3",
  },
  {
    album: "What The Feng",
    artist: "Feng",
    name: "Mum, im an artist",
    albumArt: albumKey("What The Feng", "Feng"),
    src: "/assets/songs/mum-im-an-artist.mp3",
  },
  {
    album: "about u - Single",
    artist: "Lil Peep",
    name: "about u",
    albumArt: albumKey("about u - Single", "Lil Peep"),
    src: "/assets/songs/about-u.mp3",
  },
  {
    album: "Blood Sugar Sex Magik",
    artist: "Red Hot Chili Peppers",
    name: "Give It Away",
    albumArt: albumKey("Blood Sugar Sex Magik", "Red Hot Chili Peppers"),
    src: "/assets/songs/give-it-away.mp3",
  },
  {
    album: "I Wanna Be Adored - Single",
    artist: "The Raveonnettes",
    name: "I Wanna Be Adored",
    albumArt: albumKey("I Wanna Be Adored - Single", "The Raveonnettes"),
    src: "/assets/songs/i-wanna-be-adored.mp3",
  },
  {
    album: "Night, Blooming jasmine .",
    artist: "Fakemink",
    name: "Night, Blooming jasmine .",
    albumArt: albumKey("Night, Blooming jasmine .", "Fakemink"),
    src: "/assets/songs/night-blooming-jasmine.mp3",
  },
  {
    album: "Selected Ambient Works 85-92",
    artist: "Aphex Twin",
    name: "Xtal",
    albumArt: albumKey("Selected Ambient Works 85-92", "Aphex Twin"),
    src: "/assets/songs/xtal.mp3",
  },
  {
    album: "Crystal Castles",
    artist: "Crystal Castles",
    name: "Vanished",
    albumArt: albumKey("Crystal Castles", "Crystal Castles"),
    src: "/assets/songs/vanished.mp3",
  },
  {
    album: "Riviera",
    artist: "The Hellp",
    name: "Here I Am",
    albumArt: albumKey("Riviera", "The Hellp"),
    src: "/assets/songs/here-i-am.mp3",
  },
  {
    album: "Diamond Eyes",
    artist: "Deftones",
    name: "976-EVIL",
    albumArt: albumKey("Diamond Eyes", "Deftones"),
    src: "/assets/songs/976-evil.mp3",
  },
];

window.musicCatalog = { albumArt, songs };
