import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock,
  Download,
  Info,
  Moon,
  Search,
  Sun,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { LocumSlot } from "../types";

interface AdminAnalysisTabProps {
  slots: LocumSlot[];
}

type BranchKey = "KJ" | "SK";

const BRANCH_LABEL: Record<BranchKey, string> = { KJ: "Kajang", SK: "Seri Kembangan" };
const BRANCH_COLOR: Record<BranchKey, string> = { KJ: "#0ea5e9", SK: "#10b981" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtRM = (n: number) =>
  "RM " + new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtNum = (n: number, d = 0) =>
  new Intl.NumberFormat("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
};

// ---------- parsing helpers ----------

// "DD/MM/YYYY" -> local Date | null
function parseTarikh(value: string): Date | null {
  const m = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// "8pm-8am", "6pm-10pm", "1230am-8am", "6-8pm" -> start hour (0-24) and duration in hours
export function parseShiftTime(masa: string): { start: number; hours: number } | null {
  const m = String(masa || "")
    .replace(/\s+/g, "")
    .match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?-(\d{1,2})(?::?(\d{2}))?(am|pm)?$/i);
  if (!m) return null;
  const to24 = (h: number, mer?: string) => {
    if (!mer) return h;
    const x = mer.toLowerCase();
    if (x === "pm" && h < 12) return h + 12;
    if (x === "am" && h === 12) return 0;
    return h;
  };
  const sh = Number(m[1]);
  const sm = Number(m[2] || 0);
  const eh = Number(m[4]);
  const em = Number(m[5] || 0);
  const endMer = m[6];
  let startMer = m[3];
  if (!startMer && endMer) {
    // "6-8pm": the start inherits the end's am/pm unless that would put the start after the end
    const candidate = to24(sh, endMer) + sm / 60;
    const endVal = to24(eh, endMer) + em / 60;
    startMer = candidate > endVal ? (endMer.toLowerCase() === "pm" ? "am" : "pm") : endMer;
  }
  const start = to24(sh, startMer) + sm / 60;
  const end = to24(eh, endMer) + em / 60;
  const hours = (end - start + 24) % 24;
  if (!hours || hours > 24) return null;
  return { start, hours };
}

// Doctors left out of the analysis (management / regular locums). Matched on the
// FIRST name only, so "Amirul Asyraf" is NOT excluded by "Asyraf".
const EXCLUDED_FIRST_NAMES = ["ASYRAF", "LUQMAN", "HAZIQ", "SYAFIQ", "NABILA"];

// Collapse "Dr Pravinaa", "PRAVINAA", "Dr Aiman (External)" into one doctor
function cleanDoctor(raw: string): { key: string; label: string; external: boolean; excluded: boolean } {
  const original = String(raw || "").trim();
  const external = /external/i.test(original);
  const base = original
    .replace(/\(.*?\)/g, " ")
    .replace(/^dr\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstWord = (base.split(" ")[0] || "").toUpperCase().replace(/[^A-Z]/g, "");
  return {
    key: base.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    label: base.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || "(no name)",
    external,
    excluded: EXCLUDED_FIRST_NAMES.includes(firstWord),
  };
}

function branchOf(cawangan: string): BranchKey | null {
  const c = String(cawangan || "").toLowerCase();
  if (c.includes("kajang")) return "KJ";
  if (c.includes("seri") || c.includes("sk")) return "SK";
  return null;
}

const branchList = (set: Set<BranchKey>): BranchKey[] => {
  const out: BranchKey[] = [];
  set.forEach((b) => out.push(b));
  return out;
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`;

interface Row {
  date: Date;
  branch: BranchKey;
  doctor: string;
  doctorLabel: string;
  external: boolean;
  pay: number;
  hours: number | null;
  start: number | null;
}

interface DoctorAgg {
  key: string;
  label: string;
  external: boolean;
  branches: Set<BranchKey>;
  pay: number;
  hours: number;
  paidHours: number;
  shifts: number;
  paidShifts: number;
  missing: number;
}

// ---------- small SVG charts (no external chart library) ----------

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const ColumnChart: React.FC<{
  data: { label: string; values: number[] }[];
  colors: string[];
  legend?: string[];
  format?: (n: number) => string;
  height?: number;
}> = ({ data, colors, legend, format = fmtShort, height = 220 }) => {
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 8, t: 12, b: 28 };
  const max = niceMax(Math.max(0, ...data.map((d) => d.values.reduce((s, v) => s + v, 0))));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = Math.min(40, (iw / Math.max(data.length, 1)) * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {ticks.map((t) => {
          const y = pad.t + ih - ih * t;
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#64748b">{format(max * t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = pad.l + (iw / data.length) * (i + 0.5);
          let acc = 0;
          const total = d.values.reduce((s, v) => s + v, 0);
          return (
            <g key={d.label}>
              {d.values.map((v, j) => {
                const h = (v / max) * ih;
                const y = pad.t + ih - ((acc + v) / max) * ih;
                acc += v;
                return h > 0 ? (
                  <rect key={j} x={cx - bw / 2} y={y} width={bw} height={h} fill={colors[j]} rx={j === d.values.length - 1 ? 3 : 0}>
                    <title>{`${d.label}${legend ? " · " + legend[j] : ""}: ${format(v)}`}</title>
                  </rect>
                ) : null;
              })}
              {total > 0 && (
                <text x={cx} y={pad.t + ih - (total / max) * ih - 4} textAnchor="middle" fontSize={9} fill="#334155" fontWeight={600}>{format(total)}</text>
              )}
              <text x={cx} y={H - 10} textAnchor="middle" fontSize={10} fill="#64748b">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {legend && (
        <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-slate-500">
          {legend.map((l, i) => (
            <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />{l}</span>
          ))}
        </div>
      )}
    </div>
  );
};

const LineChart: React.FC<{ points: { label: string; y: number }[]; color: string; format?: (n: number) => string; height?: number }> = ({ points, color, format = fmtShort, height = 200 }) => {
  const W = 640;
  const H = height;
  const pad = { l: 48, r: 12, t: 12, b: 26 };
  const max = niceMax(Math.max(0, ...points.map((p) => p.y)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const xy = points.map((p, i) => [pad.l + (points.length <= 1 ? iw / 2 : (iw / (points.length - 1)) * i), pad.t + ih - (p.y / max) * ih] as const);
  const path = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = xy.length ? `${path} L${xy[xy.length - 1][0].toFixed(1)},${pad.t + ih} L${xy[0][0].toFixed(1)},${pad.t + ih} Z` : "";
  const every = Math.ceil(points.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + ih - ih * t;
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#e2e8f0" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#64748b">{format(max * t)}</text>
          </g>
        );
      })}
      {area && <path d={area} fill={color} opacity={0.12} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      {xy.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={2.6} fill={color}><title>{`${points[i].label}: ${format(points[i].y)}`}</title></circle>
          {i % every === 0 && <text x={x} y={H - 8} textAnchor="middle" fontSize={10} fill="#64748b">{points[i].label}</text>}
        </g>
      ))}
    </svg>
  );
};

const HBarChart: React.FC<{ items: { label: string; value: number; sub?: string }[]; color: string; format?: (n: number) => string }> = ({ items, color, format = fmtShort }) => {
  const max = Math.max(0, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={it.label + i} className="grid grid-cols-[110px_1fr_74px] items-center gap-2 text-xs">
          <span className="truncate font-semibold text-slate-700" title={it.label}>{it.label}</span>
          <div className="h-3.5 rounded bg-slate-100">
            <div className="h-3.5 rounded" style={{ width: `${max ? Math.max(2, (it.value / max) * 100) : 0}%`, background: color }} title={it.sub} />
          </div>
          <span className="text-right font-bold text-slate-800">{format(it.value)}</span>
        </div>
      ))}
    </div>
  );
};

const Donut: React.FC<{ segments: { label: string; value: number; color: string }[]; centre: string; sub?: string; format?: (n: number) => string }> = ({ segments, centre, sub, format = fmtRM }) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f5f9" strokeWidth={18} />
        {total > 0 && segments.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth={18} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)">
              <title>{`${s.label}: ${format(s.value)}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize={13} fontWeight={700} fill="#082f49">{centre}</text>
        {sub && <text x="70" y="83" textAnchor="middle" fontSize={9} fill="#64748b">{sub}</text>}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="font-bold text-slate-800">{format(s.value)}</span>
            <span className="text-slate-400">{total ? `${fmtNum((s.value / total) * 100, 0)}%` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Card: React.FC<{ title: string; icon?: React.ReactNode; children?: React.ReactNode; className?: string; right?: React.ReactNode }> = ({ title, icon, children, className = "", right }) => (
  <section className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.03)] ${className}`}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">{icon}{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

const Kpi: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode }> = ({ label, value, sub, icon }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.03)]">
    <div className="flex items-center justify-between text-slate-400">
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {icon}
    </div>
    <div className="mt-2 text-2xl font-bold tracking-tight text-[#082f49]">{value}</div>
    {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
  </div>
);

type SortKey = "label" | "shifts" | "hours" | "pay" | "rate" | "avg" | "missing";

// ---------- main component ----------

export const AdminAnalysisTab: React.FC<AdminAnalysisTabProps> = ({ slots }) => {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(23, 59, 59, 999);
    return t;
  }, []);

  // Every approved clinical slot that has already happened
  const base = useMemo(() => {
    const list: { date: Date; branch: BranchKey; slot: LocumSlot }[] = [];
    for (const s of slots || []) {
      if (s.status !== "Approved") continue;
      const branch = branchOf(s.cawangan);
      if (!branch) continue;
      const date = parseTarikh(s.tarikh);
      if (!date || date > today) continue;
      if (cleanDoctor(s.dr).excluded) continue;
      list.push({ date, branch, slot: s });
    }
    return list;
  }, [slots, today]);

  const years = useMemo(
    () => Array.from(new Set<number>(base.map((b) => b.date.getFullYear()))).sort((a, b) => b - a),
    [base],
  );

  const [year, setYear] = useState<string>("auto");
  const [branchFilter, setBranchFilter] = useState<"ALL" | BranchKey>("ALL");
  const [minShifts, setMinShifts] = useState(3);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("pay");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  const activeYear = year === "auto" ? String(years[0] ?? new Date().getFullYear()) : year;

  const rows: Row[] = useMemo(
    () =>
      base
        .filter((b) => (activeYear === "all" || String(b.date.getFullYear()) === activeYear) && (branchFilter === "ALL" || b.branch === branchFilter))
        .map(({ date, branch, slot }) => {
          const doc = cleanDoctor(slot.dr);
          const t = parseShiftTime(slot.masa);
          return {
            date,
            branch,
            doctor: doc.key,
            doctorLabel: doc.label,
            external: doc.external,
            pay: Number(slot.gaji || 0),
            hours: t ? t.hours : null,
            start: t ? t.start : null,
          };
        }),
    [base, activeYear, branchFilter],
  );

  const paid = rows.filter((r) => r.pay > 0);
  const unpaid = rows.filter((r) => r.pay <= 0);
  const totalPay = paid.reduce((s, r) => s + r.pay, 0);
  const totalHours = rows.reduce((s, r) => s + (r.hours ?? 0), 0);
  const paidWithHours = paid.filter((r) => r.hours !== null);
  const paidHours = paidWithHours.reduce((s, r) => s + (r.hours as number), 0);
  const avgRate = paidHours > 0 ? paidWithHours.reduce((s, r) => s + r.pay, 0) / paidHours : 0;
  const unreadable = rows.filter((r) => r.hours === null).length;

  const doctors = useMemo(() => {
    const map = new Map<string, DoctorAgg>();
    for (const r of rows) {
      if (!r.doctor) continue;
      let d = map.get(r.doctor);
      if (!d) {
        d = { key: r.doctor, label: r.doctorLabel, external: r.external, branches: new Set(), pay: 0, hours: 0, paidHours: 0, shifts: 0, paidShifts: 0, missing: 0 };
        map.set(r.doctor, d);
      }
      d.branches.add(r.branch);
      d.shifts += 1;
      d.hours += r.hours ?? 0;
      if (r.pay > 0) {
        d.pay += r.pay;
        d.paidShifts += 1;
        d.paidHours += r.hours ?? 0;
      } else {
        d.missing += 1;
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const topPay = [...doctors].sort((a, b) => b.pay - a.pay).slice(0, 10);
  const topHours = [...doctors].sort((a, b) => b.hours - a.hours).slice(0, 10);
  const topShifts = [...doctors].sort((a, b) => b.shifts - a.shifts).slice(0, 10);
  const rated = doctors
    .filter((d) => d.paidShifts >= minShifts && d.paidHours > 0)
    .map((d) => ({ ...d, rate: d.pay / d.paidHours }))
    .sort((a, b) => b.rate - a.rate);
  const top5Share = totalPay > 0 ? (topPay.slice(0, 5).reduce((s, d) => s + d.pay, 0) / totalPay) * 100 : 0;

  const monthly = useMemo(() => {
    const map = new Map<string, { KJ: number; SK: number; hoursKJ: number; hoursSK: number; shifts: number; paidShifts: number; hoursPaid: number; payHours: number }>();
    for (const r of rows) {
      const k = monthKey(r.date);
      const m = map.get(k) || { KJ: 0, SK: 0, hoursKJ: 0, hoursSK: 0, shifts: 0, paidShifts: 0, hoursPaid: 0, payHours: 0 };
      m.shifts += 1;
      if (r.branch === "KJ") m.hoursKJ += r.hours ?? 0; else m.hoursSK += r.hours ?? 0;
      if (r.pay > 0) {
        m[r.branch] += r.pay;
        m.paidShifts += 1;
        if (r.hours !== null) {
          m.hoursPaid += r.hours;
          m.payHours += r.pay;
        }
      }
      map.set(k, m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const cumulative = useMemo(() => {
    let acc = 0;
    return monthly.map(([k, m]) => {
      acc += m.KJ + m.SK;
      return { label: monthLabel(k), y: acc };
    });
  }, [monthly]);

  const branchStats = (b: BranchKey) => {
    const rs = rows.filter((r) => r.branch === b);
    const p = rs.filter((r) => r.pay > 0);
    const ph = p.filter((r) => r.hours !== null);
    const hrs = ph.reduce((s, r) => s + (r.hours as number), 0);
    const pay = p.reduce((s, r) => s + r.pay, 0);
    return {
      shifts: rs.length,
      paidShifts: p.length,
      pay,
      hours: rs.reduce((s, r) => s + (r.hours ?? 0), 0),
      rate: hrs > 0 ? ph.reduce((s, r) => s + r.pay, 0) / hrs : 0,
      avg: p.length ? pay / p.length : 0,
      doctors: new Set(rs.map((r) => r.doctor)).size,
    };
  };
  const kj = branchStats("KJ");
  const sk = branchStats("SK");

  const durationBuckets = useMemo(() => {
    const buckets = [
      { label: "Short (≤ 4 h)", test: (h: number) => h <= 4, pay: 0, hours: 0, shifts: 0 },
      { label: "Medium (5–9 h)", test: (h: number) => h > 4 && h < 10, pay: 0, hours: 0, shifts: 0 },
      { label: "Long (10–14 h)", test: (h: number) => h >= 10 && h <= 14, pay: 0, hours: 0, shifts: 0 },
      { label: "Extra long (> 14 h)", test: (h: number) => h > 14, pay: 0, hours: 0, shifts: 0 },
    ];
    for (const r of paidWithHours) {
      const b = buckets.find((x) => x.test(r.hours as number));
      if (b) {
        b.pay += r.pay;
        b.hours += r.hours as number;
        b.shifts += 1;
      }
    }
    return buckets;
  }, [paidWithHours]);

  const dayNight = useMemo(() => {
    const out = { day: { pay: 0, hours: 0, shifts: 0 }, night: { pay: 0, hours: 0, shifts: 0 } };
    for (const r of paidWithHours) {
      if (r.start === null) continue;
      const t = r.start >= 18 || r.start < 6 ? out.night : out.day;
      t.pay += r.pay;
      t.hours += r.hours as number;
      t.shifts += 1;
    }
    return out;
  }, [paidWithHours]);

  const weekday = useMemo(() => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = Array(7).fill(0) as number[];
    for (const r of rows) counts[r.date.getDay()] += 1;
    return names.map((n, i) => ({ label: n, values: [counts[i]] }));
  }, [rows]);

  const missingTop = useMemo(
    () => [...doctors].filter((d) => d.missing > 0).sort((a, b) => b.missing - a.missing).slice(0, 10),
    [doctors],
  );

  // doctor table
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = doctors
      .filter((d) => !q || d.label.toLowerCase().includes(q))
      .map((d) => ({
        ...d,
        rate: d.paidHours > 0 ? d.pay / d.paidHours : 0,
        avg: d.paidShifts ? d.pay / d.paidShifts : 0,
        share: totalPay ? (d.pay / totalPay) * 100 : 0,
      }));
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "label") return a.label.localeCompare(b.label) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return list;
  }, [doctors, search, sortKey, sortDir, totalPay]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "label" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    const header = ["Doctor", "Branches", "Shifts", "Paid shifts", "Hours", "Paid hours", "Total pay (RM)", "RM per hour", "Avg per shift (RM)", "Share of pay (%)", "Shifts missing payment"];
    const lines = tableRows.map((d) =>
      [
        `"${d.label.replace(/"/g, '""')}${d.external ? " (External)" : ""}"`,
        branchList(d.branches).map((b) => BRANCH_LABEL[b]).join(" / "),
        d.shifts,
        d.paidShifts,
        d.hours.toFixed(1),
        d.paidHours.toFixed(1),
        d.pay.toFixed(2),
        d.rate ? d.rate.toFixed(2) : "",
        d.avg ? d.avg.toFixed(2) : "",
        d.share.toFixed(2),
        d.missing,
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `locum-analysis-${activeYear}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const bestMonth = [...monthly].sort(([, a], [, b]) => b.KJ + b.SK - (a.KJ + a.SK))[0];
  const topDoc = topPay[0];

  if (base.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        There are no completed shifts to analyse yet.
      </div>
    );
  }

  const th = (k: SortKey, label: string, right = true) => (
    <th className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 ${right ? "text-right" : "text-left"}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  );
  const visibleRows = showAll ? tableRows : tableRows.slice(0, 15);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.03)]">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Year</label>
          <select value={year === "auto" ? activeYear : year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            <option value="all">All years</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Branch</label>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as "ALL" | BranchKey)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            <option value="ALL">All branches</option>
            <option value="KJ">Kajang</option>
            <option value="SK">Seri Kembangan</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Hourly rate: minimum shifts</label>
          <select value={minShifts} onChange={(e) => setMinShifts(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}+ shifts</option>)}
          </select>
        </div>
        <button type="button" onClick={exportCsv} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
          <Download className="h-3.5 w-3.5" /> Export doctor table (CSV)
        </button>
      </div>

      <p className="px-1 text-[11px] text-slate-500">
        Not included in this analysis: Asyraf, Luqman, Haziq, Syafiq and Nabila (management / regular locums).
      </p>

      {branchFilter !== "KJ" && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <strong>Seri Kembangan payment data has not been fully transferred yet.</strong>{" "}
            SK pay, average rates and per-doctor figures are understated until the remaining records are entered.
          </div>
        </div>
      )}

      {/* Data completeness */}
      {unpaid.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <strong>{unpaid.length} of {rows.length} completed shifts ({fmtNum((unpaid.length / Math.max(rows.length, 1)) * 100, 0)}%) have no payment recorded.</strong>{" "}
            Totals and averages below only include shifts that already have a payment, so the true figures may be higher.
            {missingTop.length > 0 && (
              <div className="mt-1 text-xs text-amber-800">Most missing: {missingTop.slice(0, 6).map((m) => `${m.label} (${m.missing})`).join(", ")}</div>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total locum pay" value={fmtRM(totalPay)} sub={`${paid.length} paid shifts`} icon={<Wallet className="h-4 w-4" />} />
        <Kpi label="Locum hours" value={fmtNum(totalHours)} sub={`${rows.length} completed shifts`} icon={<Clock className="h-4 w-4" />} />
        <Kpi label="Average RM / hour" value={fmtRM(avgRate)} sub="paid shifts only" icon={<BarChart3 className="h-4 w-4" />} />
        <Kpi label="Average per shift" value={fmtRM(paid.length ? totalPay / paid.length : 0)} sub="paid shifts only" icon={<Wallet className="h-4 w-4" />} />
        <Kpi label="Active doctors" value={fmtNum(doctors.length)} sub={`Top 5 = ${fmtNum(top5Share)}% of pay`} icon={<Users className="h-4 w-4" />} />
      </div>

      {/* Insights */}
      <Card title="Key insights" icon={<Trophy className="h-3.5 w-3.5 text-amber-500" />}>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700">
          {topDoc && <li><strong>{topDoc.label}</strong> earned the most: {fmtRM(topDoc.pay)} ({fmtNum(totalPay ? (topDoc.pay / totalPay) * 100 : 0, 1)}% of total) across {topDoc.paidShifts} paid shifts.</li>}
          {topHours[0] && <li><strong>{topHours[0].label}</strong> worked the most hours: {fmtNum(topHours[0].hours)} h over {topHours[0].shifts} shifts.</li>}
          {topShifts[0] && <li><strong>{topShifts[0].label}</strong> covered the most shifts: {topShifts[0].shifts}.</li>}
          {bestMonth && <li>Highest-spend month: <strong>{monthLabel(bestMonth[0])}</strong> ({fmtRM(bestMonth[1].KJ + bestMonth[1].SK)}).</li>}
          {rated.length > 1 && <li>Highest hourly rate: <strong>{rated[0].label}</strong> ({fmtRM(rated[0].rate)}/h); lowest: <strong>{rated[rated.length - 1].label}</strong> ({fmtRM(rated[rated.length - 1].rate)}/h), among doctors with {minShifts}+ paid shifts.</li>}
          {dayNight.night.hours > 0 && dayNight.day.hours > 0 && <li>Night shifts cost {fmtRM(dayNight.night.pay / dayNight.night.hours)}/h versus {fmtRM(dayNight.day.pay / dayNight.day.hours)}/h for day shifts.</li>}
          {unreadable > 0 && <li className="text-slate-500">{unreadable} shifts are excluded from hour calculations because their time format could not be read.</li>}
        </ul>
      </Card>

      {/* Monthly charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Monthly locum pay (RM)" icon={<BarChart3 className="h-3.5 w-3.5" />}>
          <ColumnChart data={monthly.map(([k, m]) => ({ label: monthLabel(k), values: [m.KJ, m.SK] }))} colors={[BRANCH_COLOR.KJ, BRANCH_COLOR.SK]} legend={["Kajang", "Seri Kembangan"]} />
        </Card>
        <Card title="Monthly locum hours" icon={<Clock className="h-3.5 w-3.5" />}>
          <ColumnChart data={monthly.map(([k, m]) => ({ label: monthLabel(k), values: [m.hoursKJ, m.hoursSK] }))} colors={[BRANCH_COLOR.KJ, BRANCH_COLOR.SK]} legend={["Kajang", "Seri Kembangan"]} />
        </Card>
      </div>

      <Card title="Cumulative locum pay (RM)" icon={<Wallet className="h-3.5 w-3.5" />}>
        <LineChart points={cumulative} color="#6366f1" />
      </Card>

      {/* Monthly table */}
      <Card title="Monthly summary">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-right">Shifts</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-right">Kajang</th>
                <th className="px-3 py-2 text-right">Seri Kembangan</th>
                <th className="px-3 py-2 text-right">Total pay</th>
                <th className="px-3 py-2 text-right">RM / hour</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(([k, m]) => (
                <tr key={k} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-semibold text-slate-700">{monthLabel(k)}</td>
                  <td className="px-3 py-2 text-right">{m.shifts}</td>
                  <td className="px-3 py-2 text-right">{m.paidShifts}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(m.hoursKJ + m.hoursSK)}</td>
                  <td className="px-3 py-2 text-right">{fmtRM(m.KJ)}</td>
                  <td className="px-3 py-2 text-right">{fmtRM(m.SK)}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtRM(m.KJ + m.SK)}</td>
                  <td className="px-3 py-2 text-right">{m.hoursPaid ? fmtRM(m.payHours / m.hoursPaid) : "–"}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold text-slate-800">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{rows.length}</td>
                <td className="px-3 py-2 text-right">{paid.length}</td>
                <td className="px-3 py-2 text-right">{fmtNum(totalHours)}</td>
                <td className="px-3 py-2 text-right">{fmtRM(kj.pay)}</td>
                <td className="px-3 py-2 text-right">{fmtRM(sk.pay)}</td>
                <td className="px-3 py-2 text-right">{fmtRM(totalPay)}</td>
                <td className="px-3 py-2 text-right">{avgRate ? fmtRM(avgRate) : "–"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Branch comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pay share by branch">
          <Donut segments={[{ label: "Kajang", value: kj.pay, color: BRANCH_COLOR.KJ }, { label: "Seri Kembangan", value: sk.pay, color: BRANCH_COLOR.SK }]} centre={fmtRM(totalPay)} sub="total pay" />
        </Card>
        <Card title="Branch comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 text-left">Branch</th>
                  <th className="px-3 py-2 text-right">Doctors</th>
                  <th className="px-3 py-2 text-right">Shifts (paid/all)</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">Pay</th>
                  <th className="px-3 py-2 text-right">RM/h</th>
                  <th className="px-3 py-2 text-right">Avg/shift</th>
                </tr>
              </thead>
              <tbody>
                {([["KJ", kj], ["SK", sk]] as [BranchKey, typeof kj][]).map(([b, v]) => (
                  <tr key={b} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-semibold text-slate-700"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: BRANCH_COLOR[b] }} />{BRANCH_LABEL[b]}</td>
                    <td className="px-3 py-2 text-right">{v.doctors}</td>
                    <td className="px-3 py-2 text-right">{v.paidShifts} / {v.shifts}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(v.hours)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-slate-800">{fmtRM(v.pay)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{v.rate ? fmtRM(v.rate) : "–"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{v.avg ? fmtRM(v.avg) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Top 10 · total pay" icon={<Trophy className="h-3.5 w-3.5 text-amber-500" />}>
          <HBarChart items={topPay.map((d) => ({ label: d.label + (d.external ? " (Ext)" : ""), value: d.pay, sub: `${d.paidShifts} paid shifts` }))} color="#f59e0b" />
        </Card>
        <Card title="Top 10 · hours worked" icon={<Clock className="h-3.5 w-3.5 text-indigo-500" />}>
          <HBarChart items={topHours.map((d) => ({ label: d.label + (d.external ? " (Ext)" : ""), value: d.hours, sub: `${d.shifts} shifts` }))} color="#6366f1" format={(n) => `${fmtNum(n)} h`} />
        </Card>
        <Card title="Top 10 · shifts covered" icon={<Users className="h-3.5 w-3.5 text-emerald-500" />}>
          <HBarChart items={topShifts.map((d) => ({ label: d.label + (d.external ? " (Ext)" : ""), value: d.shifts }))} color="#10b981" format={(n) => String(n)} />
        </Card>
      </div>

      {/* Rate per doctor */}
      <Card title={`Hourly rate by doctor (${minShifts}+ paid shifts)`} icon={<BarChart3 className="h-3.5 w-3.5" />}>
        {rated.length === 0 ? (
          <p className="text-sm text-slate-500">No doctor has enough paid shifts yet.</p>
        ) : (
          <HBarChart items={rated.slice(0, 15).map((d) => ({ label: d.label, value: d.rate, sub: `${d.paidShifts} paid shifts` }))} color="#0ea5e9" format={(n) => `${fmtRM(n)}/h`} />
        )}
      </Card>

      {/* Shift type */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pay by shift length">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 text-left">Length</th>
                  <th className="px-3 py-2 text-right">Shifts</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">Pay</th>
                  <th className="px-3 py-2 text-right">RM/h</th>
                </tr>
              </thead>
              <tbody>
                {durationBuckets.map((b) => (
                  <tr key={b.label} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-semibold text-slate-700">{b.label}</td>
                    <td className="px-3 py-2 text-right">{b.shifts}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(b.hours)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtRM(b.pay)}</td>
                    <td className="px-3 py-2 text-right">{b.hours ? fmtRM(b.pay / b.hours) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <HBarChart items={durationBuckets.map((b) => ({ label: b.label, value: b.pay }))} color="#0ea5e9" />
          </div>
        </Card>
        <Card title="Day vs night shifts">
          <Donut
            segments={[
              { label: "Day (start 6am–6pm)", value: dayNight.day.pay, color: "#f59e0b" },
              { label: "Night (start 6pm–6am)", value: dayNight.night.pay, color: "#6366f1" },
            ]}
            centre={fmtRM(dayNight.day.pay + dayNight.night.pay)}
            sub="paid shifts"
          />
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            {([["Day", <Sun key="d" className="h-4 w-4 text-amber-500" />, dayNight.day], ["Night", <Moon key="n" className="h-4 w-4 text-indigo-500" />, dayNight.night]] as [string, React.ReactNode, typeof dayNight.day][]).map(([label, icon, v]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-600">{icon}{label}</div>
                <div className="mt-1 text-slate-700">{v.shifts} shifts · {fmtNum(v.hours)} h</div>
                <div className="font-bold text-slate-800">{v.hours ? `${fmtRM(v.pay / v.hours)}/h` : "–"}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Shifts by weekday">
        <ColumnChart data={weekday} colors={["#64748b"]} format={(n) => String(Math.round(n))} height={190} />
      </Card>

      {/* Doctor table */}
      <Card
        title={`Doctor summary (${tableRows.length})`}
        icon={<Users className="h-3.5 w-3.5" />}
        right={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search doctor" className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                {th("label", "Doctor", false)}
                <th className="px-3 py-2 text-left">Branch</th>
                {th("shifts", "Shifts")}
                {th("hours", "Hours")}
                {th("pay", "Total pay")}
                {th("rate", "RM / h")}
                {th("avg", "Avg / shift")}
                <th className="px-3 py-2 text-right">Share</th>
                {th("missing", "No payment")}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((d) => (
                <tr key={d.key} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-semibold text-slate-700">{d.label}{d.external && <span className="ml-1 rounded bg-slate-100 px-1 text-[9px] font-bold text-slate-500">EXT</span>}</td>
                  <td className="px-3 py-2 text-slate-500">{branchList(d.branches).join(" / ")}</td>
                  <td className="px-3 py-2 text-right">{d.paidShifts}/{d.shifts}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(d.hours)}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtRM(d.pay)}</td>
                  <td className="px-3 py-2 text-right">{d.rate ? fmtRM(d.rate) : "–"}</td>
                  <td className="px-3 py-2 text-right">{d.avg ? fmtRM(d.avg) : "–"}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{fmtNum(d.share, 1)}%</td>
                  <td className={`px-3 py-2 text-right ${d.missing ? "font-bold text-amber-600" : "text-slate-400"}`}>{d.missing || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableRows.length > 15 && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="mt-3 text-xs font-bold text-sky-700 hover:underline">
            {showAll ? "Show top 15 only" : `Show all ${tableRows.length} doctors`}
          </button>
        )}
      </Card>
    </div>
  );
};
