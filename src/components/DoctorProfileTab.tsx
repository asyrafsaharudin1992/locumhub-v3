import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BadgeModal } from './BadgeModal';
import { Trophy, Award, Mail, Key, ShieldCheck, Eye, Upload, FileCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { UserProfile } from '../types';
import { fetchDriveFolderFiles, findDoctorFile, DriveFile } from '../googleDriveService';

interface DoctorProfileTabProps {
  currentUser: UserProfile;
  onChangePassword: (phone: string, pass: string) => Promise<string>;
  onUpdateProfile: (
    phone: string,
    email: string,
    mmc: string,
    apc: string,
    indStatus: string,
    indemnityFile: string,
    workplace: string
  ) => string;
  onUploadFile: (
    file: File,
    phone: string,
    kind: 'apc' | 'indemnity' | 'mmc'
  ) => Promise<{ url: string | null; error?: string }>;
}

export const DoctorProfileTab: React.FC<DoctorProfileTabProps> = ({
  currentUser,
  onChangePassword,
  onUpdateProfile,
  onUploadFile
}) => {
  // Local states for edit form
  const [email, setEmail] = useState(currentUser.email || '');
  const [workplace, setWorkplace] = useState(currentUser.workplace || '');
  const [mmc, setMmc] = useState((currentUser.mmc || '').split('|')[0].trim());
  const [indStatus, setIndStatus] = useState((currentUser.indemnity || '').includes('Ada') ? 'Ada' : 'Tiada');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Real uploaded file URLs (populated once the upload to storage completes)
  const [apcUploadedUrl, setApcUploadedUrl] = useState<string>('');
  const [indUploadedUrl, setIndUploadedUrl] = useState<string>('');
  const [apcFileName, setApcFileName] = useState<string>('');
  const [indFileName, setIndFileName] = useState<string>('');
  const [uploadingApc, setUploadingApc] = useState(false);
  const [uploadingInd, setUploadingInd] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Match existing uploaded documents from the shared Drive folder by doctor name
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  useEffect(() => {
    fetchDriveFolderFiles().then(setDriveFiles);
  }, []);
  const matchedApcUrl = findDoctorFile(driveFiles, currentUser.name, 'apc');
  const matchedMmcUrl = findDoctorFile(driveFiles, currentUser.name, 'mmc');
  const matchedIndemnityUrl = findDoctorFile(driveFiles, currentUser.name, 'indemnity');

  // Badge Modal trigger state
  const [activeBadge, setActiveBadge] = useState<{
    isOpen: boolean;
    name: string;
    desc: string;
    icon: string;
    color: string;
  }>({
    isOpen: false,
    name: '',
    desc: '',
    icon: '',
    color: ''
  });

  // Calculate medals counts based on badges raw string e.g. "Team Favorite:2, Heart Winner:1"
  const badgeMap: { [key: string]: number } = {};
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
      const cleanName = namePart.split('(')[0].trim();
      badgeMap[cleanName] = Math.max(badgeMap[cleanName] || 0, count);
    });
  }

  const BADGES_CONFIG = [
    { name: 'Team Favorite', icon: 'bi-people-fill', color: 'linear-gradient(135deg, #00DFD8, #007CF0)', desc: 'Awarded for being the most helpful doctor voted by clinic staff.' },
    { name: 'Heart Winner', icon: 'bi-heart-fill', color: 'linear-gradient(135deg, #A2FF00, #349300)', desc: 'Name mentioned by a patient in a 5-star Google Review.' },
    { name: 'Last Minute Savior', icon: 'bi-shield-shaded', color: 'linear-gradient(135deg, #FF4D4D, #F9CB28)', desc: 'Covered an open slot with less than 48 hours notice.' },
    { name: 'Iron Doctor', icon: 'bi-lightning-fill', color: 'linear-gradient(135deg, #FF0080, #7928CA)', desc: 'Completed a marathon 12-hour clinic shift.' },
    { name: 'The Unstoppable', icon: 'bi-infinity', color: 'linear-gradient(135deg, #5EE7DF, #B490CA)', desc: 'High consistency: Completed 2 approved slots in a single month with zero cancellations.' },
    { name: 'The Diligent Doc', icon: 'bi-book-fill', color: 'linear-gradient(135deg, #F9CB28, #FF4D4D)', desc: 'Attended a Klinik ARA CME briefing session or training syllabus.' }
  ];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !mmc) {
      alert("⚠️ Email and MMC declaration are compulsory fields.");
      return;
    }
    if (uploadingApc || uploadingInd) {
      alert("⏳ Please wait for the file upload to finish before saving.");
      return;
    }

    setIsSavingProfile(true);
    const apcToSave = apcUploadedUrl || currentUser.apc;
    const response = onUpdateProfile(
      currentUser.phone,
      email,
      mmc,
      apcToSave,
      indStatus,
      indUploadedUrl,
      workplace
    );
    setIsSavingProfile(false);
    alert(response);
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 6) {
      alert("⚠️ Password must be at least 6 characters.");
      return;
    }
    setIsSavingPassword(true);
    const response = await onChangePassword(currentUser.phone, newPassword);
    setIsSavingPassword(false);
    alert(response);
    if (!response.startsWith("⚠️")) {
      setNewPassword('');
    }
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'apc' | 'indemnity'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploading = kind === 'apc' ? setUploadingApc : setUploadingInd;
    const setUrl = kind === 'apc' ? setApcUploadedUrl : setIndUploadedUrl;
    const setFileName = kind === 'apc' ? setApcFileName : setIndFileName;

    setFileName(file.name);
    setUploading(true);
    const result = await onUploadFile(file, currentUser.phone, kind);
    setUploading(false);

    if (result.url) {
      setUrl(result.url);
    } else {
      alert(`⚠️ Failed to upload ${file.name}.\n\nReason: ${result.error || 'Unknown error'}`);
      setFileName('');
    }
  };

  const extractIndemnityUrl = (raw: string): string => {
    if (!raw || !raw.includes('http')) return '';
    const parts = raw.split('|');
    return parts.length > 1 ? parts[1].trim() : '';
  };

  const handleViewFile = (url: string | null | undefined) => {
    if (!url || !url.startsWith('http')) {
      alert("⚠️ No file is available to view yet — upload one and save your profile first.");
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Premium dark Aracoins card wallet */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-[#011428] to-black border-2 border-[#D4AF37]/30 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] tracking-widest text-amber-400 font-bold uppercase block">
              Ara Locum elite club
            </span>
            <span className="text-xs text-slate-400 font-semibold block">Available balance</span>
            <div className="flex items-baseline gap-1.5 pt-1">
              <h1 className="font-display text-5xl font-extrabold tracking-tight text-white select-none">
                {currentUser.points}
              </h1>
              <span className="text-amber-400 font-bold font-display text-sm tracking-wider">ARACOINS</span>
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-[#D4AF37]">
            <Trophy className="w-8 h-8 fill-current" />
          </div>
        </div>

        {/* Medal Case heading */}
        <div className="border-t border-slate-800/80 mt-5 pt-4">
          <span className="text-[10px] tracking-wider text-slate-400 font-bold uppercase block mb-3">
            Your Apple Fitness style Medal Case
          </span>

          {/* Medals grid carousel */}
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-3 pt-2">
            {BADGES_CONFIG.map(config => {
              const count = badgeMap[config.name] || 0;
              const unlocked = count > 0;

              return (
                <div
                  key={config.name}
                  onClick={() =>
                    setActiveBadge({
                      isOpen: true,
                      name: config.name,
                      desc: config.desc,
                      icon: config.icon,
                      color: config.color
                    })
                  }
                  className="flex flex-col items-center justify-between cursor-pointer group text-center space-y-1.5"
                >
                  <div
                    className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg border border-[#D4AF37]/20 transition group-hover:scale-105"
                    style={{
                      background: unlocked ? config.color : '#1e293b',
                      opacity: unlocked ? 1 : 0.25,
                      filter: unlocked ? 'none' : 'grayscale(100%)'
                    }}
                  >
                    <Award className="w-6 h-6 text-white" />
                    {unlocked && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center border border-white">
                        {count}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight line-clamp-1 select-none ${
                    unlocked ? 'text-amber-400' : 'text-slate-500'
                  }`}>
                    {config.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Profile Edit Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h5 className="font-display font-bold text-slate-900 tracking-tight text-sm">Update Profile Credentials</h5>
          <p className="text-xs text-slate-500">Keep credentials updated to avoid instant scheduling lockouts</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-1 sm:col-span-2 columns-auto">
              <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Primary Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-850 font-semibold"
                placeholder="doctor_ara@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Workplace affiliation
              </label>
              <input
                type="text"
                value={workplace}
                onChange={e => setWorkplace(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-850 font-semibold"
                placeholder="e.g. Serdang General Hospital"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                MMC Reg Number *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={mmc}
                  onChange={e => setMmc(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-850 font-mono font-bold"
                  placeholder="e.g. 54321"
                />
                {matchedMmcUrl && (
                  <button
                    type="button"
                    onClick={() => handleViewFile(matchedMmcUrl)}
                    className="bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 p-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 shrink-0"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View MMC</span>
                  </button>
                )}
              </div>
            </div>

            {/* APC file upload */}
            <div className="space-y-1.5 bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Upload APC Certificate 2026 *
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  id="apc-picker"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={e => handleFileSelect(e, 'apc')}
                />
                <label
                  htmlFor="apc-picker"
                  className="cursor-pointer bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold font-sans text-slate-600 hover:text-indigo-900 hover:bg-slate-50 flex items-center gap-1 shadow-sm transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload PDF
                </label>
                {apcFileName ? (
                  <span className="text-[10px] text-emerald-605 font-bold truncate flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
                    {apcFileName}
                  </span>
                ) : uploadingApc ? (
                  <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">No file selected</span>
                )}
              </div>

              {(matchedApcUrl || currentUser.apc) && (
                <button
                  type="button"
                  onClick={() => handleViewFile(matchedApcUrl || apcUploadedUrl || currentUser.apc)}
                  className="text-indigo-700 font-bold hover:underline text-[10px] flex items-center gap-1 mt-1.5 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  View current validated APC
                </button>
              )}
            </div>

            {/* Indemnity options */}
            <div className="space-y-1.5 bg-slate-50 border border-slate-200 p-4 rounded-xl col-span-1">
              <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Indemnity insurance policy
              </label>
              <div className="flex gap-4 mb-2 pt-1">
                <label className="flex items-center gap-1 text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="indStatus"
                    checked={indStatus === 'Ada'}
                    onChange={() => setIndStatus('Ada')}
                    className="accent-indigo-600"
                  />
                  <span>Ada (Covered)</span>
                </label>
                <label className="flex items-center gap-1 text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="indStatus"
                    checked={indStatus === 'Tiada'}
                    onChange={() => setIndStatus('Tiada')}
                    className="accent-indigo-600"
                  />
                  <span>Tiada (Not covered)</span>
                </label>
              </div>

              {indStatus === 'Ada' && (
                <div className="space-y-2">
                  <input
                    type="file"
                    id="ind-picker"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={e => handleFileSelect(e, 'indemnity')}
                  />
                  <div className="flex gap-2 items-center">
                    <label
                      htmlFor="ind-picker"
                      className="cursor-pointer bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold font-sans text-slate-600 hover:text-indigo-900 hover:bg-slate-50 flex items-center gap-1 shadow-sm transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Policy PDF
                    </label>
                    {indFileName ? (
                      <span className="text-[10px] text-emerald-605 font-bold truncate flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5 flex-shrink-0" />
                        {indFileName}
                      </span>
                    ) : uploadingInd ? (
                      <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
                        Uploading...
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">No file selected</span>
                    )}
                  </div>
                  {(matchedIndemnityUrl || indUploadedUrl || currentUser.indemnity?.includes('http')) && (
                    <button
                      type="button"
                      onClick={() => handleViewFile(matchedIndemnityUrl || indUploadedUrl || extractIndemnityUrl(currentUser.indemnity))}
                      className="text-emerald-700 font-bold hover:underline text-[10px] flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      View validated Indemnity Policy
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingProfile || uploadingApc || uploadingInd}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition cursor-pointer font-sans text-xs uppercase tracking-wider disabled:opacity-60"
          >
            Save Profile Credentials
          </button>
        </form>
      </div>

      {/* Security Update Password Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-rose-500" />
          <h5 className="font-display font-bold text-slate-900 tracking-tight text-sm">Security Password Change</h5>
        </div>
        <p className="text-xs text-slate-500 font-sans leading-relaxed">
          Passwords are mathematically protected inside your workspace persistence registry.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm font-semibold"
            placeholder="Minimum 6 characters for safety plan"
          />
          <button
            type="button"
            onClick={handlePasswordUpdate}
            disabled={isSavingPassword}
            className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold px-5 py-3 rounded-xl text-xs transition border border-rose-100 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {isSavingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isSavingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* Decorative Badge Modal popup */}
      <BadgeModal
        isOpen={activeBadge.isOpen}
        onClose={() => setActiveBadge(prev => ({ ...prev, isOpen: false }))}
        badgeName={activeBadge.name}
        badgeDesc={activeBadge.desc}
        badgeIcon={activeBadge.icon}
        badgeColor={activeBadge.color}
      />
    </div>
  );
};
