import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, AlertCircle, AlertTriangle, Clock, Trash, X, CheckCircle2, Trophy, Award, Heart, Zap, ShieldCheck, Flame, BookOpen, Users } from 'lucide-react';
import { LocumSlot, UserProfile } from '../types';

interface DoctorStatusTabProps {
  slots: LocumSlot[];
  currentUser: UserProfile;
  onCancelSlot: (slotId: string, statusAsal: string, phone: string) => Promise<string>;
}

export const DoctorStatusTab: React.FC<DoctorStatusTabProps> = ({
  slots,
  currentUser,
  onCancelSlot
}) => {
  const [filterType, setFilterType] = useState<'All' | 'Approved' | 'Pending'>('All');
  const [monthFilter, setMonthFilter] = useState<string>('All');
  const [pendingCancelSlot, setPendingCancelSlot] = useState<LocumSlot | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Word-boundary name matching (same logic used elsewhere in the app) —
  // "Ain" matches "Dr Ain"/"Nur Ain" but not "Aini" or "Wan Zainol".
  const normalizeDoctorName = (s: string): string =>
    (s || "").toUpperCase().trim().replace(/^DR\.?\s+/i, "");

  const doctorNameMatches = (slotDr: string, myName: string): boolean => {
    const a = normalizeDoctorName(slotDr);
    const b = normalizeDoctorName(myName);
    if (!a || !b) return false;
    if (a === b) return true;
    const wordsA = a.split(/\s+/).filter(Boolean);
    const wordsB = b.split(/\s+/).filter(Boolean);
    const [shortWords, longWords] =
      wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
    return shortWords.every((w) => longWords.includes(w));
  };

  // Find slots booked by this doctor — whether self-booked or assigned by
  // admin. Match by phone when present, but fall back to name matching since
  // a lot of historical/manually-entered slots never captured a phone number
  // at all (leaving that field blank), which would otherwise hide real
  // approved shifts from the doctor's own My Status view.
  // Slots reset back to "Available" (cancelled by admin or withdrawn by the
  // doctor) should never appear here, even if a stale phone/name lingers.
  const mySlots = slots.filter((s) => {
    if (s.status === 'Available') return false;
    const phoneMatches = !!s.phone && s.phone === currentUser.phone;
    return phoneMatches || doctorNameMatches(s.dr || '', currentUser.name);
  });

  // Parse "DD/MM/YYYY, HH:MM:SS" (en-GB toLocaleString format) safely; unknown/missing dates sort last
  const parseBookedAt = (raw?: string): number => {
    if (!raw) return 0;
    const parts = raw.split(/[\s,/:]+/).filter(Boolean);
    if (parts.length >= 6) {
      const [d, m, y, h, min, s] = parts.map((p) => parseInt(p, 10));
      const dt = new Date(y, (m || 1) - 1, d, h || 0, min || 0, s || 0);
      if (!isNaN(dt.getTime())) return dt.getTime();
    }
    const fallback = new Date(raw).getTime();
    return isNaN(fallback) ? 0 : fallback;
  };

  const sortedMySlots = [...mySlots].sort(
    (a, b) => parseBookedAt(b.bookedAt) - parseBookedAt(a.bookedAt)
  );

  const filteredSlots = sortedMySlots.filter(s => {
    if (filterType === 'Approved' && s.status !== 'Approved') return false;
    if (filterType === 'Pending' && s.status !== 'Pending') return false;
    if (monthFilter !== 'All') {
      const parts = (s.tarikh || '').split('/');
      const slotMonthYear = parts.length === 3 ? `${parts[1].padStart(2, '0')}/${parts[2]}` : '';
      if (slotMonthYear !== monthFilter) return false;
    }
    return true;
  });

  // Unique month/year combos present in this doctor's slots, newest first —
  // powers the "filter by month" dropdown so past shifts can be found easily.
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthYearList: string[] = mySlots
    .map(s => {
      const parts = (s.tarikh || '').split('/');
      return parts.length === 3 ? `${parts[1].padStart(2, '0')}/${parts[2]}` : '';
    })
    .filter((v): v is string => Boolean(v));
  const availableMonths = Array.from(new Set(monthYearList)).sort((a: string, b: string) => {
    const [ma, ya] = a.split('/');
    const [mb, yb] = b.split('/');
    return yb === ya ? mb.localeCompare(ma) : yb.localeCompare(ya);
  });

  // Compact badge summary for the mobile-only Profile & Medals card above the
  // shift list — the full "Profile & Medals" tab isn't reachable in the mobile
  // bottom nav (it only shows the first 5 tabs), so a summary lives here instead.
  //
  // currentUser.badges format: "BadgeName (MM/YYYY):count, BadgeName (MM/YYYY):count, ..."
  // — one entry per badge+month combination. cumulativeBadgeMap sums ALL
  // months together for the true all-time total; monthlyBreakdown keeps
  // each individual month's count for the detail modal.
  const cumulativeBadgeMap: { [key: string]: number } = {};
  const monthlyBreakdown: { [key: string]: { month: string; count: number }[] } = {};
  if (currentUser.badges) {
    currentUser.badges.split(',').forEach(item => {
      const trimmed = item.trim();
      if (!trimmed) return;
      const lastColon = trimmed.lastIndexOf(':');
      let namePart = trimmed;
      let count = 1;
      if (lastColon !== -1) {
        namePart = trimmed.substring(0, lastColon).trim();
        count = parseInt(trimmed.substring(lastColon + 1).trim()) || 1;
      }
      const monthMatch = namePart.match(/\(([^)]+)\)\s*$/);
      const monthLabel = monthMatch ? monthMatch[1] : '';
      const cleanName = namePart.split('(')[0].trim();
      cumulativeBadgeMap[cleanName] = (cumulativeBadgeMap[cleanName] || 0) + count;
      if (!monthlyBreakdown[cleanName]) monthlyBreakdown[cleanName] = [];
      if (monthLabel) monthlyBreakdown[cleanName].push({ month: monthLabel, count });
    });
  }
  const [selectedBadgeDetail, setSelectedBadgeDetail] = useState<string | null>(null);

  const MOBILE_BADGES_CONFIG = [
    {
      name: 'Team Favorite',
      color: 'linear-gradient(135deg, #00DFD8, #007CF0)',
      Icon: Users,
      description: "Awarded by admin to recognize a doctor as the clinic team's pick for standout contribution that month.",
    },
    {
      name: 'Heart Winner',
      color: 'linear-gradient(135deg, #A2FF00, #349300)',
      Icon: Heart,
      description: 'Earned when a patient leaves a perfect 5-star Google review for you in that month.',
    },
    {
      name: 'Last Minute Savior',
      color: 'linear-gradient(135deg, #FF4D4D, #F9CB28)',
      Icon: Zap,
      description: 'Earned for stepping in on a shift booked less than 25 hours before it started — helping cover a last-minute gap.',
    },
    {
      name: 'Iron Doctor',
      color: 'linear-gradient(135deg, #FF0080, #7928CA)',
      Icon: ShieldCheck,
      description: 'Earned for completing a 12+ hour shift, or 2 or more shifts in the same day.',
    },
    {
      name: 'The Unstoppable',
      color: 'linear-gradient(135deg, #5EE7DF, #B490CA)',
      Icon: Flame,
      description: 'Earned for completing 2 or more approved shifts in a month with zero cancellations.',
    },
    {
      name: 'The Diligent Doc',
      color: 'linear-gradient(135deg, #F9CB28, #FF4D4D)',
      Icon: BookOpen,
      description: 'Earned for attending a CME or briefing session that month.',
    },
  ];

  // Doctors can only withdraw upcoming shifts — past shifts can only be
  // adjusted by admin (e.g. via the Clinical Schedule / performance tools).
  const isPastSlot = (tarikhStr: string): boolean => {
    const parts = (tarikhStr || '').split('/');
    if (parts.length !== 3) return false;
    const [d, m, y] = parts.map((p) => parseInt(p, 10));
    if (!d || !m || !y) return false;
    const slotDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return slotDate < today;
  };

  const handleCancelClick = (slot: LocumSlot) => {
    setPendingCancelSlot(slot);
  };

  const confirmCancel = async () => {
    if (!pendingCancelSlot) return;
    setIsCancelling(true);
    try {
      const response = await onCancelSlot(pendingCancelSlot.id, pendingCancelSlot.status, currentUser.phone);
      setPendingCancelSlot(null);
      setResultMessage(response);
    } catch (err) {
      setResultMessage('⚠️ Something went wrong while withdrawing. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mobile-only Profile & Medals summary — the full Profile & Medals tab
          isn't reachable from the mobile bottom nav, so a compact version
          lives here above the shift list. */}
      <div className="md:hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#011428] to-black border-2 border-[#D4AF37]/30 p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl" />
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <span className="text-[9px] tracking-widest text-amber-400 font-bold uppercase block">
              {currentUser.name}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block">Available balance</span>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-white select-none">
                {currentUser.points}
              </h1>
              <span className="text-amber-400 font-bold font-display text-xs tracking-wider">ARACOINS</span>
            </div>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[#D4AF37]">
            <Trophy className="w-6 h-6 fill-current" />
          </div>
        </div>

        <div className="border-t border-slate-800/80 mt-4 pt-3">
          <span className="text-[9px] tracking-wider text-slate-400 font-bold uppercase block mb-2.5">
            Medal Case
          </span>
          <div className="grid grid-cols-6 gap-2">
            {MOBILE_BADGES_CONFIG.map(config => {
              const count = cumulativeBadgeMap[config.name] || 0;
              const unlocked = count > 0;
              const BadgeIcon = config.Icon;
              return (
                <button
                  key={config.name}
                  title={config.name}
                  onClick={() => setSelectedBadgeDetail(config.name)}
                  className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                >
                  <div
                    className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-md border border-[#D4AF37]/20"
                    style={{
                      background: unlocked ? config.color : '#1e293b',
                      opacity: unlocked ? 1 : 0.25,
                      filter: unlocked ? 'none' : 'grayscale(100%)'
                    }}
                  >
                    <BadgeIcon className="w-4.5 h-4.5 text-white" />
                    {unlocked && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center border border-white">
                        {count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Badge detail modal */}
      {selectedBadgeDetail && (() => {
        const config = MOBILE_BADGES_CONFIG.find(c => c.name === selectedBadgeDetail);
        if (!config) return null;
        const BadgeIcon = config.Icon;
        const total = cumulativeBadgeMap[config.name] || 0;
        const breakdown = (monthlyBreakdown[config.name] || []).sort((a, b) => {
          const [ma, ya] = a.month.split('/');
          const [mb, yb] = b.month.split('/');
          return yb === ya ? mb.localeCompare(ma) : yb.localeCompare(ya);
        });
        return (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedBadgeDetail(null)}
          >
            <div
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-md shrink-0"
                  style={{ background: total > 0 ? config.color : '#1e293b', opacity: total > 0 ? 1 : 0.3 }}
                >
                  <BadgeIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-800">{config.name}</h4>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {total > 0 ? `${total} total, all-time` : 'Not earned yet'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">{config.description}</p>

              {breakdown.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    By month
                  </span>
                  {breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-600">{b.month}</span>
                      <span className="font-bold text-slate-800">×{b.count}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSelectedBadgeDetail(null)}
                className="w-full bg-[#001F3F] text-white font-bold py-3 rounded-xl text-sm"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
          {(['All', 'Approved', 'Pending'] as const).map(fType => (
            <button
              key={fType}
              onClick={() => setFilterType(fType)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                filterType === fType
                  ? 'bg-[#001F3F] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {fType === 'All' ? `All Shifts (${mySlots.length})` : fType === 'Approved' ? 'Approved' : 'Pending'}
            </button>
          ))}
        </div>

        {availableMonths.length > 0 && (
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 outline-none cursor-pointer"
          >
            <option value="All">All Months</option>
            {availableMonths.map((my) => {
              const [m, y] = my.split('/');
              return (
                <option key={my} value={my}>
                  {MONTH_NAMES[parseInt(m, 10) - 1]} {y}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {/* Disclaimers card */}
      <div className="p-3 bg-amber-50/50 border border-amber-200/40 rounded-2xl flex gap-2 text-xs text-amber-800 leading-snug">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="font-semibold font-sans">
          For last-minute cancellations of approved shifts, kindly notify the admin directly via PM as well.
        </p>
      </div>

      {/* Slots List container */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredSlots.length === 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm"
            >
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">No shift requests found matching filter.</p>
              <p className="text-xs">Once you select and book available dates they will compile here.</p>
            </motion.div>
          ) : (
            filteredSlots.map(slot => {
              const isApproved = slot.status === 'Approved';
              const isSK = slot.cawangan.toLowerCase().includes('sk') || slot.cawangan.toLowerCase().includes('seri');

              return (
                <motion.div
                  layout
                  key={slot.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden"
                >
                  <div className="space-y-1.5 pl-2">
                    {/* Location & custom badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSK ? 'bg-sky-600' : 'bg-emerald-600'}`} />
                      <span className="font-display font-bold text-slate-800 text-sm tracking-tight">
                        Klinik ARA {slot.cawangan}
                      </span>
                    </div>

                    {/* DateTime */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-bold text-slate-700">{slot.tarikh}</span>
                      <span className="font-mono">({slot.masa})</span>
                    </div>

                    {/* Booked timer note */}
                    {slot.bookedAt && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        <span>Submitted {slot.bookedAt}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Status indicators */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t border-slate-50 sm:border-0">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}
                    >
                      {slot.status === 'Approved' ? 'Approved ✓' : 'Pending Approval ⌛'}
                    </span>

                    {isPastSlot(slot.tarikh) ? (
                      <span className="text-[10px] text-slate-400 italic px-2.5 py-1">
                        Past shift — contact admin for changes
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCancelClick(slot)}
                        className="text-xs hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold p-2.5 rounded-xl transition flex items-center gap-1"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Withdraw</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* ===================== Confirm Withdraw Dialog ===================== */}
      <AnimatePresence>
        {pendingCancelSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isCancelling && setPendingCancelSlot(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 space-y-5 relative"
            >
              <button
                onClick={() => !isCancelling && setPendingCancelSlot(null)}
                className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-3">
                <AlertTriangle className="w-8 h-8 text-rose-500 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-slate-800 text-base">
                    Cancel this slot?
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to cancel this slot?
                  </p>
                  {pendingCancelSlot.status === 'Approved' && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mt-2 leading-relaxed">
                      For last-minute cancellations, kindly notify the admin directly via PM too.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5 border border-slate-100 text-xs">
                <p className="font-semibold text-slate-700">Klinik ARA {pendingCancelSlot.cawangan}</p>
                <p className="text-slate-500">{pendingCancelSlot.tarikh} &middot; {pendingCancelSlot.masa}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPendingCancelSlot(null)}
                  disabled={isCancelling}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Keep Shift
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={isCancelling}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {isCancelling ? 'Withdrawing...' : 'Yes, Withdraw'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== Result Toast ===================== */}
      <AnimatePresence>
        {resultMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 max-w-[90vw]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{resultMessage}</span>
            <button onClick={() => setResultMessage(null)} className="text-slate-400 hover:text-white ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};