import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classic Sudoku",
  applicationName: "Classic Sudoku",
  appleWebApp: { capable: true, title: "Classic Sudoku", statusBarStyle: "black-translucent" },
  // Metadata icon URLs are not prefixed with basePath; keep "/classicsudoku" in sync with next.config.ts.
  icons: {
    icon: [{ url: "/classicsudoku/pwa-icons/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/classicsudoku/pwa-icons/apple", sizes: "180x180", type: "image/png" }],
  },
  other: { "apple-mobile-web-app-capable": "yes", "mobile-web-app-capable": "yes" },
  description: "Sudoku clasic 9×9, Samurai cu 5 grile și Bradul de Crăciun. Fără reclame, merge și fără internet.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b7a2e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
