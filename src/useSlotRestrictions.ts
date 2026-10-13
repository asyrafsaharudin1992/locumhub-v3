import { useCallback, useEffect, useState } from "react";
import { normalizeRestrictionPhone, SlotRestrictionMap } from "./slotRestrictions";
import { fetchSlotRestrictionsFromSupabase, saveSlotRestrictionToSupabase } from "./supabaseService";

/** Loads per-doctor slot restrictions for the signed-in user. Doctors only
 * ever receive their own row (RLS); admins receive all of them. */
export function useSlotRestrictions(currentUserPhone: string | undefined) {
  const [restrictions, setRestrictions] = useState<SlotRestrictionMap>({});

  useEffect(() => {
    if (!currentUserPhone) {
      setRestrictions({});
      return;
    }
    let cancelled = false;
    fetchSlotRestrictionsFromSupabase().then((remote) => {
      if (!cancelled && remote) setRestrictions(remote);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserPhone]);

  const getAllowedTimes = useCallback(
    (phone: string | undefined): string[] | null =>
      phone ? restrictions[normalizeRestrictionPhone(phone)] || null : null,
    [restrictions],
  );

  const saveRestriction = useCallback(async (phone: string, allowedTimes: string[]) => {
    await saveSlotRestrictionToSupabase(phone, allowedTimes);
    const key = normalizeRestrictionPhone(phone);
    setRestrictions((prev) => {
      const next = { ...prev };
      if (allowedTimes.length === 0) delete next[key];
      else next[key] = allowedTimes;
      return next;
    });
  }, []);

  return { getAllowedTimes, saveRestriction };
}
