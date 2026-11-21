import { describe, expect, it } from "vitest";
import { geometry, TREE_LAYOUT, VARIANTS } from "./geometry";

describe("geometry", () => {
  it("classic: 81 cells, 27 units of 9, 20 peers each", () => {
    const g = geometry("classic");
    expect(g.cells).toHaveLength(81);
    expect(g.units).toHaveLength(27);
    for (const p of g.cells) {
      expect(g.peers[p]).toHaveLength(20);
      expect(g.unitsOf[p]).toHaveLength(3);
    }
  });

  it("every unit has 9 different active cells and every cell is in a region", () => {
    for (const v of VARIANTS) {
      const g = geometry(v);
      for (const u of g.units) {
        expect(new Set(u).size).toBe(9);
        for (const p of u) expect(g.active[p]).toBe(true);
      }
      for (const p of g.cells) expect(g.region[p]).toBeGreaterThanOrEqual(0);
      expect(g.cells.length % 9).toBe(0);
    }
  });

  it("samurai: 5 grids on 21×21, 369 cells, the 4 corner boxes are shared by two grids", () => {
    const g = geometry("samurai");
    expect(g.width).toBe(21);
    expect(g.height).toBe(21);
    expect(g.cells).toHaveLength(369);
    expect(g.grids).toHaveLength(5);
    // 5 grids × (9 rows + 9 columns) + 41 different boxes (45 minus the 4 shared ones).
    expect(g.units).toHaveLength(5 * 18 + 41);
    // The gaps between the corner grids are not part of the board.
    expect(g.active[0 * 21 + 10]).toBe(false);
    expect(g.active[10 * 21 + 0]).toBe(false);
    expect(g.active[10 * 21 + 10]).toBe(true);
    // A cell of a shared box: 2 rows, 2 columns, 1 box.
    const shared = 7 * 21 + 7;
    expect(g.unitsOf[shared]).toHaveLength(5);
    // Its row in the top-left grid and its row in the middle grid are different units.
    const plain = 1 * 21 + 1;
    expect(g.unitsOf[plain]).toHaveLength(3);
    expect(g.peers[plain]).toHaveLength(20);
    expect(g.peers[shared].length).toBeGreaterThan(20);
    // Rows stop at their grid: the top-left grid's row 0 does not reach the top-right grid.
    expect(g.peers[0].includes(12)).toBe(false);
  });

  it("christmas tree: 9 connected pieces of 9 cells, the tree is 3 pieces (27 cells) with a trunk and a star", () => {
    const g = geometry("tree");
    expect(TREE_LAYOUT.every((row) => row.length === 9)).toBe(true);
    expect(g.units).toHaveLength(27);
    const regions = new Map<number, number[]>();
    g.cells.forEach((p) => regions.set(g.region[p], [...(regions.get(g.region[p]) ?? []), p]));
    expect(regions.size).toBe(9);
    for (const cells of regions.values()) {
      expect(cells).toHaveLength(9);
      // Connected: a flood fill from the first cell reaches all 9.
      const seen = new Set([cells[0]]);
      const todo = [cells[0]];
      while (todo.length) {
        const p = todo.pop()!;
        const r = Math.floor(p / 9);
        const c = p % 9;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const q = (r + dr) * 9 + c + dc;
          if (r + dr < 0 || r + dr > 8 || c + dc < 0 || c + dc > 8 || seen.has(q) || !cells.includes(q)) continue;
          seen.add(q);
          todo.push(q);
        }
      }
      expect(seen.size).toBe(9);
    }
    const tree = g.cells.filter((p) => g.shade[p] > 0);
    expect(tree).toHaveLength(27);
    expect(g.shade[4]).toBe(3); // star on top
    expect(g.shade[7 * 9 + 4]).toBe(2); // trunk
    expect(g.shade[8 * 9 + 4]).toBe(2);
    // Left-right mirror image.
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) expect(g.shade[r * 9 + c]).toBe(g.shade[r * 9 + 8 - c]);
  });
});
