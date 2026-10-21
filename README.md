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

Set the height in pixels for a banner, for example
`/opengraph.html?logo=bottom-right&height=300`. Heights from 200 to 2160 are
supported. Missing or invalid values use 630. The background covers the requested
height, and logo corners stay relative to the image, not the browser window.

Run `bun test` after installing Chromium to check positioning, animation, metadata,
and the existing homepage and 404 wordmarks.

Generate the four 1200×630 GIFs locally:

```sh
# Requires ffmpeg and ffprobe on PATH.
bunx playwright install chromium
bun run opengraph

# Generate 1200×300 banner GIFs for all four logo corners.
bun run opengraph --height 300
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

Custom-height exports go to `public/assets/opengraph/{height}/{corner}.gif`, so
banner exports do not overwrite the default social images. Each output must stay
under 5 MB. Deployment generates both the default 630px images and 300px banners.
For example, `/assets/opengraph/300/bottom-right.gif` is the hosted banner with the
logo in the bottom-right corner. To host another height, add its generation
command to the deployment workflow.

Nekoweb serves static files. The `logo` query parameter controls the render page,
not the homepage's crawler metadata. Use the generated corner-specific GIF URL
when embedding another position. Social platforms may show only the first frame
of an animated GIF.
