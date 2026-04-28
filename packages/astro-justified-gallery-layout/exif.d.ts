export interface CameraInfo {
  make?: string;
  model?: string;
  lens?: string;
  /** Focal length in mm. */
  focalLength?: number;
  /** Aperture (f-stop). */
  fNumber?: number;
  /** Exposure time in seconds (e.g. `0.004` ≈ `1/250s`). */
  exposureTime?: number;
  iso?: number;
}

export interface GpsInfo {
  latitude: number;
  longitude: number;
}

export interface IptcInfo {
  title?: string;
  description?: string;
  /** Flat keyword list. Pipe-separated paths and segments already covered by a
   *  hierarchy entry are filtered out — they live in `keywordsHierarchy`. */
  keywords?: string[];
  /** Hierarchical keywords (Lightroom `lr:hierarchicalSubject`). Each entry is
   *  an array of segments from root to leaf, e.g. `["Travel","Asia","Thailand"]`. */
  keywordsHierarchy?: string[][];
}

export interface PhotoMeta {
  camera?: CameraInfo;
  dateTaken?: Date;
  gps?: GpsInfo;
  iptc?: IptcInfo;
}

/**
 * Read EXIF/IPTC/XMP/GPS data from an image and return a normalized
 * `PhotoMeta`. Returns `null` when `exifr` is not installed or the file has
 * no parseable metadata.
 */
export function readPhotoMeta(
  input: string | Buffer | Uint8Array | ArrayBuffer,
): Promise<PhotoMeta | null>;

/**
 * Compact one-line camera/exposure summary. Returns `null` if `meta.camera`
 * is missing or empty.
 */
export function formatCameraLine(
  meta: PhotoMeta | null | undefined,
): string | null;
