export interface Item {
  /** Original width — only the ratio matters. */
  w: number;
  /** Original height. */
  h: number;
}

export interface LayoutOptions {
  /** Available container width in CSS pixels. */
  containerWidth: number;
  /** Target row height to aim for. Default `240`. */
  targetRowHeight?: number;
  /** Gap between items on both axes. Default `6`. */
  gap?: number;
  /** Cap for the trailing partial row. Default `targetRowHeight * 1.5`. */
  maxRowHeight?: number;
}

export interface Box {
  /** Index into the input items array. */
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  /** Positioned boxes in input order. */
  boxes: Box[];
  /** Total height of the laid-out grid (including the last row, no trailing gap). */
  totalHeight: number;
}

export function computeLayout<T extends Item>(items: T[], opts: LayoutOptions): LayoutResult;
