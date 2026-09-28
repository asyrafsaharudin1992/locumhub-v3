import React from 'react';
import { ArrowRight, Award, Bell, CalendarDays, ClipboardList, Clock, BookOpen, ExternalLink, Heart, MessageSquare } from 'lucide-react';
import { AppNotification, FeedbackRecord, LocumSlot, UserProfile } from '../types';

interface DoctorOverviewTabProps {
  slots: LocumSlot[];
  currentUser: UserProfile;
  notifications: AppNotification[];
  feedbacks: FeedbackRecord[];
  onNavigate: (tab: string) => void;
}

const doctorMatches = (slot: LocumSlot, doctor: UserProfile) => {
  if (slot.phone && slot.phone === doctor.phone) return true;
  const normalize = (value: string) => value.toLowerCase().trim().replace(/^dr\.?\s+/i, '');
  const slotName = normalize(slot.dr || '');
  const doctorName = normalize(doctor.name || '');
  if (!slotName || !doctorName) return false;
  if (slotName === doctorName) return true;
  const slotWords = slotName.split(/\s+/).filter(Boolean);
  const doctorWords = doctorName.split(/\s+/).filter(Boolean);
  const [shortWords, longWords] = slotWords.length <= doctorWords.length
    ? [slotWords, doctorWords]
    : [doctorWords, slotWords];
  return shortWords.every(word => longWords.includes(word));
};

const parseShiftDate = (value: string) => {
  const match = String(value || '').match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3]);
  const day = first > 31 ? third : first;
  const month = second;
  const year = first > 31 ? first : third;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const countBadges = (badges: string) => {
  if (!badges.trim()) return 0;
  return badges.split(',').filter(Boolean).reduce((total, item) => {
    const count = Number(item.split(':').pop()?.trim() || 0);
    return total + (Number.isFinite(count) ? count : 0);
  }, 0);
};

const displayBranchName = (branch: string) => {
  const normalized = (branch || '').trim().toLowerCase();
  if (normalized === 'sk' || normalized === 'sk branch' || normalized.includes('seri kembangan')) {
    return 'Seri Kembangan';
  }
  return branch;
};

const getBadgeCounts = (badges: string) => badges.split(',').filter(Boolean).reduce<Record<string, number>>((result, item) => {
  const lastColon = item.lastIndexOf(':');
  const name = item.slice(0, lastColon === -1 ? undefined : lastColon).trim().split('(')[0].trim().replace('Saviour', 'Savior');
  const count = Number(item.slice(lastColon + 1).trim()) || 1;
  result[name] = (result[name] || 0) + count;
  return result;
}, {});

