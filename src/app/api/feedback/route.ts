import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkFeedback } from "@/lib/feedback";

const GAME = "sudoku";
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? null;

// POST /classicsudoku/api/feedback - store a short player message in the hub's shared hub_feedback table.
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const check = checkFeedback(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  if (check.skip) return NextResponse.json({ ok: true });
  try {
    const { error } = await db().from("hub_feedback").insert({ game: GAME, message: check.message, nickname: null, app_version: VERSION });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("feedback insert failed", err);
    return NextResponse.json({ error: "Nu am putut trimite mesajul. Încearcă din nou." }, { status: 500 });
  }
}
