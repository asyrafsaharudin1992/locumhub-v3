import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Award, Activity } from 'lucide-react';
import { LocumSlot, UserProfile } from '../types';

interface BadgeAwardRow {
  doctor_phone: string;
  doctor_name: string;
  badge_name: string;
  month_tag: string;
  award_count: number;
}

interface DashboardChartsProps {
  pastSlots: LocumSlot[];
  users: UserProfile[];
  selectedMonth: string;
  selectedYear: string;
  allBadgeAwards: BadgeAwardRow[];
}

// Mirrors useAppState.ts's POINTS_PER_BADGE — used here to compute a
// specific-month point total from badge_awards, since users.points only
// ever holds the ALL-TIME cumulative figure.
const POINTS_PER_BADGE: { [badge: string]: number } = {
  "Iron Doctor": 10,
  "Heart Winner": 15,
  "The Unstoppable": 10,
  "The Diligent Doc": 10,
  "Last Minute Saviour": 20,
  "Team Favorite": 20,
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  pastSlots,
  users,
  selectedMonth,
  selectedYear,
  allBadgeAwards,
}) => {
  const [leaderboardView, setLeaderboardView] = useState<'month' | 'all'>('all');

  // --- CHART 1: Completed Slots Per Doctor ---
  // "Completed" means the slot's actual date has passed (or is today) —
  // NOT just that its booking status is 'Approved'. Approved only means
  // the booking was approved by admin; a shift booked for later this
  // month is still Approved but hasn't happened yet, so it shouldn't
  // count as done.
  const parseSlotDate = (tarikh: string): Date | null => {
    const parts = (tarikh || '').split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map((p) => parseInt(p, 10));
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
  };
  const today = new Date();
  today.setHours(23, 59, 59, 999); // treat "today" as still in-progress/countable

  const completedSlots = pastSlots.filter(s => {
    if (s.status !== 'Approved') return false;
    const d = parseSlotDate(s.tarikh);
    return d !== null && d <= today;
  });

  // Aggregate counts — completed-so-far vs total assigned this period.
  // "Assigned" means the slot was actually claimed by this doctor (Pending
  // or Approved, regardless of date) — "Available" slots aren't counted
  // since nobody has taken them yet.
  const slotCounts: { [drName: string]: { completed: number; assigned: number } } = {};
  pastSlots.forEach(s => {
    if (!s.dr || s.status === 'Available') return;
    const cleanName = s.dr.replace(/^(DR|dr)\.?\s+/i, "");
    if (!slotCounts[cleanName]) slotCounts[cleanName] = { completed: 0, assigned: 0 };
    slotCounts[cleanName].assigned += 1;
    const d = parseSlotDate(s.tarikh);
    if (s.status === 'Approved' && d !== null && d <= today) {
      slotCounts[cleanName].completed += 1;
    }
  });

  const slotData = Object.entries(slotCounts)
    .map(([name, v]) => ({ name, count: v.completed, assigned: v.assigned }))
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 5); // top 5 by shifts taken this month

  // --- CHART 2: Aracoins Leaderboard ---
  // "All-Time" reads straight from users.points (the cumulative figure
  // reconciled from badge_awards). "This Month" instead computes points
  // fresh from badge_awards rows matching selectedMonth/selectedYear only,
  // since users.points has no month breakdown of its own.
  const monthTag = `${selectedMonth}/${selectedYear}`;
  const leaderboardData = leaderboardView === 'all'
    ? users
        .filter(u => u.role === 'Doctor' && u.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 5)
        .map(u => ({ phone: u.phone, name: u.name, points: u.points }))
    : (() => {
        const monthPoints: { [phone: string]: { name: string; points: number } } = {};
        allBadgeAwards
          .filter(r => r.month_tag === monthTag)
          .forEach(r => {
            const perBadge = POINTS_PER_BADGE[r.badge_name] ?? 10;
            if (!monthPoints[r.doctor_phone]) {
              monthPoints[r.doctor_phone] = { name: r.doctor_name, points: 0 };
            }
            monthPoints[r.doctor_phone].points += perBadge * r.award_count;
          });
        return Object.entries(monthPoints)
          .map(([phone, v]) => ({ phone, name: v.name, points: v.points }))
          .filter(d => d.points > 0)
          .sort((a, b) => b.points - a.points)
          .slice(0, 5);
      })();

  const maxPoints = leaderboardData.length > 0 ? Math.max(...leaderboardData.map(d => d.points)) : 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Chart 1 Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-sky-50 text-[#001F3F]">
            <Activity className="w-4 h-4" />
          </div>
          <h5 className="font-display font-bold text-slate-800 tracking-tight">
            Completed Shifts {selectedMonth}/{selectedYear}
          </h5>
        </div>

        {slotData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-center">
            <p className="text-xs">No slots closed during this period yet.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-4">
            {slotData.map((dr, index) => {
              const pct = dr.assigned > 0 ? (dr.count / dr.assigned) * 100 : 0;
              return (
                <div key={dr.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 font-sans">Dr. {dr.name}</span>
                    <span className="text-[#001F3F] font-mono">{dr.count}/{dr.assigned} shifts</span>
                  </div>
                  <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                      className="h-full bg-gradient-to-r from-[#001F3F] to-[#007AFF] rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart 2 Card: Horizontal Leaderboard */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Trophy className="w-4 h-4" />
            </div>
            <h5 className="font-display font-bold text-slate-800 tracking-tight">
              Aracoins Elite Leaderboard
            </h5>
          </div>
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            {(['all', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setLeaderboardView(v)}
                className={`text-[10px] font-bold px-2 py-1 rounded-md transition ${
                  leaderboardView === v
                    ? 'bg-white text-[#001F3F] shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {v === 'all' ? 'All-Time' : `${selectedMonth}/${selectedYear}`}
              </button>
            ))}
          </div>
        </div>

        {leaderboardData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-center">
            <p className="text-xs">No coins recorded on doctor roster.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-3.5">
            {leaderboardData.map((dr, index) => {
              const pct = (dr.points / maxPoints) * 100;
              return (
                <div key={dr.phone} className="flex items-center gap-3">
                  {/* Rank Indicator */}
                  <div className="w-6 flex justify-center">
                    {index === 0 ? (
                      <Trophy className="w-5 h-5 text-amber-500 fill-current" />
                    ) : index === 1 ? (
                      <Award className="w-5 h-5 text-slate-400 fill-current" />
                    ) : index === 2 ? (
                      <Award className="w-5 h-5 text-amber-700 fill-[#B45309]" />
                    ) : (
                      <span className="text-xs text-slate-400 font-bold font-mono">#{index + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 font-sans font-semibold line-clamp-1">{dr.name}</span>
                      <span className="text-amber-600 font-mono font-bold flex items-center gap-0.5">
                        🪙 {dr.points}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-amber-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};