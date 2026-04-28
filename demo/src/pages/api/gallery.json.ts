import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getImage } from "astro:assets";
import sharp from "sharp";
import { buildCaption } from "../../lib/caption";
import { filterByYearMonth } from "../../lib/dateFilter";

// Cache the collection across requests; only computed once per server start.
let _collection: Awaited<ReturnType<typeof getCollection<"photos">>> | null =
  null;

async function loadCollection() {
  if (!_collection) {
    _collection = await getCollection("photos");
  }
  return _collection;
}

// Cache LQIP previews per entry id; generation is somewhat expensive (sharp
// has to decode the source) but the result is tiny (~1–2 KB) and never
// changes for a given file.
const previewCache = new Map<string, string>();

async function buildPreview(
  entry: Awaited<ReturnType<typeof loadCollection>>[number],
): Promise<string> {
  if (previewCache.has(entry.id)) return previewCache.get(entry.id)!;
  const filePath = entry.filePath;
  if (!filePath) return "";
  try {
    const buf = await sharp(filePath)
      .rotate() // honor EXIF orientation
      .resize(32)
      .webp({ quality: 50 })
      .toBuffer();
    const dataUri = `data:image/webp;base64,${buf.toString("base64")}`;
    previewCache.set(entry.id, dataUri);
    return dataUri;
  } catch {
    return "";
  }
}

export const GET: APIRoute = async ({ url }) => {
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.max(
    1,
    Math.min(200, Number(url.searchParams.get("limit")) || 50),
  );
  const year = url.searchParams.get("year");
  const month = url.searchParams.get("month");

  const all = await loadCollection();
  const filtered = filterByYearMonth(all, year, month);
  const slice = filtered.slice(offset, offset + limit);

  const items = await Promise.all(
    slice.map(async (entry) => {
      const [optimized, preview] = await Promise.all([
        getImage({
          src: entry.data.src,
          widths: [400, 800, 1600],
          formats: ["webp"],
        }),
        buildPreview(entry),
      ]);
      return {
        src: optimized.src,
        srcset: optimized.srcSet?.attribute,
        sizes: "(max-width: 800px) 50vw, 25vw",
        w: entry.data.src.width,
        h: entry.data.src.height,
        alt: entry.data.alt ?? "",
        caption: buildCaption(entry.data.meta, entry.data.alt),
        preview,
      };
    }),
  );

  return new Response(
    JSON.stringify({
      items,
      total: filtered.length,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    },
  );
};
