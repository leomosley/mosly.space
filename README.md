# mosly.space

## Local development

```sh
bun install
bun run dev
```

Open <http://localhost:3000>. Changes inside `public/` have hot reloading.

## Animated Open Graph image

`/opengraph.html` displays only the site's animated wordmark and background.
Choose a corner with `?logo=bottom-left` (default), `bottom-right`, `top-left`,
or `top-right`. Space-separated values such as `?logo=top%20right` work too.
Unknown values fall back to bottom-left.

Run `bun test` after installing Chromium to check positioning, animation, metadata,
and the existing homepage and 404 wordmarks.

Generate the four 1200×630 GIFs locally:

```sh
# Requires ffmpeg and ffprobe on PATH.
bunx playwright install chromium
bun run opengraph
```

The generator loads the render page in Chromium, exports all 36 frames from the
same `wordmark.js` renderer the homepage uses, and composites them over the actual
`background.gif`. Logo size and corner offsets come from the render page's CSS.
The output loops forever and contains two complete background loops, 3.26 seconds
total. The logo keeps its 90ms cadence, with a 20ms phase reset at the loop seam.
GIF encoding uses eight colors without dithering to keep the dark ASCII texture
compact.

Files are written to `public/assets/opengraph/{corner}.gif`. They are build outputs,
not committed binaries. Deployment regenerates them before uploading `public/`.
The homepage's Open Graph and Twitter metadata use `bottom-left.gif`.

Nekoweb serves static files. The `logo` query parameter controls the render page,
not the homepage's crawler metadata. Use the generated corner-specific GIF URL
when embedding another position. Social platforms may show only the first frame
of an animated GIF.
