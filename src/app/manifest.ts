import type { MetadataRoute } from "next";

// Its own installable app (separate from the haiLaTăticu hub app): own id and scope "/classicsudoku", so on Android
// it gets its own icon and opens straight into the game, full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Classic Sudoku",
    short_name: "Sudoku", // launcher label: "Classic Sudoku" (14 chars) can get cut on Android home screens
    description: "Sudoku clasic 9×9, Samurai cu 5 grile și Bradul de Crăciun. Fără reclame, merge și fără internet.",
    id: "/classicsudoku/",
    start_url: "/classicsudoku",
    scope: "/classicsudoku",
    display: "standalone",
    orientation: "any",
    lang: "ro",
    background_color: "#0b7a2e",
    theme_color: "#0b7a2e",
    icons: [
      { src: "/classicsudoku/pwa-icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/classicsudoku/pwa-icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/classicsudoku/pwa-icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
