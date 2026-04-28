// @ts-check
/**
 * Astro Content Loader for image galleries.
 *
 * Scans a directory for images and produces collection entries shaped to feed
 * `<JustifiedGallery />` directly. Image dimension resolution is delegated to
 * the consumer's schema via Astro's `image()` helper — we just emit paths.
 *
 * @example
 *   // src/content.config.ts
 *   import { defineCollection, z } from "astro:content";
 *   import { galleryLoader } from "@altner/astro-justified-gallery-layout/loader";
 *
 *   export const collections = {
 *     photos: defineCollection({
 *       loader: galleryLoader({ base: "./src/assets/photos" }),
 *       schema: ({ image }) => z.object({
 *         src: image(),
 *         alt: z.string().optional(),
 *       }),
 *     }),
 *   };
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { readPhotoMeta } from "./exif.js";

const DEFAULT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "gif"];

/**
 * @typedef {object} GalleryLoaderOptions
 * @property {string} base
 *   Directory to scan, relative to the project root (or absolute).
 * @property {string[]} [extensions]
 *   File extensions to include (without leading dot).
 *   Defaults to `["jpg", "jpeg", "png", "webp", "avif", "gif"]`.
 * @property {boolean} [recursive]
 *   Recurse into subdirectories. Defaults to `true`.
 * @property {(filePath: string) => string} [getAlt]
 *   Custom alt-text deriver. Receives the absolute file path; defaults to the
 *   filename without extension.
 * @property {(filePath: string) => boolean} [filter]
 *   Optional predicate to skip files (receives absolute path).
 * @property {boolean} [exif]
 *   When true, reads EXIF/IPTC/XMP/GPS metadata for each image and emits it
 *   as `data.meta` (a `PhotoMeta` object). Requires the optional `exifr`
 *   peer dependency. Missing fields are simply omitted; if `exifr` is not
 *   installed, this option is silently ignored.
 * @property {boolean | { width?: number, quality?: number }} [preview]
 *   When truthy, generates a tiny LQIP (low-quality image placeholder) per
 *   image via `sharp` and emits it as `data.preview` (a `data:image/webp;
 *   base64,…` URI, ~1–2 KB). Used by `<Lightbox />` for instant first paint.
 *   Defaults to `{ width: 32, quality: 50 }` when set to `true`. Requires
 *   `sharp` (already a transitive dep of Astro for image processing).
 */

/**
 * @param {GalleryLoaderOptions} opts
 * @returns {import("astro/loaders").Loader}
 */
export function galleryLoader(opts) {
  if (!opts || typeof opts.base !== "string") {
    throw new Error("galleryLoader: `base` is required");
  }

  const {
    base,
    extensions = DEFAULT_EXTENSIONS,
    recursive = true,
    getAlt = (file) => path.basename(file, path.extname(file)),
    filter,
    exif: readExif = false,
    preview: previewOpt = false,
  } = opts;

  const previewSettings = previewOpt
    ? {
        width:
          (typeof previewOpt === "object" && previewOpt.width) || 32,
        quality:
          (typeof previewOpt === "object" && previewOpt.quality) || 50,
      }
    : null;

  const extSet = new Set(
    extensions.map((e) => e.toLowerCase().replace(/^\./, "")),
  );
  const isImage = (name) =>
    extSet.has(path.extname(name).slice(1).toLowerCase());

  return {
    name: "@altner/astro-justified-gallery-layout/loader",

    async load(ctx) {
      const { store, logger, parseData, generateDigest, watcher } = ctx;
      const root = path.resolve(base);

      const sync = async () => {
        store.clear();

        /** @type {string[]} */
        const found = [];
        try {
          await walk(root, found, { recursive, isImage, filter });
        } catch (err) {
          if (err && /** @type {any} */ (err).code === "ENOENT") {
            logger.warn(`directory not found: ${root}`);
            return;
          }
          throw err;
        }

        found.sort();

        for (const fullPath of found) {
          const id = path.relative(root, fullPath).replace(/\\/g, "/");
          // image() resolves relative to the entry's filePath directory,
          // so we point filePath at the image itself (relative to the project
          // root, as required by the data store) and emit `./<basename>` as src.
          const filePath = path
            .relative(process.cwd(), fullPath)
            .replace(/\\/g, "/");
          const src = "./" + path.basename(fullPath);

          /** @type {Record<string, unknown>} */
          const entry = { src, alt: getAlt(fullPath) };
          if (readExif) {
            const meta = await readPhotoMeta(fullPath);
            if (meta) entry.meta = meta;
          }
          if (previewSettings) {
            const preview = await buildPreview(fullPath, previewSettings);
            if (preview) entry.preview = preview;
          }

          const data = await parseData({ id, data: entry });

          store.set({ id, data, filePath, digest: generateDigest(data) });
        }

        logger.info(`loaded ${found.length} image(s) from ${base}`);
      };

      await sync();

      if (watcher) {
        watcher.add(root);
        const refresh = () => {
          sync().catch((err) => logger.error(String(err)));
        };
        watcher.on("add", refresh);
        watcher.on("change", refresh);
        watcher.on("unlink", refresh);
      }
    },
  };
}

/**
 * @param {string} dir
 * @param {string[]} out
 * @param {{ recursive: boolean, isImage: (n: string) => boolean, filter?: (p: string) => boolean }} opts
 */
async function walk(dir, out, opts) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (opts.recursive) await walk(full, out, opts);
    } else if (entry.isFile() && opts.isImage(entry.name)) {
      if (opts.filter && !opts.filter(full)) continue;
      out.push(full);
    }
  }
}

/** @type {Promise<any> | null} */
let sharpPromise = null;
async function loadSharp() {
  if (sharpPromise) return sharpPromise;
  sharpPromise = import("sharp")
    .then((m) => m.default || m)
    .catch(() => null);
  return sharpPromise;
}

/**
 * Generate a tiny LQIP data URI for the given image. Returns null if `sharp`
 * is unavailable or processing fails.
 *
 * @param {string} filePath
 * @param {{ width: number, quality: number }} settings
 * @returns {Promise<string | null>}
 */
async function buildPreview(filePath, settings) {
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    const buf = await sharp(filePath)
      .rotate() // honor EXIF orientation
      .resize(settings.width)
      .webp({ quality: settings.quality })
      .toBuffer();
    return `data:image/webp;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
