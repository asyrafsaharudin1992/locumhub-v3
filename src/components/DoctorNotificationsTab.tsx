import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, CheckCircle, Trash2, Calendar, BellOff, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { Announcement, AppNotification, UserProfile } from "../types";

interface DoctorNotificationsTabProps {
  notifications: AppNotification[];
  announcements: Announcement[];
  currentUser: UserProfile;
  onDeleteNotification: (id: string) => void;
  onMarkRead: (phone: string) => void;
}

export const DoctorNotificationsTab: React.FC<DoctorNotificationsTabProps> = ({
  notifications,
  announcements,
  currentUser,
  onDeleteNotification,
  onMarkRead,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [inboxFilter, setInboxFilter] = useState<"All" | "Unread">("All");
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 20;

  // Mark all notifications for the current doctor as read upon opening this view
  useEffect(() => {
    if (currentUser?.phone) {
      onMarkRead(currentUser.phone);
    }
  }, [currentUser?.phone, onMarkRead]);

  // Filter to notifications belonging to this doctor
  const notificationTime = (value: string) => {
    const enGb = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})$/);
    if (enGb) {
      return new Date(
        Number(enGb[3]),
        Number(enGb[2]) - 1,
        Number(enGb[1]),
        Number(enGb[4]),
        Number(enGb[5]),
        Number(enGb[6]),
      ).getTime();
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const myNotifications = (notifications || [])
    .filter((n) => n.phone?.trim() === currentUser?.phone?.trim())
    .sort((a, b) => notificationTime(b.timestamp) - notificationTime(a.timestamp));
  const unreadNotifications = myNotifications.filter((notification) => !notification.isRead);
  const pinnedAnnouncements = announcements || [];
  const visibleNotifications = inboxFilter === "Unread" ? unreadNotifications : myNotifications;
  const totalPages = Math.max(1, Math.ceil(visibleNotifications.length / PAGE_SIZE));
  const paginatedNotifications = visibleNotifications.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [inboxFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col space-y-6">
      {/* Inbox Header */}
      <div className="rounded-[28px] bg-gradient-to-br from-[#082f49] via-[#0a3b5d] to-[#0d5078] p-5 text-white shadow-[0_12px_30px_rgba(8,47,73,0.14)] sm:p-6">
        <div>
          <span className="text-[10px] font-bold tracking-[0.18em] text-indigo-500 uppercase block">Inbox</span>
          <h4 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">Doctor Notifications</h4>
          <p className="mt-1 text-sm text-slate-300">Shift approvals and important updates.</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["All", "Unread"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setInboxFilter(filter)}
                className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                  inboxFilter === filter
                    ? "bg-[#082f49] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {filter} ({filter === "All" ? myNotifications.length : unreadNotifications.length})
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => currentUser?.phone && onMarkRead(currentUser.phone)}
            disabled={unreadNotifications.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Mark all as read
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Mail className="h-3.5 w-3.5" />
            {myNotifications.length} total
          </span>
        </div>
      </div>

      {pinnedAnnouncements.length > 0 && (
        <div className="order-2 space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <h5 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Pinned</h5>
          </div>
          {pinnedAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-[0_4px_18px_rgba(15,23,42,0.03)]"
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-indigo-400" />
              <div className="flex items-start gap-3 pl-1">
                <div className="rounded-full bg-white p-2 text-indigo-600 shadow-sm">
                  <Pin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="font-display text-sm font-bold text-slate-900">Noticeboard</h5>
                    <span className="text-[10px] font-semibold text-slate-400">{announcement.date}</span>
                  </div>
                  {(() => {
                    const isExpanded = expandedAnnouncements.has(announcement.id);
                    const isLong = announcement.text.length > 280;
                    const displayedText = isExpanded || !isLong
                      ? announcement.text
                      : `${announcement.text.slice(0, 280).trimEnd()}…`;
                    return (
                      <>
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                          {displayedText}
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => setExpandedAnnouncements((previous) => {
                              const next = new Set(previous);
                              if (next.has(announcement.id)) next.delete(announcement.id);
                              else next.add(announcement.id);
                              return next;
                            })}
                            className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            {isExpanded ? "Show less" : "Read more"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notifications List */}
      <div className="order-1 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {visibleNotifications.length === 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm"
            >
              <BellOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">{inboxFilter === "Unread" ? "All caught up!" : "No notifications yet"}</p>
              <p className="text-xs text-slate-500 mt-1">
                You have no notifications or messages at this time.
              </p>
            </motion.div>
          ) : (
            paginatedNotifications.map((notif) => (
              <motion.div
                layout
                key={notif.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group bg-white rounded-2xl border ${
                  notif.isRead ? "border-slate-100/80" : "border-rose-100 bg-rose-50/10"
                } p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] flex items-start justify-between gap-3 transition-all relative overflow-hidden hover:border-indigo-100`}
              >
                {/* Red/un-read stripe on left if unread */}
                {!notif.isRead && (
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500" />
                )}

                <div className="flex min-w-0 gap-3.5 items-start pl-1">
                  <div className={`p-2.5 rounded-full flex-shrink-0 ${
                    notif.isRead ? "bg-blue-50 text-blue-500" : "bg-indigo-50 text-indigo-600"
                  }`}>
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-display font-bold text-slate-900 text-sm tracking-tight">
                        {notif.title}
                      </h5>
                      {!notif.isRead && (
                        <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500 font-sans font-medium">
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

                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => onDeleteNotification(notif.id)}
                    title="Delete message"
                    className="rounded-xl p-2 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {visibleNotifications.length > PAGE_SIZE && (
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
          <span className="text-xs font-semibold text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
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
