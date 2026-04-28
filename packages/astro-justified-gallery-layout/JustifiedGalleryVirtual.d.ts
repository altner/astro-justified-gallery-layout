/**
 * Shape of an item returned by the gallery API endpoint.
 * Build the response server-side via `getImage()` from `astro:assets` to
 * pre-compute optimized URLs and srcsets.
 */
export interface VirtualGalleryItem {
  /** Optimized image URL (e.g. from `getImage().src`). */
  src: string;
  /** Optional srcset (e.g. from `getImage().srcSet?.attribute`). */
  srcset?: string;
  /** Optional sizes attribute. */
  sizes?: string;
  /** Original width in pixels (for aspect ratio). */
  w: number;
  /** Original height in pixels (for aspect ratio). */
  h: number;
  /** Optional alt text. */
  alt?: string;
  /**
   * Optional caption HTML rendered as a hover-revealed overlay. Trusted
   * source assumed — content is set via `innerHTML` and is **not** sanitized.
   * Use only with metadata you control.
   */
  caption?: string;
  /** Optional link href; wraps the item in an `<a>`. */
  href?: string;
  /**
   * Optional tiny LQIP preview (typically a `data:image/webp;base64,...` URI).
   * When present, `<Lightbox />` paints it instantly while the high-res
   * variant loads.
   */
  preview?: string;
}

/**
 * Expected JSON shape for the endpoint:
 *   GET /your/endpoint?offset=N&limit=K
 *   → { items: VirtualGalleryItem[], total: number }
 */
export interface VirtualGalleryResponse {
  items: VirtualGalleryItem[];
  total: number;
}

export interface Props {
  /** Endpoint URL that returns paginated photo metadata as JSON. */
  endpoint: string;
  targetRowHeight?: number;
  gap?: number;
  /** Items per fetched chunk. Default 50. */
  chunkSize?: number;
  /** Extra rows above/below the viewport to keep in the DOM. Default 5. */
  bufferRows?: number;
  class?: string;
}
