// The three boards: cells, units (every group that must hold 1..9 once) and regions (for the thick lines).
// Pure, unit-tested. A cell is a position `r * width + c` in the bounding rectangle; Samurai leaves some of the
// 21×21 positions out (`active` false), the other two variants use all 81.

export type Variant = "classic" | "samurai" | "tree";
export const VARIANTS: readonly Variant[] = ["classic", "samurai", "tree"];

export const VARIANT_NAMES: Record<Variant, string> = {
  classic: "Clasic 9×9",
  samurai: "Samurai (5 grile)",
  tree: "Bradul de Crăciun",
};

export function isVariant(x: unknown): x is Variant {
  return x === "classic" || x === "samurai" || x === "tree";
}

export interface Geometry {
  variant: Variant;
  width: number;
  height: number;
  /** width * height (positions, active or not). */
  size: number;
  active: boolean[];
  /** Active positions, in reading order. */
  cells: number[];
  /** Every group of 9 cells that holds 1..9 exactly once (rows, columns, boxes / regions). */
  units: number[][];
  /** Units of each position (empty for inactive ones). */
  unitsOf: number[][];
  /** Every other cell that shares a unit with this one. */
  peers: number[][];
  /** member[u * size + p] = 1 when position p is in unit u. */
  member: Uint8Array;
  /** Region id (box or jigsaw piece) for the thick lines; -1 for inactive positions. */
  region: number[];
  /** Background: 0 plain, 1 tree, 2 trunk, 3 star (Christmas tree only). */
  shade: number[];
  /** Top-left corner (row, col) of every 9×9 grid. */
  grids: { row: number; col: number }[];
}

/**
 * Christmas tree layout (jigsaw): 9 pieces of 9 cells. T, M and R are the tree (top, middle, bottom with the
 * trunk), the other six fill the sky and the ground. Mirror-symmetric left/right.
 */
export const TREE_LAYOUT = [
  "AAAATBBBB",
  "AAAATBBBB",
  "ACCTTTDDB",
  "CCCTTTDDD",
  "CCMMTMMDD",
  "CCMMMMMDD",
  "ERRRRRRRF",
  "EEEERFFFF",
  "EEEERFFFF",
];

/** Samurai (Gattai-5): four corner grids and one in the middle that shares a 3×3 box with each of them. */
const SAMURAI_GRIDS = [
  { row: 0, col: 0 },
  { row: 0, col: 12 },
  { row: 6, col: 6 },
  { row: 12, col: 0 },
  { row: 12, col: 12 },
];

function finish(
  variant: Variant,
  width: number,
  height: number,
  active: boolean[],
  units: number[][],
  region: number[],
  shade: number[],
  grids: { row: number; col: number }[],
): Geometry {
  const size = width * height;
  const cells: number[] = [];
  for (let p = 0; p < size; p++) if (active[p]) cells.push(p);
  const unitsOf: number[][] = Array.from({ length: size }, () => []);
  const member = new Uint8Array(units.length * size);
  units.forEach((u, i) => {
    for (const p of u) {
      unitsOf[p].push(i);
      member[i * size + p] = 1;
    }
  });
  const peers = Array.from({ length: size }, (_, p) => {
    const s = new Set<number>();
    for (const u of unitsOf[p]) for (const q of units[u]) if (q !== p) s.add(q);
    return [...s].sort((a, b) => a - b);
  });
  return { variant, width, height, size, active, cells, units, unitsOf, peers, member, region, shade, grids };
}

/** Rows, columns and 3×3 boxes of 9×9 grids placed on a width×height board (boxes shared by two grids count once). */
function boxedGrids(variant: Variant, width: number, height: number, grids: { row: number; col: number }[]): Geometry {
  const size = width * height;
  const active = new Array<boolean>(size).fill(false);
  const units: number[][] = [];
  const boxes = new Map<number, number[]>();
  for (const { row, col } of grids) {
    for (let i = 0; i < 9; i++) {
      units.push(Array.from({ length: 9 }, (_, j) => (row + i) * width + col + j));
      units.push(Array.from({ length: 9 }, (_, j) => (row + j) * width + col + i));
    }
    for (let r = row; r < row + 9; r++) {
      for (let c = col; c < col + 9; c++) {
        const p = r * width + c;
        active[p] = true;
        const key = Math.floor(r / 3) * width + Math.floor(c / 3);
        const box = boxes.get(key) ?? [];
        if (!box.includes(p)) box.push(p);
        boxes.set(key, box);
      }
    }
  }
  for (const box of boxes.values()) units.push(box.sort((a, b) => a - b));
  const region = Array.from({ length: size }, (_, p) =>
    active[p] ? Math.floor(Math.floor(p / width) / 3) * width + Math.floor((p % width) / 3) : -1,
  );
  return finish(variant, width, height, active, units, region, new Array<number>(size).fill(0), grids);
}

function treeGeometry(): Geometry {
  const width = 9;
  const size = 81;
  const letters = TREE_LAYOUT.join("");
  const ids = [...new Set(letters)];
  const region = [...letters].map((ch) => ids.indexOf(ch));
  const units: number[][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(Array.from({ length: 9 }, (_, j) => i * width + j));
    units.push(Array.from({ length: 9 }, (_, j) => j * width + i));
  }
  for (let id = 0; id < ids.length; id++) units.push(region.flatMap((r, p) => (r === id ? [p] : [])));
  const shade = [...letters].map((ch, p) => {
    if (p === 4) return 3; // the star on top
    if (ch === "R" && Math.floor(p / 9) >= 7) return 2; // trunk
    return ch === "T" || ch === "M" || ch === "R" ? 1 : 0;
  });
  return finish("tree", width, 9, new Array<boolean>(size).fill(true), units, region, shade, [{ row: 0, col: 0 }]);
}

const cache = new Map<Variant, Geometry>();

export function geometry(variant: Variant): Geometry {
  let g = cache.get(variant);
  if (!g) {
    g =
      variant === "samurai"
        ? boxedGrids("samurai", 21, 21, SAMURAI_GRIDS)
        : variant === "tree"
          ? treeGeometry()
          : boxedGrids("classic", 9, 9, [{ row: 0, col: 0 }]);
    cache.set(variant, g);
  }
  return g;
}
