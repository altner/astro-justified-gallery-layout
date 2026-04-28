export interface DatedPhoto {
  data: { meta?: { dateTaken?: Date } };
}

export interface YearMonthStats {
  /** "YYYY" → number of photos in that year */
  yearCount: Map<string, number>;
  /** "YYYY-MM" → number of photos in that year+month */
  ymCount: Map<string, number>;
  /** Photos without a parseable `dateTaken`. */
  undated: number;
}

export function computeYearMonthStats<T extends DatedPhoto>(
  photos: readonly T[],
): YearMonthStats {
  const yearCount = new Map<string, number>();
  const ymCount = new Map<string, number>();
  let undated = 0;
  for (const p of photos) {
    const d = p.data.meta?.dateTaken;
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      undated++;
      continue;
    }
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    yearCount.set(y, (yearCount.get(y) ?? 0) + 1);
    const ym = `${y}-${m}`;
    ymCount.set(ym, (ymCount.get(ym) ?? 0) + 1);
  }
  return { yearCount, ymCount, undated };
}

export function monthsForYear(
  ymCount: Map<string, number>,
  year: string | null | undefined,
): { month: string; count: number }[] {
  const monthCounts = new Map<string, number>();
  for (const [ym, n] of ymCount) {
    const [y, m] = ym.split("-");
    if (year && y !== year) continue;
    monthCounts.set(m, (monthCounts.get(m) ?? 0) + n);
  }
  return [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

export function filterByYearMonth<T extends DatedPhoto>(
  photos: readonly T[],
  year: string | null | undefined,
  month: string | null | undefined,
): T[] {
  if (!year && !month) return [...photos];
  return photos.filter((p) => {
    const d = p.data.meta?.dateTaken;
    if (!(d instanceof Date) || isNaN(d.getTime())) return false;
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    if (year && y !== year) return false;
    if (month && m !== month) return false;
    return true;
  });
}

export function monthName(m: string): string {
  return new Date(2000, Number(m) - 1, 1).toLocaleString("de-DE", {
    month: "long",
  });
}
