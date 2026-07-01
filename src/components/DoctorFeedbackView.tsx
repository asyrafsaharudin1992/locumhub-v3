import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, MessageSquare, ShieldAlert, Sparkles, Filter } from 'lucide-react';
import { FeedbackRecord } from '../types';

interface DoctorFeedbackViewProps {
  feedbacks: FeedbackRecord[];
}

export const DoctorFeedbackView: React.FC<DoctorFeedbackViewProps> = ({ feedbacks }) => {
  const [filterRating, setFilterRating] = useState<'All' | 'FiveStar'>('All');

  const filteredFeedbacks = filterRating === 'All'
    ? feedbacks
    : feedbacks.filter(f => f.rating >= 4.8);

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
          <p className="text-xs text-slate-300">Google Search and automated patient feedback</p>
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

      {/* Control panel and disclaimers */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex gap-1.5 text-xs text-indigo-800 leading-snug">
          <ShieldAlert className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="font-medium">
            This workspace takes patient privacy seriously. Selected logs are cleared on sign-out and visible solely inside your account.
          </p>
        </div>

        {/* Filter Pill Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end sm:self-auto border border-slate-200/50">
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
      </div>

      {/* Feed list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            filteredFeedbacks.map((f, i) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                key={i}
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-3 relative overflow-hidden"
              >
                {/* Visual marker bar to prevent generic look */}
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#001F3F]" />

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
    </div>
  );
};
