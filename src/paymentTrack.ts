import { LocumSlot } from './types';

// "Track payment" starts counting from this date (YYYY-MM-DD). In local dev
// you can override it with ?trackFrom=2026-11-01 to try it before December.
const DEFAULT_TRACK_FROM = '2026-12-01';

export const trackFromDate = (): string => {
  try {
    if (import.meta.env.DEV) {
      const ok = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const q = new URLSearchParams(window.location.search).get('trackFrom');
      // Remember it, because the app may rewrite the URL after sign-in.
      if (ok(q)) {
        localStorage.setItem('trackFromDev', q as string);
        return q as string;
      }
      const stored = localStorage.getItem('trackFromDev');
      if (ok(stored)) return stored as string;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_TRACK_FROM;
};

const toIso = (tarikh: string): string => {
  const [d, m, y] = (tarikh || '').split('/');
  return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
};

/** An approved shift that has already happened and falls in the tracking period. */
export const isPaymentTracked = (slot: LocumSlot): boolean => {
  if (slot.status !== 'Approved') return false;
  const iso = toIso(slot.tarikh);
  const today = new Date().toLocaleDateString('en-CA');
  return !!iso && iso >= trackFromDate() && iso <= today;
};

export const formatRM = (n: number): string =>
  `RM${n.toLocaleString('en-MY', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
