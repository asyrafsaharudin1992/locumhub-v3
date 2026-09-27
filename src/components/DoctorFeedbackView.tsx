import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, MessageSquare, ShieldAlert, Sparkles, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { FeedbackRecord } from '../types';

interface DoctorFeedbackViewProps {
  feedbacks: FeedbackRecord[];
}

export const DoctorFeedbackView: React.FC<DoctorFeedbackViewProps> = ({ feedbacks }) => {
  const [filterRating, setFilterRating] = useState<'All' | 'FiveStar'>('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const parseFeedbackDate = (value: string): Date | null => {
    const parts = (value || '').split(/[\s,/:-]+/).filter(Boolean);
    if (parts.length >= 3) {
      const [day, month, year] = parts.slice(0, 3).map(Number);
      if (day && month && year) {
        const fullYear = year < 100 ? 2000 + year : year;
        const date = new Date(fullYear, month - 1, day);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  };

  const monthLabel = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const availableLocations: string[] = Array.from(
    new Set<string>(
      feedbacks
        .map((feedback) => feedback.cawangan?.trim())
        .filter((location): location is string => Boolean(location)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const availableMonths: string[] = Array.from(
    new Set<string>(
      feedbacks
        .map((feedback) => parseFeedbackDate(feedback.tarikh))
        .filter((date): date is Date => Boolean(date))
        .map(monthLabel),
    ),
  ).sort((a, b) => b.localeCompare(a));

  const filteredFeedbacks = feedbacks.filter((feedback) => {
    if (filterRating === 'FiveStar' && feedback.rating < 4.8) return false;
    if (locationFilter !== 'All' && feedback.cawangan?.trim() !== locationFilter) return false;
    if (monthFilter !== 'All') {
      const date = parseFeedbackDate(feedback.tarikh);
      if (!date || monthLabel(date) !== monthFilter) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredFeedbacks.length / PAGE_SIZE));
  const paginatedFeedbacks = filteredFeedbacks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterRating, locationFilter, monthFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const averageRating = feedbacks.length > 0
    ? feedbacks.reduce((acc, curr) => acc + curr.rating, 0) / feedbacks.length
    : 5.0;

  // Render Star Utility
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5 text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < Math.floor(rating);
          const half = !filled && i === Math.floor(rating) && rating % 1 >= 0.5;
          return (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${filled ? 'fill-current' : half ? 'opacity-80' : 'text-slate-200'}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Summary banner */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-900 to-[#001F3F] p-5 text-white shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[10px] tracking-widest text-sky-300 font-bold uppercase block">
            CONFIDENTIAL EVALUATIONS
          </span>
          <h5 className="font-display text-lg font-bold">Your Performance Index</h5>
          <p className="text-xs text-slate-300">Every review reflects the care you give — keep it up!</p>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="font-display text-3xl font-black">{averageRating.toFixed(1)}</span>
            <span className="text-sm font-semibold opacity-70">/ 5.0</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-1 justify-end">
            {renderStars(averageRating)}
          </div>
        </div>
      </div>

      {/* Control panel and filters */}
      <div className="space-y-3">
        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex gap-1.5 text-xs text-indigo-800 leading-snug">
          <ShieldAlert className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="font-medium">
            This workspace takes patient privacy seriously. Selected logs are cleared on sign-out and visible solely inside your account.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setFilterRating('All')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
              filterRating === 'All' ? 'bg-[#001F3F] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            All Reviews ({feedbacks.length})
          </button>
          <button
            onClick={() => setFilterRating('FiveStar')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
              filterRating === 'FiveStar' ? 'bg-[#001F3F] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            5-Star Only ({feedbacks.filter(f => f.rating >= 4.8).length})
          </button>
          </div>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none transition focus:border-indigo-300"
          >
            <option value="All">All locations</option>
            {availableLocations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none transition focus:border-indigo-300"
          >
            <option value="All">All months</option>
            {availableMonths.map((month) => {
              const [year, monthNumber] = month.split('-');
              const label = new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
              return <option key={month} value={month}>{label}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Feed list */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout" >
          {filteredFeedbacks.length === 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full bg-white p-12 text-center rounded-3xl border border-dashed border-slate-200 text-slate-400"
            >
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">No feedback records found matching this filter.</p>
              <p className="text-xs">Once patients rate your sessions they'll appear here.</p>
            </motion.div>
          ) : (
            paginatedFeedbacks.map((f, i) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                key={f.id || `${f.tarikh}-${f.reviewer}-${i}`}
                className="relative space-y-3 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 p-5 transition-colors hover:border-slate-300"
              >
                <div className="flex justify-between items-start pl-2">
                  <div>
                    <h6 className="font-display font-bold text-slate-800 text-xs sm:text-sm tracking-tight mb-0.5">
                      {f.reviewer}
                    </h6>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      📌 {f.target} · {f.tarikh}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-mono font-black text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                      ⭐ {f.rating.toFixed(1)}
                    </span>
                    {renderStars(f.rating)}
                  </div>
                </div>

                <div className="pl-2">
                  <p className="text-xs sm:text-sm italic font-sans text-slate-600 leading-relaxed">
                    "{f.komen}"
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {filteredFeedbacks.length > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-xs font-semibold text-slate-500">Page {currentPage} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
