import { describe, expect, it } from "vitest";
import { checkFeedback } from "./feedback";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("formats minutes and hours", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(83_400)).toBe("1:23");
    expect(formatTime(3_723_000)).toBe("1:02:03");
    expect(formatTime(-5)).toBe("0:00");
  });
});

describe("checkFeedback", () => {
  it("accepts 1-1000 characters, trimmed", () => {
    expect(checkFeedback({ message: "  merge bine  " })).toEqual({ ok: true, skip: false, message: "merge bine" });
    expect(checkFeedback({ message: "x".repeat(1000) }).ok).toBe(true);
  });

  it("rejects empty, too long or missing messages", () => {
    for (const body of [{ message: "   " }, { message: "x".repeat(1001) }, {}, null, "text"]) expect(checkFeedback(body).ok).toBe(false);
  });

  it("silently drops honeypot posts", () => {
    expect(checkFeedback({ message: "spam", website: "http://x" })).toEqual({ ok: true, skip: true, message: "" });
  });
});
