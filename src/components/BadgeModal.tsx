import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Trophy, Heart, Shield, Zap, Infinity as InfinityIcon, BookOpen, X } from 'lucide-react';

interface BadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  badgeName: string;
  badgeDesc: string;
  badgeIcon: string;
  badgeColor: string;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({
  isOpen,
  onClose,
  badgeName,
  badgeDesc,
  badgeIcon,
  badgeColor
}) => {
  const renderIcon = (iconName: string, sizeClass = "w-12 h-12") => {
    switch (iconName) {
      case 'bi-people-fill':
        return <Award className={`${sizeClass} text-white`} />;
      case 'bi-heart-fill':
        return <Heart className={`${sizeClass} text-white fill-current`} />;
      case 'bi-shield-shaded':
        return <Shield className={`${sizeClass} text-white`} />;
      case 'bi-lightning-fill':
        return <Zap className={`${sizeClass} text-white fill-current`} />;
      case 'bi-infinity':
        return <InfinityIcon className={`${sizeClass} text-white`} />;
      case 'bi-book-fill':
        return <BookOpen className={`${sizeClass} text-white`} />;
      default:
        return <Trophy className={`${sizeClass} text-white`} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Radiant glowing circle behind badge */}
            <div className="relative mx-auto my-6 flex h-24 w-24 items-center justify-center rounded-full shadow-lg border-2 border-[#D4AF37]"
                 style={{ background: badgeColor }}>
              <div className="absolute inset-0 -z-10 animate-pulse rounded-full opacity-30 blur-md" style={{ background: badgeColor }} />
              {renderIcon(badgeIcon, "w-10 h-10")}
            </div>

            {/* Medal Title */}
            <h3 className="font-display text-xl font-bold text-slate-900 tracking-tight mb-2">
              {badgeName}
            </h3>

            {/* Badge Points */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/50 mb-4">
              <Trophy className="w-4 h-4 text-amber-500 fill-current" />
              <span className="text-xs font-semibold text-amber-700 tracking-wider">
                {badgeName === 'Team Favorite' ? '20' : badgeName === 'Iron Doctor' || badgeName === 'The Unstoppable' || badgeName === 'The Diligent Doc' ? '10' : '15'} ARACOINS
              </span>
            </div>

            {/* Description */}
            <p className="text-sm font-sans text-slate-500 leading-relaxed max-w-xs mx-auto mb-6">
              {badgeDesc}
            </p>

            {/* Confirm button */}
            <button
              onClick={onClose}
              className="w-full bg-[#001F3F] text-white hover:bg-[#001226] font-semibold py-3 px-4 rounded-2xl shadow-md transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
