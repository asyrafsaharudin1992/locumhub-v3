import { LocumSlot } from "./types";

/**
 * Per-doctor slot visibility restrictions.
 *
 * Admins can quietly limit which shift times a doctor sees on the booking
 * page (e.g. only "8pm-10pm"). Restricted slots are simply filtered out —
 * the doctor is never told a restriction exists.
 *
 * Times are compared by a normalised key ("20:00-22:00") rather than the raw
 * label, because the same shift is typed in several ways ("8-10pm",
 * "8pm-10pm", "8pm - 10pm").
 */

export type SlotRestrictionMap = Record<string, string[]>;

export function normalizeRestrictionPhone(value: string): string {
  return String(value || "").replace(/\D/g, "").replace(/^60/, "0");
}

/** "8-10pm" / "8pm-10pm" → "20:00-22:00". Falls back to the cleaned label
 * when the text can't be parsed, so odd labels can still be matched exactly. */
export function slotTimeKey(masa: string): string {
  const clean = String(masa || "").toLowerCase().replace(/\s+/g, "");
  const parts = clean.split("-");
  if (parts.length !== 2) return clean;

  const parseOne = (s: string, fallbackMeridiem?: "am" | "pm") => {
    const match = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/);
    if (!match) return null;
    const meridiem = (match[3] as "am" | "pm" | undefined) || fallbackMeridiem;
    if (!meridiem) return null;
    let hour = parseInt(match[1], 10) % 12;
    if (meridiem === "pm") hour += 12;
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const endMeridiem = parts[1].match(/(am|pm)$/)?.[1] as "am" | "pm" | undefined;
  const end = parseOne(parts[1]);
  const start = parseOne(parts[0], endMeridiem);
  if (!start || !end) return clean;
  return `${start}-${end}`;
}

/** Distinct shift times present in the given slots, one readable label per key. */
export function collectSlotTimeOptions(slots: LocumSlot[]): { key: string; label: string }[] {
  const byKey = new Map<string, string>();
  slots.forEach((slot) => {
    const branch = String(slot.cawangan || "").toLowerCase();
    if (branch.includes("cme") || branch.includes("briefing")) return;
    const label = String(slot.masa || "").trim();
    if (!label) return;
    const key = slotTimeKey(label);
    if (!byKey.has(key)) byKey.set(key, label);
  });
  return Array.from(byKey, ([key, label]) => ({ key, label })).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/** `allowedTimes` null/empty means no restriction. */
export function isSlotAllowed(slot: LocumSlot, allowedTimes: string[] | null | undefined): boolean {
  if (!allowedTimes || allowedTimes.length === 0) return true;
  return allowedTimes.includes(slotTimeKey(slot.masa));
}
