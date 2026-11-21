import { ImageResponse } from "next/og";

// Opaque app icon: a white sudoku box (3×3 cells with a few digits) on the green background.
// `inset` shrinks the artwork (maskable icons keep it inside the central 80%).
const DIGITS = ["5", "", "3", "", "7", "", "9", "", "1"];

export function pwaIcon(px: number, inset = 1): ImageResponse {
  const side = px * inset * 0.7;
  const frame = Math.max(2, px * 0.012);
  const cell = (side - 2 * frame) / 3 - 0.01; // the frame is inside the box's width (border-box)
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b7a2e" }}>
        <div
          style={{
            width: side,
            height: side,
            display: "flex",
            flexWrap: "wrap",
            background: "#ffffff",
            borderRadius: side * 0.08,
            border: `${frame}px solid #1f2937`,
            overflow: "hidden",
            boxShadow: `0 ${px * 0.01}px ${px * 0.03}px rgba(0,0,0,0.35)`,
          }}
        >
          {DIGITS.map((d, i) => (
            <div
              key={i}
              style={{
                width: cell,
                height: cell,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRight: i % 3 < 2 ? `${Math.max(1, px * 0.005)}px solid #9ca3af` : "none",
                borderBottom: i < 6 ? `${Math.max(1, px * 0.005)}px solid #9ca3af` : "none",
                fontSize: cell * 0.62,
                fontWeight: 700,
                color: i === 4 ? "#0b7a2e" : "#141414",
              }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
