// Validation of a feedback message (POST /api/feedback). Pure, unit-tested.
export type FeedbackCheck = { ok: true; skip: boolean; message: string } | { ok: false; error: string };

export function checkFeedback(body: unknown): FeedbackCheck {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  // Honeypot: real users never fill it. Pretend success, store nothing.
  if (typeof b.website === "string" && b.website.trim() !== "") return { ok: true, skip: true, message: "" };
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length < 1 || message.length > 1000) return { ok: false, error: "Mesajul trebuie să aibă 1-1000 caractere." };
  return { ok: true, skip: false, message };
}
