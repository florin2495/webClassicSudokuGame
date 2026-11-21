import { connection, NextResponse } from "next/server";
import pkg from "../../../../package.json";

// GET /classicsudoku/api/version -> { version } of the deployment that answers. UpdateButton compares it with the
// version the open page was built with and offers a reload when a newer one is live.
export async function GET() {
  await connection(); // always request-time, never prerendered at build
  return NextResponse.json({ version: pkg.version }, { headers: { "Cache-Control": "no-store" } });
}
