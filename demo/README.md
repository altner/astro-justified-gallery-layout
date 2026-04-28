# Demo

Local Astro app for developing and testing `@altner/astro-justified-gallery-layout`. The package is linked via npm workspaces from `packages/astro-justified-gallery-layout`, so changes there are picked up immediately.

## Pages

- `/` — three galleries with different `targetRowHeight` / `gap` settings, year/month filter, lightbox
- `/playground` — sliders to tweak parameters live
- `/virtual` — virtualized gallery with paginated API endpoint, year/month filter

## Photos

Drop images into `src/assets/photos/` (jpg, jpeg, png, webp, avif). The folder is `.gitignore`d on purpose — bring your own collection. Subdirectories are scanned recursively. The collection loader (`src/content.config.ts`) reads EXIF/IPTC/GPS metadata and generates LQIP previews automatically; the year/month filter UI is driven by `dateTaken`.

If the folder is empty or missing, the demo just shows an empty gallery (no crash).

## Commands

Run from the repo root:

```sh
npm install
npm run dev -w demo       # http://localhost:4321
npm run build -w demo
npm run preview -w demo
```
