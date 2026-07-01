import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, CheckCircle, Trash2, Calendar, MapPin, BellOff } from "lucide-react";
import { AppNotification, UserProfile } from "../types";

interface DoctorNotificationsTabProps {
  notifications: AppNotification[];
  currentUser: UserProfile;
  onDeleteNotification: (id: string) => void;
  onMarkRead: (phone: string) => void;
}

export const DoctorNotificationsTab: React.FC<DoctorNotificationsTabProps> = ({
  notifications,
  currentUser,
  onDeleteNotification,
  onMarkRead,
}) => {
  // Mark all notifications for the current doctor as read upon opening this view
  useEffect(() => {
    if (currentUser?.phone) {
      onMarkRead(currentUser.phone);
    }
  }, [currentUser?.phone, onMarkRead]);

  // Filter to notifications belonging to this doctor
  const myNotifications = (notifications || []).filter(
    (n) => n.phone?.trim() === currentUser?.phone?.trim()
  );

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#001F3F] p-5 rounded-3xl text-white shadow-sm">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#007AFF] uppercase block">
            Inbox Hub
          </span>
          <h4 className="font-display font-bold text-base sm:text-lg">
            Doctor Notifications
          </h4>
          <p className="text-xs text-slate-300 mt-1">
            Real-time updates regarding your ARA clinical schedules and shift approvals.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 w-fit">
          <Mail className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold font-mono">
            {myNotifications.length} Total Messages
          </span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {myNotifications.length === 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm"
            >
              <BellOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">
                You have no notifications or messages at this time.
              </p>
            </motion.div>
          ) : (
            myNotifications.map((notif) => (
              <motion.div
                layout
                key={notif.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white rounded-2xl border ${
                  notif.isRead ? "border-slate-100/80" : "border-rose-100 bg-rose-50/10"
                } p-5 shadow-sm flex items-start justify-between gap-4 transition-all relative overflow-hidden`}
              >
                {/* Red/un-read stripe on left if unread */}
                {!notif.isRead && (
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500" />
                )}

                <div className="flex gap-4 items-start pl-2">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    notif.isRead ? "bg-slate-50 text-slate-400" : "bg-emerald-50 text-emerald-600"
                  }`}>
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-display font-bold text-slate-800 text-sm tracking-tight">
                        {notif.title}
                      </h5>
                      {!notif.isRead && (
                        <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Received {notif.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteNotification(notif.id)}
                  title="Delete message"
                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
