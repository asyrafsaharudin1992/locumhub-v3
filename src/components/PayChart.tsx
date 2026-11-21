import React from 'react';
import { LocumSlot } from '../types';
import { formatRM } from '../paymentTrack';

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const TRACK = '#e2e8f0';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  slots: LocumSlot[]; // already filtered to the tracked, approved shifts
}

export const PayChart: React.FC<Props> = ({ slots }) => {
  const total = slots.reduce((s, x) => s + (x.gaji || 0), 0);
  const received = slots.filter((x) => x.paidConfirmedAt).reduce((s, x) => s + (x.gaji || 0), 0);
  const outstanding = total - received;
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;

  // Donut
  const R = 52;
  const C = 2 * Math.PI * R;
  const recvLen = total > 0 ? (received / total) * C : 0;

  // Monthly stacked columns
  const byMonth = new Map<string, { received: number; pending: number }>();
  slots.forEach((s) => {
    const [, m, y] = (s.tarikh || '').split('/');
    if (!m || !y) return;
    const key = `${y}-${m.padStart(2, '0')}`;
    const cur = byMonth.get(key) || { received: 0, pending: 0 };
    if (s.paidConfirmedAt) cur.received += s.gaji || 0;
    else cur.pending += s.gaji || 0;
    byMonth.set(key, cur);
  });
  const months = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const maxVal = Math.max(1, ...months.map(([, v]) => v.received + v.pending));

  if (slots.length === 0) return null;

  return (
    <div className="rounded-3xl bg-white border border-slate-100 p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0" role="img" aria-label={`${pct}% of pay received`}>
          <circle cx="70" cy="70" r={R} fill="none" stroke={total > 0 ? AMBER : TRACK} strokeWidth="16" opacity={outstanding > 0 ? 0.35 : 0.15} />
          <circle
            cx="70" cy="70" r={R} fill="none" stroke={GREEN} strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${recvLen} ${C - recvLen}`} transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dasharray 500ms ease' }}
          />
          <text x="70" y="66" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 26, fontWeight: 800 }}>{pct}%</text>
          <text x="70" y="84" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>RECEIVED</text>
        </svg>
        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} /> Received
            </div>
            <div className="text-lg font-extrabold text-slate-900">{formatRM(received)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: AMBER }} /> Not yet
            </div>
            <div className="text-lg font-extrabold text-slate-900">{formatRM(outstanding)}</div>
          </div>
          <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            Total <span className="font-bold text-slate-700">{formatRM(total)}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">By month</div>
        <div className="flex items-end gap-3 h-28">
          {months.map(([key, v]) => {
            const [y, m] = key.split('-');
            const tot = v.received + v.pending;
            const h = (tot / maxVal) * 100;
            return (
              <div key={key} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[10px] font-bold text-slate-600">{formatRM(tot)}</span>
                <div className="w-full max-w-[44px] flex flex-col justify-end rounded-t-lg overflow-hidden" style={{ height: `${Math.max(h, 4)}%` }}>
                  {v.pending > 0 && <div style={{ flex: v.pending, background: AMBER }} />}
                  {v.received > 0 && <div style={{ flex: v.received, background: GREEN }} />}
                </div>
                <span className="text-[10px] font-semibold text-slate-400">{MONTHS[Number(m) - 1]} {y.slice(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
