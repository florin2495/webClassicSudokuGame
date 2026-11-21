import { pwaIcon } from "@/lib/pwa-icon";

// Served here and linked from the layout metadata: Next 16.4 emits the file-based apple-icon link without basePath.
export function GET() {
  return pwaIcon(180);
}
