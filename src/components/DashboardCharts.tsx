import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Award, Activity } from 'lucide-react';
import { LocumSlot, UserProfile } from '../types';

interface DashboardChartsProps {
  pastSlots: LocumSlot[];
  users: UserProfile[];
  selectedMonth: string;
  selectedYear: string;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  pastSlots,
  users,
  selectedMonth,
  selectedYear
}) => {
  // --- CHART 1: Completed Slots Per Doctor ---
  const completedSlots = pastSlots.filter(s => s.status === 'Approved');
  
  // Aggregate counts
  const slotCounts: { [drName: string]: number } = {};
  completedSlots.forEach(s => {
    if (s.dr) {
      const cleanName = s.dr.replace(/^(DR|dr)\.?\s+/i, "");
      slotCounts[cleanName] = (slotCounts[cleanName] || 0) + 1;
    }
  });

  const slotData = Object.entries(slotCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // top 5

  const maxSlots = slotData.length > 0 ? Math.max(...slotData.map(d => d.count)) : 1;

  // --- CHART 2: Aracoins Leaderboard ---
  // Top doctors from the user roster with active points
  const leaderboardData = users
    .filter(u => u.role === 'Doctor' && u.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5); // top 5

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
              const pct = (dr.count / maxSlots) * 100;
              return (
                <div key={dr.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 font-sans">Dr. {dr.name}</span>
                    <span className="text-[#001F3F] font-mono">{dr.count} shifts</span>
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
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <Trophy className="w-4 h-4" />
          </div>
          <h5 className="font-display font-bold text-slate-800 tracking-tight">
            Aracoins Elite Leaderboard
          </h5>
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