export const DoctorOverviewTab: React.FC<DoctorOverviewTabProps> = ({
  slots,
  currentUser,
  notifications,
  feedbacks,
  onNavigate,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const myUpcomingSlots = slots
    .filter(slot => {
      const shiftDate = parseShiftDate(slot.tarikh);
      return slot.status !== 'Available' && !!shiftDate && shiftDate >= today && doctorMatches(slot, currentUser);
    })
    .sort((a, b) => (parseShiftDate(a.tarikh)?.getTime() || 0) - (parseShiftDate(b.tarikh)?.getTime() || 0));
  const nextShift = myUpcomingSlots[0];
  const unreadCount = notifications.filter(item => item.phone?.trim() === currentUser.phone?.trim() && !item.isRead).length;
  const badgeCount = countBadges(currentUser.badges || '');
  const badgeCounts = getBadgeCounts(currentUser.badges || '');
  const nextShiftDate = nextShift ? parseShiftDate(nextShift.tarikh) : null;
  const isToday = nextShiftDate?.getTime() === today.getTime();
  const hasFeedback = feedbacks.some((feedback) => doctorMatches(
    { dr: feedback.target, phone: '', id: '', tarikh: '', masa: '', cawangan: '', status: 'Available', gaji: 0 },
    currentUser,
  ));

  const quickActions = [
    { label: 'Book Slot', icon: CalendarDays, color: 'text-white', tab: 'booking' },
    { label: 'My Shifts', icon: ClipboardList, color: 'text-white', tab: 'status' },
    { label: 'Inbox', icon: Bell, color: 'text-white', tab: 'notifications', badge: unreadCount },
    { label: 'Medical Toolkits', icon: BookOpen, color: 'text-white', tab: 'announcements' },
    { label: 'Patient Reviews', icon: Heart, color: 'text-white', tab: 'feedback' },
  ];

  const medals = [
    { name: 'Team Favorite', color: 'linear-gradient(135deg, #00DFD8, #007CF0)' },
    { name: 'Heart Winner', color: 'linear-gradient(135deg, #A2FF00, #349300)' },
    { name: 'Last Minute Savior', color: 'linear-gradient(135deg, #FF4D4D, #F9CB28)' },
    { name: 'Iron Doctor', color: 'linear-gradient(135deg, #FF0080, #7928CA)' },
    { name: 'The Unstoppable', color: 'linear-gradient(135deg, #5EE7DF, #B490CA)' },
    { name: 'The Diligent Doc', color: 'linear-gradient(135deg, #F9CB28, #FF4D4D)' },
  ];

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#082f49] via-[#0a3b5d] to-[#0d5078] p-4 text-white shadow-[0_12px_28px_rgba(8,47,73,0.14)] sm:p-5">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-36 w-36 rounded-full bg-indigo-300/10 blur-3xl" />
        <div className="flex items-start justify-between gap-4">
          <div className="relative">
            <span className="text-[10px] font-bold tracking-[0.2em] text-sky-300 uppercase">Next shift</span>
            {nextShift ? (
              <>
                <h4 className="mt-1.5 font-display text-lg font-semibold sm:text-xl">{displayBranchName(nextShift.cawangan)}</h4>
                <p className="mt-1 text-sm text-slate-300">
                  {isToday ? 'Today' : nextShift.tarikh} · {nextShift.masa}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <Clock className="h-4 w-4 text-sky-300" />
                  <span>{nextShift.masa}</span>
                  <span className="text-slate-500">•</span>
                  <span>{nextShift.status}</span>
                </div>
              </>
            ) : (
              <>
                <h4 className="mt-1.5 font-display text-lg font-semibold sm:text-xl">No upcoming shift</h4>
                <p className="mt-1 text-sm text-slate-300">No shift booked yet. Browse available slots when you are ready.</p>
              </>
            )}
          </div>
          <div className={`relative shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${nextShift?.status === 'Approved' ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-300 text-amber-950'}`}>
            {nextShift?.status || 'Open'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(nextShift ? 'status' : 'booking')}
          className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[11px] font-bold text-[#082f49] transition hover:bg-sky-50"
        >
          {nextShift ? 'View my shifts' : 'Browse open slots'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h5 className="font-display text-lg font-bold text-slate-900">Quick Actions</h5>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Shortcuts</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {quickActions.map(({ label, icon: Icon, color, tab, badge }) => (
            <button
              key={tab}
              type="button"
              onClick={() => onNavigate(tab)}
              className="group relative flex min-h-[92px] flex-col justify-between rounded-[20px] border border-slate-700/80 bg-[#082f49] p-3.5 text-left shadow-[0_8px_24px_rgba(8,47,73,0.14)] transition hover:-translate-y-0.5 hover:border-sky-300/60 hover:bg-[#0a3b5d] hover:shadow-md"
            >
              <span className="flex items-center justify-between">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ${color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                {badge ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{badge}</span> : <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-sky-300" />}
              </span>
              <span className="text-xs font-bold text-white">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {hasFeedback && (
        <section className="flex flex-col gap-4 rounded-[24px] border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#082f49] text-sky-200">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#082f49]">Do you have a feedback for us?</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">We would love to hear your feedback so we can continue improving.</p>
            </div>
          </div>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSeQ2Q2T2X2MwNxMRPgHsJ-KOiXZRiMsySqEjmpugl7BdM7-vQ/viewform?usp=sharing&ouid=116024380302904367898"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#082f49] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0d5078]"
          >
            Give feedback <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      )}

      <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <div className="bg-gradient-to-r from-[#082f49] to-[#123f61] p-5 text-white sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-amber-300 uppercase">Ara Locum Elite Club</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold">{currentUser.points || 0}</span>
              <span className="text-sm font-bold text-amber-300 uppercase">Aracoins</span>
            </div>
          </div>
          <Award className="h-6 w-6 text-amber-300" />
        </div>
        </div>
        <div className="p-5 sm:p-7">
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-2xl border border-slate-700/80 bg-[#082f49] p-3 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg">
              <Award className="h-6 w-6 text-white" />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-300">Badges earned</p>
            <p className="mt-0.5 text-xl font-black text-white">{badgeCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">All medals</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#082f49] p-3 sm:grid-cols-6">
              {medals.map(({ name, color }) => {
                const count = badgeCounts[name] || 0;
                const unlocked = count > 0;
                return (
                <div key={name} className="group flex min-w-0 flex-col items-center gap-1 text-center" title={name}>
                  <div
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/20 shadow-lg transition group-hover:scale-105 sm:h-11 sm:w-11"
                    style={{
                      background: unlocked ? color : '#1e293b',
                      opacity: unlocked ? 1 : 0.25,
                      filter: unlocked ? 'none' : 'grayscale(100%)',
                    }}
                  >
                    <Award className="h-5 w-5 text-white" />
                    {unlocked && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-rose-500 text-[8px] font-black text-white">{count}</span>}
                  </div>
                  <span className={`line-clamp-2 text-[8px] font-bold leading-tight ${unlocked ? 'text-amber-400' : 'text-slate-500'}`}>{name}</span>
                </div>
                );
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700"
        >
          View medals <ArrowRight className="h-3.5 w-3.5" />
        </button>
        </div>
      </section>
    </div>
  );
};
