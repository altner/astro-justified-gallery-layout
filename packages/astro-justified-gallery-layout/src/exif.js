// @ts-check
/**
 * Thin helper around `exifr` (optional peer dependency) that extracts EXIF
 * (camera), IPTC (title/description/keywords), and GPS data and normalizes
 * them into a single typed shape. Every field is optional — only what's
 * actually present in the file is returned.
 */

/**
 * @typedef {object} CameraInfo
 * @property {string} [make]
 * @property {string} [model]
 * @property {string} [lens]
 * @property {number} [focalLength]   In mm.
 * @property {number} [fNumber]       Aperture (f-stop).
 * @property {number} [exposureTime]  Seconds (e.g. 0.004 for 1/250).
 * @property {number} [iso]
 *
 * @typedef {object} GpsInfo
 * @property {number} latitude
 * @property {number} longitude
 *
 * @typedef {object} IptcInfo
 * @property {string} [title]
 * @property {string} [description]
 * @property {string[]} [keywords]
 *   Flat keyword list (typically IPTC `Keywords` / XMP `dc:subject`), with
 *   pipe-separated paths and segments already covered by a hierarchy entry
 *   removed.
 * @property {string[][]} [keywordsHierarchy]
 *   Hierarchical keywords (Lightroom `lr:hierarchicalSubject`). Each entry is
 *   an array of segments from root to leaf, e.g. `["Travel","Asia","Thailand"]`.
 *   Only deepest-leaf paths are returned — Lightroom writes every ancestor
 *   level as a separate entry, and we collapse those to the longest matching
 *   path.
 *
 * @typedef {object} PhotoMeta
 * @property {CameraInfo} [camera]
 * @property {Date} [dateTaken]
 * @property {GpsInfo} [gps]
 * @property {IptcInfo} [iptc]
 */

/** @type {Promise<typeof import("exifr") | null> | null} */
let exifrPromise = null;

async function loadExifr() {
  if (exifrPromise) return exifrPromise;
  exifrPromise = import("exifr")
    .then((m) => m.default || m)
    .catch(() => null);
  return exifrPromise;
}

/**
 * Read EXIF/IPTC/XMP/GPS data from an image file and return a normalized
 * `PhotoMeta` object. Returns `null` when `exifr` is not installed or the file
 * has no parseable metadata.
 *
 * @param {string | Buffer | Uint8Array | ArrayBuffer} input
 *   File path or buffer accepted by `exifr.parse()`.
 * @returns {Promise<PhotoMeta | null>}
 */
