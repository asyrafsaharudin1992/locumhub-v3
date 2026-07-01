import React from 'react';
import { Mail, GraduationCap, Phone, FileText, CheckCircle, ExternalLink, BadgeAlert, Send } from 'lucide-react';
import { NewApplication } from '../types';

interface RecruitmentListProps {
  applications: NewApplication[];
}

export const RecruitmentList: React.FC<RecruitmentListProps> = ({ applications }) => {
  return (
    <div className="w-full overflow-x-auto">
      {applications.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-200 text-center text-slate-400">
          <BadgeAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold">No new applications at the moment.</p>
        </div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-4 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Doctor</th>
              <th className="py-4 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Details</th>
              <th className="py-4 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.map((app, index) => (
              <tr key={index} className="hover:bg-slate-50/50 transition">
                <td className="py-5 px-4">
                  <div className="flex flex-col gap-1">
                    <h6 className="font-display font-bold text-slate-900 text-sm">{app.nama}</h6>
                    <span className="text-[10px] text-slate-400 font-medium uppercase block">{app.timestamp}</span>
                    <div className="font-mono text-slate-700 font-bold text-xs mt-1">MMC Number: {app.mmc || "N/A"}</div>
                    {app.skills && <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">Your skills: {app.skills}</p>}
                  </div>
                </td>
                <td className="py-5 px-4 text-xs">
                  <div className="flex flex-col gap-2">
                    {app.apc && <a href={app.apc} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 block w-fit">APC 2026</a>}
                    {app.ins && <a href={app.ins} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 block w-fit">Indemnity insurance</a>}
                    {app.cvUrl && <a href={app.cvUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 block w-fit">Resume</a>}
                    <div className="text-slate-600">Phone number: {app.phone}</div>
                  </div>
                </td>
                <td className="py-5 px-4">
                  <a
                    href={`https://wa.me/${app.phone.replace(/^0/, '60')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-2 px-4 rounded-lg transition inline-flex items-center gap-1.5 shadow-sm uppercase tracking-wide"
                  >
                    <Phone className="w-3 h-3" />
                    WhatsApp
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
