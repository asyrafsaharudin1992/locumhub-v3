import React, { useEffect, useState } from 'react';
import { Mail, GraduationCap, Phone, FileText, CheckCircle, ExternalLink, BadgeAlert, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { NewApplication } from '../types';

interface RecruitmentListProps {
  applications: NewApplication[];
}

export const RecruitmentList: React.FC<RecruitmentListProps> = ({ applications }) => {
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(applications.length / PAGE_SIZE));
  const visibleApplications = applications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <div className="w-full space-y-3">
      {applications.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-200 text-center text-slate-400">
          <BadgeAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold">No new applications at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visibleApplications.map((app, index) => (
            <article key={index} className="rounded-[24px] border border-slate-700/80 bg-gradient-to-br from-[#082f49] via-[#0a3b5d] to-[#0d5078] p-5 text-white shadow-[0_8px_24px_rgba(8,47,73,0.14)] transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h6 className="truncate font-display text-base font-bold text-white">{app.nama}</h6>
                  <span className="mt-1 block text-[10px] font-medium uppercase text-slate-300">{app.timestamp}</span>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-sky-200">Candidate</span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                <div className="rounded-xl bg-white/10 p-2.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wide text-sky-200">MMC number</span>
                  <span className="mt-1 block font-mono font-bold text-white">{app.mmc || 'N/A'}</span>
                </div>
                <div className="rounded-xl bg-white/10 p-2.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wide text-sky-200">Phone number</span>
                  <span className="mt-1 block font-mono font-bold text-white">{app.phone || 'N/A'}</span>
                </div>
              </div>

              {app.skills && <p className="mt-3 line-clamp-2 text-xs italic leading-relaxed text-slate-300">Skills: {app.skills}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                {app.apc && <a href={app.apc} target="_blank" rel="noopener noreferrer" className="rounded-full border border-sky-200/20 bg-sky-300/10 px-2.5 py-1 text-[10px] font-bold text-sky-100 transition hover:bg-sky-300/20">APC 2026</a>}
                {app.ins && <a href={app.ins} target="_blank" rel="noopener noreferrer" className="rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2.5 py-1 text-[10px] font-bold text-indigo-100 transition hover:bg-indigo-300/20">Indemnity insurance</a>}
                {app.cvUrl && <a href={app.cvUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-rose-200/20 bg-rose-300/10 px-2.5 py-1 text-[10px] font-bold text-rose-100 transition hover:bg-rose-300/20">Resume</a>}
                <a
                  href={`https://wa.me/${app.phone.replace(/^0/, '60')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-400"
                >
                  <Phone className="h-3 w-3" />
                  WhatsApp
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {applications.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-3 py-3">
          <button
            type="button"
            onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
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
            onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
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
