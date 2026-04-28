# @altner/astro-justified-gallery-layout

Modern, zero-dependency justified (Flickr-style) gallery layout for Astro. Static and virtualized components, content loader with EXIF/IPTC/GPS extraction, LQIP previews, and a drop-in modal lightbox with slide animation and swipe gestures.

A from-scratch replacement for Flickr's [justified-layout](https://github.com/flickr/justified-layout), which hasn't been touched in 6+ years. Smaller, ESM-first, no CommonJS legacy.

## Features

- **Justified row layout** — pure ~120 LOC function, deterministic, no DOM access
- **Two components** — `<JustifiedGallery />` for normal use (≤ ~5k photos), `<JustifiedGalleryVirtual />` with DOM windowing for very large collections
- **Content Loader** — drop-in `galleryLoader()` for Astro Content Collections; scans a directory and optionally reads EXIF/IPTC/XMP/GPS metadata
- **LQIP previews** — tiny base64 placeholders (~1 KB) for instant first paint while full images load
- **Lightbox** — native `<dialog>` modal with prev/next, swipe, ESC/×/backdrop close
- **Resize-safe** — re-flows on container resize via `ResizeObserver`
- **TypeScript types** bundled, `is:global` styles avoid scoping bugs with dynamic items

## Table of contents

- [Install](#install)
- [Quick start](#quick-start) — minimal Astro setup in 30 lines
- [Components](#components)
  - [`<JustifiedGallery />`](#justifiedgallery-)
  - [`<JustifiedGalleryVirtual />`](#virtualized-component-massive-galleries)
  - [`<Lightbox />`](#lightbox)
- [Content Loader](#content-loader)
- [EXIF helper](#exif-helper)
- [Pure function (`computeLayout`)](#pure-function-computelayout)
- [Recipes](#recipes)
- [Comparison vs. flickr/justified-layout](#comparison-vs-flickrjustified-layout)
- [License](#license)

## Install

```bash
npm install @altner/astro-justified-gallery-layout
```

Peer dependencies (all optional):

| Peer | Required for |
|---|---|
| `astro >= 4` | The `.astro` components and `image()` schema helper. Not needed if you only use the pure `computeLayout` function. |
| `exifr >= 7` | EXIF/IPTC/XMP/GPS reading via the loader's `exif: true` option or the standalone `readPhotoMeta()` helper. |
| `sharp` | LQIP preview generation in the loader (`preview: true`). Already a transitive dependency of `astro:assets`, so usually already present. |

Install only what you need; missing optional peers degrade silently.

## Quick start

Minimal Astro project with a content collection of photos and a static gallery:

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { galleryLoader } from "@altner/astro-justified-gallery-layout/loader";

export const collections = {
  photos: defineCollection({
    loader: galleryLoader({
      base: "./src/assets/photos",
      preview: true, // tiny LQIPs for instant placeholders
    }),
    schema: ({ image }) =>
      z.object({
        src: image(),
        alt: z.string().optional(),
        preview: z.string().optional(),
      }),
  }),
};
```

```astro
---
// src/pages/index.astro
import { getCollection } from "astro:content";
import JustifiedGallery from "@altner/astro-justified-gallery-layout/JustifiedGallery.astro";
import Lightbox from "@altner/astro-justified-gallery-layout/Lightbox.astro";

const photos = await getCollection("photos");
const images = photos.map((p) => ({
  src: p.data.src,
  alt: p.data.alt,
  preview: p.data.preview,
}));
---

<JustifiedGallery images={images} chunkSize={30} lightbox />
<Lightbox />
```

That's it. Drop your photos into `src/assets/photos/`, run `astro dev`, and you have a justified gallery with lazy-loaded thumbnails, LQIP placeholders, and a modal lightbox.

## Components

### `<JustifiedGallery />`

Drop-in static component that uses Astro's `<Image />` for automatic optimization, lays items out client-side, and re-flows on resize via `ResizeObserver`.

```astro
---
import JustifiedGallery from "@altner/astro-justified-gallery-layout/JustifiedGallery.astro";
import type { ImageMetadata } from "astro";

const modules = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/photos/*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);
const images = Object.values(modules).map((m) => ({ src: m.default }));
---

<JustifiedGallery images={images} targetRowHeight={240} gap={6} />
```

**Props**

| Prop              | Type                                                                              | Default                 | Description                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `images`          | `{ src: ImageMetadata, alt?: string, caption?: string, href?: string, preview?: string }[]` | —                       | Imported image modules. `caption` is HTML rendered as a hover overlay (trusted source). `preview` is a tiny LQIP data URI. |
| `targetRowHeight` | `number`                                                                          | `240`                   | Target row height in CSS pixels.                                                                                                 |
| `gap`             | `number`                                                                          | `6`                     | Gap between items on both axes.                                                                                                  |
| `maxRowHeight`    | `number`                                                                          | `targetRowHeight * 1.5` | Cap for the trailing partial row.                                                                                                |
| `chunkSize`       | `number`                                                                          | —                       | If set, only this many items are laid out initially; the rest are revealed in chunks as the user scrolls (IntersectionObserver). |
| `chunkRootMargin` | `string`                                                                          | `"800px"`               | `rootMargin` of the chunk sentinel — how far ahead of the viewport bottom to trigger the next chunk.                             |
| `lightbox`        | `boolean`                                                                         | `false`                 | When true, items become triggers for the `<Lightbox />` component.                                                               |
| `class`           | `string`                                                                          | —                       | Additional class on the wrapper.                                                                                                 |

All `<img>` tags use `loading="lazy"` regardless of `chunkSize`. `chunkSize` additionally avoids paying the layout/paint cost for items beyond the visible window. When `preview` is set on an item, its data URI is painted as the container's `background-image` — instant placeholder while the full image loads.

To trigger a re-layout manually (e.g. after changing config at runtime), dispatch an `ajg:relayout` event on the `.ajg-root` element.

### `<Lightbox />`

Drop-in modal lightbox. Place `<Lightbox />` once on the page (e.g. in your layout) and opt in per gallery via the `lightbox` prop.

```astro
---
import JustifiedGallery from "@altner/astro-justified-gallery-layout/JustifiedGallery.astro";
import Lightbox from "@altner/astro-justified-gallery-layout/Lightbox.astro";
---

<JustifiedGallery images={images} lightbox />
<Lightbox />
```

Behavior:

- Click an item → opens the image in a `<dialog>` modal
- Caption (whatever you passed via `caption`) is shown beneath the image
- ←/→ arrow keys, on-screen buttons, or click the nav arrows to navigate within the same gallery
- ESC, the × button, or backdrop click to close
- Static galleries can navigate every item, even ones still hidden by `chunkSize`. Virtual galleries can only navigate items currently in the DOM (a few rows above/below the viewport — adjust `bufferRows` to widen the window if needed)

The lightbox uses the original `<img>`'s `srcset` and lets the browser pick an appropriate variant for the larger display, so no extra image processing is needed.

### `<JustifiedGalleryVirtual />` (massive galleries)

For galleries beyond a few thousand photos, use `<JustifiedGalleryVirtual />` instead of the static one. The server renders an empty container; the client fetches metadata in chunks from a JSON endpoint, computes the layout incrementally, and keeps only items near the viewport in the DOM (true windowing with node recycling).

```ts
// src/pages/api/gallery.json.ts
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getImage } from "astro:assets";

export const GET: APIRoute = async ({ url }) => {
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 50));

  const all = await getCollection("photos");
  const slice = all.slice(offset, offset + limit);

  const items = await Promise.all(slice.map(async (entry) => {
    const optimized = await getImage({
      src: entry.data.src,
      widths: [400, 800, 1600],
      formats: ["webp"],
    });
    return {
      src: optimized.src,
      srcset: optimized.srcSet?.attribute,
      sizes: "(max-width: 800px) 50vw, 25vw",
      w: entry.data.src.width,
      h: entry.data.src.height,
      alt: entry.data.alt ?? "",
    };
  }));

  return Response.json({ items, total: all.length });
};
```

```astro
---
import JustifiedGalleryVirtual from "@altner/astro-justified-gallery-layout/JustifiedGalleryVirtual.astro";
---

<JustifiedGalleryVirtual
  endpoint="/api/gallery.json"
  targetRowHeight={240}
  gap={6}
  chunkSize={50}
  bufferRows={5}
/>
```

Requires SSR (`output: "server"`) so the endpoint runs on demand. The endpoint must return `{ items, total }` matching `VirtualGalleryItem[]`. **Tradeoff:** SEO crawlers see no images in the initial HTML — only use this when the alternative (inlining tens of thousands of `<img>` tags) is worse.

## Content Loader

For Astro Content Collections, the package ships a loader that scans a directory of images and produces entries shaped to feed `<JustifiedGallery />` directly.

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { galleryLoader } from "@altner/astro-justified-gallery-layout/loader";

export const collections = {
  photos: defineCollection({
    loader: galleryLoader({ base: "./src/assets/photos" }),
    schema: ({ image }) =>
      z.object({
        src: image(),
        alt: z.string().optional(),
      }),
  }),
};
```

```astro
---
import { getCollection } from "astro:content";
import JustifiedGallery from "@altner/astro-justified-gallery-layout/JustifiedGallery.astro";

const photos = await getCollection("photos");
const images = photos.map((p) => ({ src: p.data.src, alt: p.data.alt }));
---

<JustifiedGallery images={images} />
```

**Options**

| Option       | Default                                    | Description                                                                                                                                                            |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`       | (required)                                 | Directory to scan, relative to project root (or absolute).                                                                                                             |
| `extensions` | `["jpg","jpeg","png","webp","avif","gif"]` | File extensions (without leading dot).                                                                                                                                 |
| `recursive`  | `true`                                     | Recurse into subdirectories.                                                                                                                                           |
| `getAlt`     | basename without extension                 | Custom alt-text deriver (`(absPath) => string`).                                                                                                                       |
| `filter`     | —                                          | Predicate to skip files (`(absPath) => boolean`).                                                                                                                      |
| `exif`       | `false`                                    | Read EXIF / IPTC / XMP / GPS metadata for each image and emit it as `data.meta`. Requires the optional [`exifr`](https://www.npmjs.com/package/exifr) peer dependency. |

The loader emits paths only — image dimensions are resolved by Astro's built-in `image()` schema helper, so `p.data.src` is fully-typed `ImageMetadata`.

### Reading EXIF / IPTC / GPS

When `exif: true`, the loader also calls [`readPhotoMeta()`](#exif-helper) on every image and stores the normalized result on `data.meta`. All fields are optional — the loader writes only what's actually present in the file, so the schema must mark every nested field optional too.

```ts
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { galleryLoader } from "@altner/astro-justified-gallery-layout/loader";

export const collections = {
  photos: defineCollection({
    loader: galleryLoader({ base: "./src/assets/photos", exif: true }),
    schema: ({ image }) =>
      z.object({
        src: image(),
        alt: z.string().optional(),
        meta: z
          .object({
            camera: z
              .object({
                make: z.string().optional(),
                model: z.string().optional(),
                lens: z.string().optional(),
                focalLength: z.number().optional(),
                fNumber: z.number().optional(),
                exposureTime: z.number().optional(),
                iso: z.number().optional(),
              })
              .optional(),
            dateTaken: z.coerce.date().optional(),
            gps: z
              .object({ latitude: z.number(), longitude: z.number() })
              .optional(),
            iptc: z
              .object({
                title: z.string().optional(),
                description: z.string().optional(),
                keywords: z.array(z.string()).optional(),
              })
              .optional(),
          })
          .optional(),
      }),
  }),
};
```

### EXIF helper

Standalone helper for reading metadata from a single file. Use directly when you don't want to go through the loader (e.g. inside an SSR API endpoint that processes images on demand).

```ts
import {
  readPhotoMeta,
  formatCameraLine,
} from "@altner/astro-justified-gallery-layout/exif";

const meta = await readPhotoMeta("/abs/path/to/photo.jpg");
// { camera?, dateTaken?, gps?, iptc? } | null
const tech = formatCameraLine(meta);
// → "Sony ILCE-7M3 · 35mm · f/2.8 · 1/250s · ISO 400"
```

`readPhotoMeta` returns `null` when the optional `exifr` peer dependency is not installed or the file has no parseable metadata.

## Pure function (`computeLayout`)

For frameworks other than Astro, or for a fully custom DOM, use the layout function directly:

```js
import { computeLayout } from "@altner/astro-justified-gallery-layout";

const items = [
  { w: 1920, h: 1280 },  // landscape
  { w: 1080, h: 1920 },  // portrait
  { w: 1024, h: 1024 },  // square
  // ...
];

const { boxes, totalHeight } = computeLayout(items, {
  containerWidth: container.clientWidth,
  targetRowHeight: 240,
  gap: 6,
});

container.style.height = `${totalHeight}px`;

boxes.forEach((box, i) => {
  const el = items[i].element;
  el.style.transform = `translate(${box.left}px, ${box.top}px)`;
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
});
```

## API

### `computeLayout(items, options)`

Pure function — same input always produces the same output, no DOM access.

**`items`** — array of `{ w, h }`. Only the ratio matters; pass original pixel dimensions or anything else.

**`options`**

| Option            | Default                  | Description                                                  |
| ----------------- | ------------------------ | ------------------------------------------------------------ |
| `containerWidth`  | (required)               | Available width in CSS pixels.                               |
| `targetRowHeight` | `240`                    | Aim for rows of roughly this height.                         |
| `gap`             | `6`                      | Gap between items on both axes.                              |
| `maxRowHeight`    | `targetRowHeight * 1.5`  | Cap for the trailing partial row.                            |

**Returns** `{ boxes, totalHeight }`

- `boxes` — array (in input order) of `{ index, left, top, width, height }` in CSS pixels.
- `totalHeight` — total grid height, no trailing gap. Set this on your container.

## Design notes

- **Smart row breaking.** When adding an item would push the row at-or-below the target height, we compare both options (close-with vs. close-before) and pick whichever lands closer to the target. Avoids both stretched single items and squished thin rows.
- **Last row.** Left-aligned at target height, not justified — stretching three landscapes to fill 1500px looks ridiculous. Capped by `maxRowHeight`.
- **Pure & deterministic.** No DOM access, no side effects. Trivial to test, trivial to memoize, runs in workers.
- **No virtualization.** Returns positions for every item. For 10k+ photos pair with `content-visibility: auto` (browser-native virtualization).

## Recipes

### Render a hover caption from EXIF / IPTC / GPS

The components don't impose a caption format — `caption` is just an HTML string. Here's a complete helper that turns a `PhotoMeta` into a styled caption with title, camera tech line, date, GPS link, and hierarchical keywords. Drop it into your project and customize the locale / map provider / fields.

```ts
// src/lib/buildCaption.ts
import {
  formatCameraLine,
  type PhotoMeta,
} from "@altner/astro-justified-gallery-layout/exif";

const escMap: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => escMap[c]);

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  year: "numeric", month: "short", day: "numeric",
});

export function buildCaption(
  meta: PhotoMeta | undefined | null,
  fallbackTitle?: string,
): string | undefined {
  if (!meta && !fallbackTitle) return undefined;
  const parts: string[] = [];

  const title = meta?.iptc?.title ?? fallbackTitle;
  if (title) parts.push(`<div class="ajg-title">${esc(title)}</div>`);
  if (meta?.iptc?.description)
    parts.push(`<div class="ajg-desc">${esc(meta.iptc.description)}</div>`);

  const tech = formatCameraLine(meta);
  if (tech) parts.push(`<div class="ajg-tech">${esc(tech)}</div>`);

  const metaLine: string[] = [];
  if (meta?.dateTaken) metaLine.push(esc(dateFmt.format(meta.dateTaken)));
  if (meta?.gps) {
    const { latitude: lat, longitude: lon } = meta.gps;
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`;
    metaLine.push(
      `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">${lat.toFixed(4)}, ${lon.toFixed(4)}</a>`,
    );
  }
  if (metaLine.length)
    parts.push(`<div class="ajg-meta">${metaLine.join(" · ")}</div>`);

  const chips: string[] = [];
  for (const path of meta?.iptc?.keywordsHierarchy?.slice(0, 6) ?? []) {
    if (path.length)
      chips.push(`<span class="ajg-keyword">${path.map(esc).join(" › ")}</span>`);
  }
  for (const k of meta?.iptc?.keywords?.slice(0, 6) ?? []) {
    chips.push(`<span class="ajg-keyword">${esc(k)}</span>`);
  }
  if (chips.length)
    parts.push(`<div class="ajg-keywords">${chips.join("")}</div>`);

  return parts.length ? parts.join("") : undefined;
}
```

The class names `.ajg-title`, `.ajg-tech`, `.ajg-meta`, `.ajg-keywords`, `.ajg-keyword` are pre-styled by the `<JustifiedGallery />` and `<Lightbox />` components.

### Massive virtualized gallery with year/month filtering

Server-side filter via URL search params, paginated API endpoint:

```astro
---
// src/pages/gallery.astro
import { getCollection } from "astro:content";
import JustifiedGalleryVirtual from "@altner/astro-justified-gallery-layout/JustifiedGalleryVirtual.astro";
import Lightbox from "@altner/astro-justified-gallery-layout/Lightbox.astro";

const year = Astro.url.searchParams.get("year") ?? "";
const month = Astro.url.searchParams.get("month") ?? "";

// Compute the endpoint URL with filter params; the component appends offset/limit.
const u = new URLSearchParams();
if (year) u.set("year", year);
if (month) u.set("month", month);
const endpoint = `/api/gallery.json${u.toString() ? `?${u}` : ""}`;
---

<JustifiedGalleryVirtual endpoint={endpoint} chunkSize={50} bufferRows={5} lightbox />
<Lightbox />
```

```ts
// src/pages/api/gallery.json.ts
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getImage } from "astro:assets";

export const GET: APIRoute = async ({ url }) => {
  const offset = Math.max(0, +(url.searchParams.get("offset") ?? 0));
  const limit = Math.min(200, +(url.searchParams.get("limit") ?? 50));
  const year = url.searchParams.get("year");
  const month = url.searchParams.get("month");

  const all = await getCollection("photos");
  const filtered = all.filter((p) => {
    const d = p.data.meta?.dateTaken;
    if (!year && !month) return true;
    if (!d) return false;
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return (!year || y === year) && (!month || m === month);
  });

  const items = await Promise.all(
    filtered.slice(offset, offset + limit).map(async (entry) => {
      const opt = await getImage({
        src: entry.data.src,
        widths: [400, 800, 1600],
        formats: ["webp"],
      });
      return {
        src: opt.src,
        srcset: opt.srcSet?.attribute,
        sizes: "(max-width: 800px) 50vw, 25vw",
        w: entry.data.src.width,
        h: entry.data.src.height,
        alt: entry.data.alt ?? "",
        preview: entry.data.preview, // LQIP from the loader
      };
    }),
  );

  return Response.json({ items, total: filtered.length });
};
```

This setup runs in Astro SSR mode (`output: "server"`) and scales to tens of thousands of photos because the initial HTML is constant-size and the client only keeps a sliding window of items in the DOM.

### Static gallery without a content collection

You don't need the loader at all — just `import.meta.glob`:

```astro
---
import JustifiedGallery from "@altner/astro-justified-gallery-layout/JustifiedGallery.astro";
import type { ImageMetadata } from "astro";

const modules = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/photos/*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);
const images = Object.values(modules).map((m) => ({ src: m.default }));
---

<JustifiedGallery images={images} chunkSize={30} />
```

No EXIF, no LQIP, no captions — but minimum setup.

## Comparison vs. flickr/justified-layout

| | This package (core) | flickr/justified-layout |
|---|---|---|
| Size | ~120 LOC, ~1kB min+gz | ~30kB minified |
| Module format | ESM only | UMD (Node-style) |
| Dependencies | 0 | several |
| TypeScript types | Bundled | DefinitelyTyped, often stale |
| Astro component | Bundled | — |
| Last release | Active | 2018 |

## License

MIT
