# Demo

Local Astro app for developing and testing `@altner/astro-justified-gallery-layout`. The package is linked via npm workspaces from `packages/astro-justified-gallery-layout`, so changes there are picked up immediately.

## Pages

- `/` — three galleries with different `targetRowHeight` / `gap` settings
- `/playground` — sliders to tweak parameters live

## Photos

Drop images into `src/assets/photos/` (jpg, jpeg, png, webp, avif). They are imported via `import.meta.glob` and served through Astro's `<Image />` pipeline. The demo currently caps at the first 60 alphabetically to keep build/dev fast.

## Commands

Run from the repo root:

```sh
npm install
npm run dev -w demo       # http://localhost:4321
npm run build -w demo
npm run preview -w demo
```
