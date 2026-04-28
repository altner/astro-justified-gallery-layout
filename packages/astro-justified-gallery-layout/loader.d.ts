import type { Loader } from "astro/loaders";

export interface GalleryLoaderOptions {
  /** Directory to scan, relative to the project root (or absolute). */
  base: string;
  /**
   * File extensions to include (without leading dot).
   * Defaults to `["jpg", "jpeg", "png", "webp", "avif", "gif"]`.
   */
  extensions?: string[];
  /** Recurse into subdirectories. Defaults to `true`. */
  recursive?: boolean;
  /**
   * Custom alt-text deriver. Receives the absolute file path; defaults to the
   * filename without extension.
   */
  getAlt?: (filePath: string) => string;
  /** Optional predicate to skip files (receives absolute path). */
  filter?: (filePath: string) => boolean;
  /**
   * When true, reads EXIF/IPTC/XMP/GPS metadata for each image and emits it
   * as `data.meta`. Requires the optional `exifr` peer dependency. Missing
   * fields are simply omitted; if `exifr` is not installed, the option is
   * silently ignored.
   */
  exif?: boolean;
  /**
   * When truthy, generates a tiny LQIP per image via `sharp` and emits it as
   * `data.preview` (a `data:image/webp;base64,…` URI). Used by `<Lightbox />`
   * for instant first paint. Defaults to `{ width: 32, quality: 50 }` when
   * set to `true`.
   */
  preview?: boolean | { width?: number; quality?: number };
}

/**
 * Astro Content Loader that scans a directory for images and emits entries
 * with `{ src, alt }` data, ready to be validated by an `image()` schema.
 */
export function galleryLoader(opts: GalleryLoaderOptions): Loader;
