import {
  formatCameraLine,
  type PhotoMeta,
} from "@altner/astro-justified-gallery-layout/exif";

const escMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => escMap[c]);

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function buildCaption(
  meta: PhotoMeta | undefined | null,
  fallbackTitle?: string,
): string | undefined {
  if (!meta && !fallbackTitle) return undefined;

  const parts: string[] = [];
  const title = meta?.iptc?.title ?? fallbackTitle;
  if (title) parts.push(`<div class="ajg-title">${esc(title)}</div>`);

  if (meta?.iptc?.description) {
    parts.push(`<div class="ajg-desc">${esc(meta.iptc.description)}</div>`);
  }

  const tech = formatCameraLine(meta);
  if (tech) parts.push(`<div class="ajg-tech">${esc(tech)}</div>`);

  const metaLine: string[] = [];
  if (meta?.dateTaken) metaLine.push(esc(dateFmt.format(meta.dateTaken)));
  if (meta?.gps) {
    const { latitude, longitude } = meta.gps;
    const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`;
    metaLine.push(
      `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">${latitude.toFixed(4)}, ${longitude.toFixed(4)}</a>`,
    );
  }
  if (metaLine.length) {
    parts.push(`<div class="ajg-meta">${metaLine.join(" · ")}</div>`);
  }

  const chips: string[] = [];

  if (meta?.iptc?.keywordsHierarchy?.length) {
    for (const path of meta.iptc.keywordsHierarchy.slice(0, 6)) {
      if (!path.length) continue;
      chips.push(
        `<span class="ajg-keyword">${path.map(esc).join(" › ")}</span>`,
      );
    }
  }

  if (meta?.iptc?.keywords?.length) {
    for (const k of meta.iptc.keywords.slice(0, 6)) {
      chips.push(`<span class="ajg-keyword">${esc(k)}</span>`);
    }
  }

  if (chips.length) {
    parts.push(`<div class="ajg-keywords">${chips.join("")}</div>`);
  }

  return parts.length ? parts.join("") : undefined;
}
