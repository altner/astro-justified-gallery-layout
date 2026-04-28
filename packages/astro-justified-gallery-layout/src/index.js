// @ts-check
/**
 * Justified layout — Flickr-style rows where each row spans the full container
 * width and items keep their aspect ratio. Pure ES module, zero deps.
 *
 * Algorithm
 * ---------
 * For each item we tentatively add it to the current row and compute the row
 * height that would be needed to make the row fit the container exactly:
 *
 *     rowHeight = (containerWidth - totalGaps) / sumOfAspectRatios
 *
 * As more items are added, that height shrinks. Once it falls at or below the
 * target height we close the row. The smart bit: we compare the height WITH
 * the new item (≤ target) against the height WITHOUT it (> target) and pick
 * whichever lands closer to the target. This avoids both over-tall single
 * items and squished thin rows.
 *
 * The last (incomplete) row is left-aligned at the target height instead of
 * being justified — stretching three landscape photos to fill 1500px would
 * look ridiculous.
 *
 * @typedef {object} Item
 * @property {number} w  Original width (any unit, only ratio matters)
 * @property {number} h  Original height
 *
 * @typedef {object} LayoutOptions
 * @property {number} containerWidth   Available width in CSS pixels.
 * @property {number} [targetRowHeight=240]  Aim for rows of roughly this height.
 * @property {number} [gap=6]                Gap between items (both axes).
 * @property {number} [maxRowHeight]         Cap for the last (partial) row.
 *
 * @typedef {object} Box
 * @property {number} index   Index of the source item in the input array.
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 *
 * @typedef {object} LayoutResult
 * @property {Box[]} boxes
 * @property {number} totalHeight
 */

/**
 * Compute a justified layout for `items`.
 *
 * @template {Item} T
 * @param {T[]} items
 * @param {LayoutOptions} opts
 * @returns {LayoutResult}
 */
export function computeLayout(items, opts) {
  const {
    containerWidth,
    targetRowHeight = 240,
    gap = 6,
    maxRowHeight = targetRowHeight * 1.5,
  } = opts;

  if (containerWidth <= 0 || items.length === 0) {
    return { boxes: [], totalHeight: 0 };
  }

  /** @type {{ index: number, aspect: number }[]} */
  let row = [];
  let aspectSum = 0;
  /** @type {{ items: { index: number, aspect: number }[], height: number, lastRow?: boolean }[]} */
  const rows = [];

  const heightFor = (count, sum) => {
    const gapsTotal = Math.max(0, count - 1) * gap;
    return (containerWidth - gapsTotal) / sum;
  };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const aspect = Math.max(0.2, it.w / it.h);
    row.push({ index: i, aspect });
    aspectSum += aspect;

    const heightWith = heightFor(row.length, aspectSum);

    if (heightWith <= targetRowHeight) {
      if (row.length > 1) {
        const prevSum = aspectSum - aspect;
        const heightWithout = heightFor(row.length - 1, prevSum);
        if (Math.abs(targetRowHeight - heightWithout) < Math.abs(targetRowHeight - heightWith)) {
          // Closing one item earlier lands closer to target.
          rows.push({ items: row.slice(0, -1), height: heightWithout });
          row = [{ index: i, aspect }];
          aspectSum = aspect;
          continue;
        }
      }
      rows.push({ items: row, height: heightWith });
      row = [];
      aspectSum = 0;
    }
  }

  if (row.length) {
    const natural = heightFor(row.length, aspectSum);
    rows.push({
      items: row,
      height: Math.min(targetRowHeight, natural, maxRowHeight),
      lastRow: true,
    });
  }

  /** @type {Box[]} */
  const boxes = new Array(items.length);
  let top = 0;
  for (const r of rows) {
    let left = 0;
    for (const { index, aspect } of r.items) {
      const width = aspect * r.height;
      boxes[index] = {
        index,
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(width),
        height: Math.round(r.height),
      };
      left += width + gap;
    }
    top += r.height + gap;
  }

  return { boxes, totalHeight: Math.max(0, Math.round(top - gap)) };
}