export async function readPhotoMeta(input) {
  const exifr = await loadExifr();
  if (!exifr) return null;

  let raw;
  try {
    raw = await exifr.parse(input, {
      ifd0: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      reviveValues: true,
      sanitize: true,
    });
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;

  /** @type {PhotoMeta} */
  const out = {};

  // Camera
  /** @type {CameraInfo} */
  const cam = {};
  if (typeof raw.Make === "string") cam.make = raw.Make.trim();
  if (typeof raw.Model === "string") cam.model = raw.Model.trim();
  const lens = raw.LensModel || raw.Lens || raw.LensInfo;
  if (typeof lens === "string") cam.lens = lens.trim();
  if (typeof raw.FocalLength === "number") cam.focalLength = raw.FocalLength;
  if (typeof raw.FNumber === "number") cam.fNumber = raw.FNumber;
  if (typeof raw.ExposureTime === "number") cam.exposureTime = raw.ExposureTime;
  const iso = raw.ISO ?? raw.ISOSpeedRatings ?? raw.PhotographicSensitivity;
  if (typeof iso === "number") cam.iso = iso;
  if (Object.keys(cam).length) out.camera = cam;

  // Date
  const date =
    raw.DateTimeOriginal || raw.CreateDate || raw.DateTime || raw.dateCreated;
  if (date instanceof Date && !isNaN(date.getTime())) {
    out.dateTaken = date;
  } else if (typeof date === "string") {
    const d = new Date(date);
    if (!isNaN(d.getTime())) out.dateTaken = d;
  }

  // GPS — exifr exposes `latitude`/`longitude` as decimals when `gps: true`.
  if (
    typeof raw.latitude === "number" &&
    typeof raw.longitude === "number" &&
    Number.isFinite(raw.latitude) &&
    Number.isFinite(raw.longitude)
  ) {
    out.gps = { latitude: raw.latitude, longitude: raw.longitude };
  }

  // IPTC + XMP
  /** @type {IptcInfo} */
  const iptc = {};
  const title =
    raw.ObjectName ||
    raw.title ||
    raw.Title ||
    raw.Headline ||
    raw["dc:title"];
  if (typeof title === "string" && title.trim()) iptc.title = title.trim();
  else if (title && typeof title === "object" && typeof title.value === "string")
    iptc.title = title.value.trim();

  const desc =
    raw.Caption ||
    raw["Caption-Abstract"] ||
    raw.description ||
    raw.Description ||
    raw.ImageDescription ||
    raw["dc:description"];
  if (typeof desc === "string" && desc.trim()) iptc.description = desc.trim();
  else if (desc && typeof desc === "object" && typeof desc.value === "string")
    iptc.description = desc.value.trim();

  const kw = raw.Keywords ?? raw.subject ?? raw["dc:subject"];
  /** @type {string[]} */
  let keywords = [];
  if (Array.isArray(kw)) keywords = kw.filter((k) => typeof k === "string");
  else if (typeof kw === "string") keywords = [kw];
  keywords = keywords.map((k) => k.trim()).filter(Boolean);

  // Hierarchical keywords. Sources, in order of preference:
  //  - XMP `lr:hierarchicalSubject` (canonical, written by Lightroom)
  //  - Pipe-separated entries in flat keywords (Lightroom export option
  //    "Write Keywords as Lightroom Hierarchy")
  /** @type {unknown} */
  const hierRaw =
    raw.HierarchicalSubject ??
    raw["lr:hierarchicalSubject"] ??
    raw.hierarchicalSubject;
  /** @type {string[]} */
  let hierStrings = [];
  if (Array.isArray(hierRaw))
    hierStrings = hierRaw.filter((x) => typeof x === "string");
  else if (typeof hierRaw === "string") hierStrings = [hierRaw];

  for (const k of keywords) if (k.includes("|")) hierStrings.push(k);

  /** @type {string[][]} */
  const allPaths = [];
  const seenPaths = new Set();
  for (const s of hierStrings) {
    const segs = s
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!segs.length) continue;
    const key = segs.map((x) => x.toLowerCase()).join("␟");
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    allPaths.push(segs);
  }

  // Lightroom writes every ancestor level (e.g. "WHERE", "WHERE|Thailand",
  // "WHERE|Thailand|Chiang Mai"). Keep only paths that are NOT a prefix of
  // some other longer path — i.e. only the deepest-leaf paths.
  const isPrefixOf = (short, long) =>
    short.length < long.length &&
    short.every((seg, i) => seg.toLowerCase() === long[i].toLowerCase());

  /** @type {string[][]} */
  const keywordsHierarchy = allPaths.filter(
    (p) => !allPaths.some((other) => isPrefixOf(p, other)),
  );

  // Drop pipe-separated entries from the flat list, plus any flat tag that
  // already appears as a segment in any hierarchy path.
  const inAnyHierarchy = new Set(
    keywordsHierarchy.flat().map((s) => s.toLowerCase()),
  );
  keywords = keywords.filter(
    (k) => !k.includes("|") && !inAnyHierarchy.has(k.toLowerCase()),
  );

  if (keywords.length) iptc.keywords = keywords;
  if (keywordsHierarchy.length) iptc.keywordsHierarchy = keywordsHierarchy;

  if (Object.keys(iptc).length) out.iptc = iptc;

  return Object.keys(out).length ? out : null;
}

/**
 * Build a compact one-line camera/exposure string from a `PhotoMeta` object.
 * Returns `null` if no relevant fields are present.
 *
 * @param {PhotoMeta | null | undefined} meta
 * @returns {string | null}
 */
export function formatCameraLine(meta) {
  if (!meta || !meta.camera) return null;
  const c = meta.camera;
  const parts = [];

  const body = [c.make, c.model].filter(Boolean).join(" ");
  if (body) parts.push(body);
  if (c.lens && c.lens !== body) parts.push(c.lens);
  if (typeof c.focalLength === "number")
    parts.push(`${Math.round(c.focalLength)}mm`);
  if (typeof c.fNumber === "number") parts.push(`f/${c.fNumber}`);
  if (typeof c.exposureTime === "number") {
    parts.push(
      c.exposureTime >= 1
        ? `${c.exposureTime}s`
        : `1/${Math.round(1 / c.exposureTime)}s`,
    );
  }
  if (typeof c.iso === "number") parts.push(`ISO ${c.iso}`);

  return parts.length ? parts.join(" · ") : null;
}
