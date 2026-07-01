import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppState } from "./useAppState";
import { NewApplication } from "./types";
import { isSupabaseActive } from "./supabaseService";
import { loadAllDataFromPublicGoogleSheet } from "./googleSheetsService";
import { DoctorBookingTab } from "./components/DoctorBookingTab";
import { DoctorStatusTab } from "./components/DoctorStatusTab";
import { DoctorProfileTab } from "./components/DoctorProfileTab";
import { DoctorFeedbackView } from "./components/DoctorFeedbackView";
import { PediatricCalculator } from "./components/PediatricCalculator";
import { AdminDashTab } from "./components/AdminDashTab";
import { AdminScheduleTab } from "./components/AdminScheduleTab";
import { RecruitmentList } from "./components/RecruitmentList";
import { SheetsSyncManager } from "./components/SheetsSyncManager";
import { SupabaseSyncManager } from "./components/SupabaseSyncManager";
import {
  CalendarDays,
  CheckSquare,
  Bell,
  Star,
  User,
  Lock,
  Activity,
  Users,
  PlusSquare,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  ClipboardList,
  Heart,
  Shield,
  Award,
  Trophy,
  Phone,
  MapPin,
  Clock,
  Plus,
  Filter,
  MessageSquare,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Check,
  X,
  ShieldCheck,
  Mail,
  Briefcase,
  PlusCircle,
  HelpCircle,
  Menu,
  Info,
  Dumbbell,
  Zap,
  BookOpen,
  Search,
  Sparkles,
  Calculator,
  Database,
  RefreshCw,
  Server,
} from "lucide-react";

export default function App() {
  const {
    state,
    loginUser,
    registerUser,
    deleteUser,
    logout,
    changePassword,
    updateProfile,
    bookSlot,
    cancelSlotByDoctor,
    adminApproveSlot,
    adminManageSlot,
    adminCreateBulkSlots,
    publishAnnouncement,
    deleteAnnouncement,
    adminGivePoints,
    completeSlotAndAwardPoints,
    processMonthlyUnstoppable,
    getManualHeartCandidates,
    submitRecruitment,
    logActivity,

    googleUser,
    googleToken,
    connectedSpreadsheetId,
    isAutoSyncEnabled,
    sheetsSyncLoading,
    sheetsSyncError,
    userSpreadsheets,
    authenticateGoogle,
    disconnectGoogle,
    connectSpreadsheet,
    disconnectSpreadsheet,
    pullFromGoogleSheet,
    pushToGoogleSheet,
    createAndConnectNewSpreadsheet,
    toggleAutoSync,

    isSupabaseEnabled,
    setIsSupabaseEnabled,
    pullFromSupabase,
    pushToSupabase,
  } = useAppState();

  // Navigation states
  const [activeTab, setActiveTab] = useState<string>("booking");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cloudSyncTab, setCloudSyncTab] = useState<"sheets" | "supabase">(
    "supabase",
  );

  // Authentication inputs state
  const [phoneInput, setPhoneInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Recruitment modal/form integration
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinPhone, setJoinPhone] = useState("");
  const [joinMmc, setJoinMmc] = useState("");
  const [joinSkills, setJoinSkills] = useState("");
  const [joinApcFile, setJoinApcFile] = useState("");

  // Recruitment applications from Google Sheet
  const [recruitmentApplications, setRecruitmentApplications] = useState<
    NewApplication[]
  >([]);
  const [loadingRecruitment, setLoadingRecruitment] = useState(false);

  // SMTP Diagnostics states
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{
    success: boolean;
    message: string;
    errorDetails?: string;
  } | null>(null);

  useEffect(() => {
    if (activeTab === "admin-tasks") {
      if (isSupabaseEnabled && isSupabaseActive() && state.newApplications && state.newApplications.length > 0) {
        const sorted = [...state.newApplications].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() -
            new Date(a.timestamp).getTime(),
        );
        setRecruitmentApplications(sorted);
        return;
      }
      setLoadingRecruitment(true);
      loadAllDataFromPublicGoogleSheet(
        "1JhLEA8DjNyt0-fIVybtUY5MCuaP2XsN0UftHlYfe6lM",
      )
        .then((data) => {
          if (data) {
            const sorted = [...data.newApplications].sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            );
            setRecruitmentApplications(sorted);
          }
        })
        .catch((err) =>
          console.error("Failed to fetch recruitment applications:", err),
        )
        .finally(() => setLoadingRecruitment(false));
    }
  }, [activeTab, isSupabaseEnabled, state.newApplications]);

  // Admin announcement state
  const [annText, setAnnText] = useState("");

  // Admin roster action modals
  const [resetPassDoc, setResetPassDoc] = useState<{
    phone: string;
    name: string;
  } | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<{
    phone: string;
    name: string;
  } | null>(null);
  const [successToast, setSuccessToast] = useState("");

  // Manual Points Evaluator States
  const [selectedDrPhone, setSelectedDrPhone] = useState("");
  const [pointsAmount, setPointsToAdd] = useState<number>(15);
  const [selectedBadgePreset, setSelectedBadgePreset] =
    useState("Heart Winner");

  // Feedback Inspector database selector tab
  const [activeInspectorFb, setActiveInspectorFb] = useState<
    "patient" | "staff" | "locum"
  >("patient");

  // Direct login credentials shortcuts for demo reviews
  const handleQuickLogin = (phone: string, role: string) => {
    setAuthError("");
    const res = loginUser(phone, undefined, role);
    if (res.success) {
      // Set appropriate landing page
      if (res.user?.role === "Admin") {
        setActiveTab("admin-dash");
      } else if (res.user?.role === "Staff") {
        setActiveTab("admin-cal");
      } else {
        setActiveTab("booking");
      }
    } else {
      setAuthError(res.message);
    }
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!phoneInput) {
      setAuthError("Please input phone number credentials.");
      return;
    }
    if (!passwordInput) {
      setAuthError("Please input password credentials.");
      return;
    }
    const res = loginUser(phoneInput, passwordInput);
    if (res.success) {
      if (res.user?.role === "Admin") {
        setActiveTab("admin-dash");
      } else if (res.user?.role === "Staff") {
        setActiveTab("admin-cal");
      } else {
        setActiveTab("booking");
      }
    } else {
      setAuthError(res.message);
    }
  };

  // Candidate Apply Submissions
  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName || !joinPhone || !joinMmc) {
      alert("⚠️ All asterisk fields must be provided.");
      return;
    }
    const newCand = {
      timestamp: new Date().toLocaleString("en-GB"),
      nama: joinName,
      phone: joinPhone,
      mmc: joinMmc,
      apc: "https://drive.google.com/file/d/cand_apc/view",
      ins: "https://drive.google.com/file/d/cand_ins/view",
      cvUrl: "https://drive.google.com/file/d/cand_cv/view",
      skills: joinSkills || "General clinical duties",
    };
    submitRecruitment(newCand);
    alert(
      `🎉 Application Request Submitted!\n----------------------------------------\nThank you, Dr. ${joinName}. Your parameters have bypassed sheets lag and logged straight into clinical Operations review boards.`,
    );

    // Clear forms
    setShowJoinForm(false);
    setJoinName("");
    setJoinPhone("");
    setJoinMmc("");
    setJoinSkills("");
  };

  const handePublishAnn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annText.trim()) return;
    const response = publishAnnouncement(annText.trim());
    alert(response);
    setAnnText("");
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpTestEmail) return;
    setSmtpTestLoading(true);
    setSmtpTestResult(null);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${origin}/api/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: smtpTestEmail.trim(),
          doctorName: "Diagnostic Test",
          date: new Date().toLocaleDateString("en-GB"),
          time: "09:00 - 17:00",
          branch: "HSO HQ (SMTP TEST)",
        }),
      });

      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : null;

      if (!res.ok) {
        throw new Error(data?.error || `HTTP Error ${res.status}`);
      }

      setSmtpTestResult({
        success: true,
        message: data?.message || "Test email dispatched successfully!",
      });
      logActivity(`SMTP Manual Test succeeded for ${smtpTestEmail}`);
    } catch (err: any) {
      console.error("Test SMTP failed:", err);
      setSmtpTestResult({
        success: false,
        message: "Failed to dispatch test email.",
        errorDetails: err.message || String(err),
      });
      logActivity(`SMTP Manual Test failed for ${smtpTestEmail}: ${err.message || err}`);
    } finally {
      setSmtpTestLoading(false);
    }
  };

  const handleManualPointsAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrPhone) {
      alert("⚠️ Selection profile is empty.");
      return;
    }
    const res = adminGivePoints(
      selectedDrPhone,
      pointsAmount,
      selectedBadgePreset,
    );
    alert(res);
    setSelectedDrPhone("");
  };

  const handleMonthlyUnstoppableScan = () => {
    const m = window.prompt(
      "Unstoppable evaluates:\nEnter Month code (01-12):",
      "06",
    );
    if (!m) return;
    const y = window.prompt("Enter Year code (e.g. 2026):", "2026");
    if (!y) return;

    if (
      window.confirm(
        `Initiate evaluation check for ${m}/${y}?\n\nQualifying standard: minimum 2 approved clinic hours shifts and exactly 0 logged cancellations.`,
      )
    ) {
      const resp = processMonthlyUnstoppable(m, y);
      alert(resp);
    }
  };

  const handleGoogleReviewScannerAward = (
    name: string,
    badgeId: string,
    phone: string,
  ) => {
    if (!phone) {
      alert("❌ Selection error. Target is unmapped.");
      return;
    }
    const res = adminGivePoints(phone, 15, badgeId);
    alert(res);
  };

  // Restrict navigation arrays depending on logged roles
  const activeRole = state.currentUser?.role;

  const DOCTOR_TABS = [
    {
      id: "booking",
      label: "Book Hour slots",
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      id: "status",
      label: "My Status timeline",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      id: "announcements",
      label: "Noticeboard",
      icon: <Bell className="w-4 h-4 text-sky-400" />,
    },
    {
      id: "feedback",
      label: "Patient reviews",
      icon: <MessageSquare className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: "profile",
      label: "My Profile & Medals",
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
    },
    {
      id: "google-sheets",
      label: "Cloud Sync Hub",
      icon: <Database className="w-4 h-4 text-emerald-500" />,
    },
    {
      id: "peds-calc",
      label: "Dosage calculator",
      icon: <Calculator className="w-4 h-4" />,
    },
  ];

  const ADMIN_TABS = [
    {
      id: "admin-dash",
      label: "Analytics dashboard",
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: "admin-cal",
      label: "Clinical Schedules",
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      id: "admin-tasks",
      label: "Booking approvals",
      icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
    },
    {
      id: "admin-ann",
      label: "Manage newsboards",
      icon: <Bell className="w-4 h-4" />,
    },
    {
      id: "admin-award",
      label: "Loyalty awards",
      icon: <Award className="w-4 h-4 text-amber-500" />,
    },
    {
      id: "admin-fb",
      label: "Feedback management",
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      id: "admin-dir",
      label: "Locum directory",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "google-sheets",
      label: "Cloud Sync Hub",
      icon: <Database className="w-4 h-4 text-emerald-500" />,
    },
    {
      id: "peds-calc",
      label: "Dosage calculator",
      icon: <Calculator className="w-4 h-4" />,
    },
  ];

  const STAFF_TABS = [
    {
      id: "admin-cal",
      label: "Clinical Schedules",
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      id: "peds-calc",
      label: "Dosage calculator",
      icon: <Calculator className="w-4 h-4" />,
    },
  ];

  const activeTabsList =
    activeRole === "Admin"
      ? ADMIN_TABS
      : activeRole === "Staff"
        ? STAFF_TABS
        : DOCTOR_TABS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col">
      <AnimatePresence mode="wait">
        {!state.currentUser ? (
          /* Authentication Screen with one-click quick logins */
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8"
          >
            <div className="w-full max-w-sm sm:max-w-md overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 text-center">
              {/* Clinic Logo */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-150">
                <Heart className="w-7 h-7 text-indigo-600 fill-current" />
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                  ARA CLINIC LOCUM
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  24 Hour Clinic Medical Roster & Operations Hub
                </p>
              </div>

              <form
                onSubmit={handleManualLogin}
                className="space-y-4 text-left"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block">
                    Phone validation
                  </label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. 0123456789"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block">
                    Password
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••"
                  />
                </div>

                {authError && (
                  <p className="text-xs text-rose-500 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition outline-none cursor-pointer text-xs tracking-wider uppercase"
                >
                  Sign In Securely
                </button>
              </form>

              {/* One-Click Quick Logins */}
              <div className="border-t border-slate-100/80 pt-4 text-left space-y-3">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">
                  Quick evaluation accounts
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleQuickLogin("0123456789", "Doctor")}
                    className="p-2.5 rounded-xl border border-sky-100 bg-sky-50/50 hover:bg-sky-50 text-left transition select-none flex flex-col"
                  >
                    <span className="text-[9px] font-bold text-sky-800 uppercase leading-none">
                      Doctor Portal
                    </span>
                    <span className="text-[11px] font-bold font-display text-sky-950 mt-1">
                      Dr Atikah
                    </span>
                  </button>

                  <button
                    onClick={() => handleQuickLogin("0198765432", "Admin")}
                    className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 text-left transition select-none flex flex-col"
                  >
                    <span className="text-[9px] font-bold text-amber-800 uppercase leading-none">
                      Admin Portal
                    </span>
                    <span className="text-[11px] font-bold font-display text-amber-950 mt-1">
                      Operations
                    </span>
                  </button>

                  <button
                    onClick={() => handleQuickLogin("0112233445", "Staff")}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition select-none flex flex-col"
                  >
                    <span className="text-[9px] font-bold text-slate-600 uppercase leading-none">
                      Staff Portal
                    </span>
                    <span className="text-[11px] font-bold font-display text-slate-900 mt-1">
                      Kajang Clinic
                    </span>
                  </button>
                </div>
              </div>

              {/* Recruiter join pipeline onboarding */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                  Interested in joining our medical team at Klinik ARA 24 Jam?
                </p>
                <button
                  onClick={() => setShowJoinForm(true)}
                  className="mt-2 text-xs font-bold text-sky-600 hover:text-sky-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Begin Application Request
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Main Dashboard Interface Shell */
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col md:flex-row relative"
          >
            {/* Desktop Left Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-white text-slate-700 border-r border-slate-200 shrink-0 p-5 space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold font-display shadow-sm shadow-indigo-100">
                  <Heart className="w-4 h-4 text-white fill-current" />
                </div>
                <span className="font-display font-bold text-slate-900 tracking-tight text-sm">
                  ARA LOCUM HUB
                </span>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {activeTabsList.map((tab) => {
                  const isCur = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center justify-between text-xs font-semibold py-2.5 px-4 rounded-xl transition ${
                        isCur
                          ? "bg-indigo-50 text-indigo-700 shadow-sm"
                          : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3 font-sans">
                        <span
                          className={`${isCur ? "text-indigo-600" : "text-slate-400"}`}
                        >
                          {tab.icon}
                        </span>
                        <span>{tab.label}</span>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${isCur ? "translate-x-0.5 text-indigo-500" : "text-slate-300"}`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* User profile brief card */}
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700 font-display shrink-0">
                  {state.currentUser.role === "Admin" ? "HQ" : "DR"}
                </div>
                <div className="truncate flex-1">
                  <p className="text-[11px] font-bold text-slate-800 truncate">
                    {state.currentUser.role === "Admin"
                      ? "Operations Admin"
                      : `Dr. ${state.currentUser.name}`}
                  </p>
                  <p className="text-[9px] text-[#4f46e5]/80 font-semibold tracking-wider uppercase">
                    {state.currentUser.role}
                  </p>
                </div>
              </div>

              {/* Desktop signout */}
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2.5 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 py-2.5 px-2 rounded-xl transition border border-rose-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out Account</span>
              </button>
            </aside>

            {/* Mobile Actions Topbar Header */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-10 sticky top-0 backdrop-blur-md bg-white/95">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-indigo-600 fill-current" />
                <span className="font-display font-semibold text-slate-800 text-[13px] tracking-widest">
                  ARA LOCUM HUB
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-slate-100 p-1.5 rounded-lg border text-slate-600 uppercase leading-none">
                  {state.currentUser.role}
                </span>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg hover:bg-slate-50 text-rose-650"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              </div>
            </header>

            {/* Content main stage container */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6 overflow-y-auto pb-24 md:pb-8">
              {/* User Dynamic Greeting Banner */}
              <div className="flex justify-between items-center bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex-col xs:flex-row gap-3">
                <div className="space-y-0.5 text-center xs:text-left">
                  <span className="text-[10px] font-black text-indigo-600 block tracking-widest uppercase">
                    Klinik ARA 24 Jam
                  </span>
                  <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">
                    Welcome,{" "}
                    {state.currentUser.role === "Admin"
                      ? "HQ Operations Office"
                      : `Dr. ${state.currentUser.name}`}
                  </h3>
                  <p className="text-xs text-slate-500 font-sans">
                    Roster database and clinical slots synchronized safely.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[10px] text-slate-500 font-bold font-mono uppercase">
                    {new Date().toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>

              {/* RENDER CURRENT VIEW */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* --- DOCTOR PORTALS --- */}
                  {activeTab === "booking" && (
                    <DoctorBookingTab
                      slots={state.slots}
                      currentUser={state.currentUser}
                      onBookSlot={bookSlot}
                      onRefresh={() => {}}
                    />
                  )}

                  {activeTab === "status" && (
                    <DoctorStatusTab
                      slots={state.slots}
                      currentUser={state.currentUser}
                      onCancelSlot={cancelSlotByDoctor}
                    />
                  )}

                  {activeTab === "announcements" && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-slate-100 bg-[#001F3F] p-4 text-white space-y-1">
                        <span className="text-[9px] font-bold tracking-widest text-[#007AFF] uppercase block">
                          Operations desk
                        </span>
                        <h4 className="font-display font-medium text-sm sm:text-base">
                          Malaysian Medical Toolkits
                        </h4>
                      </div>

                      {/* Scientific tools links grid matching specs strictly */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <a
                          href="https://sites.google.com/moh.gov.my/nag/contents/section-c-clinical-pathways-in-primary-care?authuser=0"
                          target="_blank"
                          rel="noopener"
                          className="bg-white rounded-2xl border border-slate-100 p-4 font-semibold text-slate-700 hover:text-[#001F3F] text-xs transition flex items-center justify-between"
                        >
                          <span>
                            📁 National Antibiotic Guidelines (NAG) 2024
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                        </a>
                        <a
                          href="https://www.acadmed.org.my/index.cfm?&menuid=67"
                          target="_blank"
                          rel="noopener"
                          className="bg-white rounded-2xl border border-slate-100 p-4 font-semibold text-slate-700 hover:text-[#001F3F] text-xs transition flex items-center justify-between"
                        >
                          <span>
                            📁 Malaysia Clinical Practice Guidelines (CPG)
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                        </a>
                        <a
                          href="https://www.mdcalc.com/"
                          target="_blank"
                          rel="noopener"
                          className="bg-white rounded-2xl border border-slate-100 p-4 font-semibold text-slate-700 hover:text-[#001F3F] text-xs transition flex items-center justify-between"
                        >
                          <span>📁 MDCalc Medical calculators</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                        </a>
                      </div>

                      <div className="rounded-3xl bg-white border border-slate-150 p-6 space-y-4">
                        <h5 className="font-display font-bold text-slate-800 tracking-tight flex items-center gap-1.5 text-sm uppercase">
                          <Bell className="w-4 h-4 text-sky-600" />
                          Pinboard Announcements
                        </h5>

                        {state.announcements.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No news published at this moment.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {state.announcements.map((ann) => (
                              <div
                                key={ann.id}
                                className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 relative pl-6"
                              >
                                <div className="absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-[#001F3F]" />
                                <span className="text-[10px] text-slate-400 font-bold block">
                                  {ann.date}
                                </span>
                                <p className="text-xs sm:text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line">
                                  {ann.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "feedback" && (
                    <DoctorFeedbackView
                      feedbacks={state.feedbacksPatient.filter(
                        (f) => f.target === state.currentUser?.name,
                      )}
                    />
                  )}

                  {activeTab === "profile" && (
                    <DoctorProfileTab
                      currentUser={state.currentUser}
                      onChangePassword={changePassword}
                      onUpdateProfile={updateProfile}
                    />
                  )}

                  {activeTab === "peds-calc" && <PediatricCalculator />}

                  {activeTab === "google-sheets" && (
                    <div className="space-y-6">
                      {/* Sub tab selectors */}
                      <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-md">
                        <button
                          onClick={() => setCloudSyncTab("sheets")}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg cursor-pointer transition ${cloudSyncTab === "sheets" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          <Database className="w-4 h-4" />
                          Google Sheets Sync
                        </button>
                        <button
                          onClick={() => setCloudSyncTab("supabase")}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg cursor-pointer transition ${cloudSyncTab === "supabase" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          <Server className="w-4 h-4" />
                          Supabase Postgres DB
                        </button>
                      </div>

                      {cloudSyncTab === "sheets" ? (
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-150 shadow-sm">
                          <SheetsSyncManager
                            googleUser={googleUser}
                            connectedSpreadsheetId={connectedSpreadsheetId}
                            isAutoSyncEnabled={isAutoSyncEnabled}
                            sheetsSyncLoading={sheetsSyncLoading}
                            sheetsSyncError={sheetsSyncError}
                            userSpreadsheets={userSpreadsheets}
                            authenticateGoogle={authenticateGoogle}
                            disconnectGoogle={disconnectGoogle}
                            connectSpreadsheet={connectSpreadsheet}
                            disconnectSpreadsheet={disconnectSpreadsheet}
                            pullFromGoogleSheet={pullFromGoogleSheet}
                            pushToGoogleSheet={pushToGoogleSheet}
                            createAndConnectNewSpreadsheet={
                              createAndConnectNewSpreadsheet
                            }
                            toggleAutoSync={toggleAutoSync}
                            onLogActivity={logActivity}
                          />
                        </div>
                      ) : (
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-150 shadow-sm">
                          <SupabaseSyncManager
                            onLogActivity={logActivity}
                            onPullFromSupabase={pullFromSupabase}
                            onPushToSupabase={pushToSupabase}
                            isSupabaseEnabled={isSupabaseEnabled}
                            setIsSupabaseEnabled={setIsSupabaseEnabled}
                            localState={state}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- ADMIN PORTALS --- */}
                  {activeTab === "admin-dash" && activeRole === "Admin" && (
                    <AdminDashTab
                      slots={state.slots}
                      users={state.users}
                      onCompleteSlot={completeSlotAndAwardPoints}
                    />
                  )}

                  {activeTab === "admin-cal" &&
                    (activeRole === "Admin" || activeRole === "Staff") && (
                      <AdminScheduleTab
                        slots={state.slots}
                        users={state.users}
                        currentUserRole={activeRole || "Admin"}
                        onManageSlot={adminManageSlot}
                        onBulkCreateSlots={adminCreateBulkSlots}
                      />
                    )}

                  {activeTab === "admin-tasks" && activeRole === "Admin" && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h5 className="font-display font-bold text-slate-900 tracking-tight text-sm uppercase">
                          Pending Slots Registrations
                        </h5>

                        {state.slots.filter((s) => s.status === "Pending")
                          .length === 0 ? (
                          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-150 shadow-sm">
                            No shift approvals pending at this time.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {state.slots
                              .filter((s) => s.status === "Pending")
                              .map((slot) => {
                                return (
                                  <div
                                    key={slot.id}
                                    className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4"
                                  >
                                    <div className="space-y-1">
                                      <h6 className="font-display font-medium text-xs text-sky-800 block uppercase">
                                        Shift Booking Request
                                      </h6>
                                      <div className="font-bold text-slate-800 font-sans text-sm">
                                        Dr. {slot.dr}
                                      </div>
                                      <span className="text-[10px] text-slate-400 block font-mono">
                                        Clinic: ARA {slot.cawangan} |{" "}
                                        {slot.tarikh} ({slot.masa})
                                      </span>
                                      {slot.bookedAt && (
                                        <div className="text-[10px] text-rose-500 font-mono font-bold">
                                          Received: {slot.bookedAt}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex gap-2 text-xs">
                                      <button
                                        onClick={async () => {
                                          const res = await adminApproveSlot(
                                            slot.id,
                                          );
                                          alert(res);
                                        }}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl cursor-pointer"
                                      >
                                        ✓ Approve Booking
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (
                                            window.confirm(
                                              "Purge application request? Available status parameters will restore.",
                                            )
                                          ) {
                                            const res = await adminManageSlot(
                                              "CANCEL",
                                              slot.id,
                                            );
                                            alert(res);
                                          }
                                        }}
                                        className="bg-slate-50 border border-slate-200 text-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-100"
                                      >
                                        Decline
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Newly onboarded CVs recruitment checklist pipeline */}
                      <div className="space-y-3">
                        <h5 className="font-display font-bold text-slate-900 tracking-tight text-sm uppercase">
                          Recruitment Candidates pipeline
                        </h5>
                        {loadingRecruitment ? (
                          <p className="text-sm text-slate-500 italic">
                            Loading candidates from Google Sheet...
                          </p>
                        ) : (
                          <RecruitmentList
                            applications={recruitmentApplications}
                          />
                        )}
                      </div>

                      {/* Email Dispatch Logs & SMTP Diagnostics */}
                      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
                        <div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-500" />
                            <h5 className="font-display font-bold text-slate-800 tracking-tight text-sm uppercase">
                              Email Notifications & SMTP Diagnostics
                            </h5>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Verify SMTP mailer functionality on the live web (Vercel) and review transaction logs.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* SMTP Testing Tool */}
                          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
                            <h6 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                              <Server className="w-3.5 h-3.5 text-slate-500" />
                              SMTP Mailer Tester
                            </h6>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Send a manual diagnostic message to verify Vercel environment variables configuration (<code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>).
                            </p>

                            <form onSubmit={handleTestSmtp} className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Test Recipient Email</label>
                                <input
                                  type="email"
                                  required
                                  placeholder="dr.name@example.com"
                                  value={smtpTestEmail}
                                  onChange={(e) => setSmtpTestEmail(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                />
                              </div>

                              <button
                                type="submit"
                                disabled={smtpTestLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer uppercase tracking-wider"
                              >
                                {smtpTestLoading ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    Dispatching Test...
                                  </>
                                ) : (
                                  <>
                                    <Mail className="w-3.5 h-3.5" />
                                    Send Test Email
                                  </>
                                )}
                              </button>
                            </form>

                            {smtpTestResult && (
                              <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 rounded-xl border text-xs leading-relaxed space-y-1 ${
                                  smtpTestResult.success
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                    : "bg-rose-50 border-rose-200 text-rose-800"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 font-bold">
                                  {smtpTestResult.success ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                                  )}
                                  {smtpTestResult.success ? "Mailer Succeeded!" : "Mailer Failed!"}
                                </div>
                                <p className="text-[11px]">{smtpTestResult.message}</p>
                                {smtpTestResult.errorDetails && (
                                  <div className="mt-2 bg-rose-100/50 p-2.5 rounded-lg border border-rose-200 font-mono text-[10px] break-all max-h-32 overflow-y-auto">
                                    <strong>Error Details:</strong> {smtpTestResult.errorDetails}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>

                          {/* Email-related dispatch logs */}
                          <div className="space-y-3">
                            <h6 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                              <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                              Recent Mail Dispatch Logs
                            </h6>
                            
                            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 max-h-64 overflow-y-auto space-y-2">
                              {state.activityLogs.filter(
                                (log) =>
                                  log.action.toLowerCase().includes("email") ||
                                  log.action.toLowerCase().includes("smtp") ||
                                  log.action.toLowerCase().includes("mailer")
                              ).length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-6">
                                  No email transaction logs recorded in this session.
                                </p>
                              ) : (
                                state.activityLogs
                                  .filter(
                                    (log) =>
                                      log.action.toLowerCase().includes("email") ||
                                      log.action.toLowerCase().includes("smtp") ||
                                      log.action.toLowerCase().includes("mailer")
                                  )
                                  .slice(0, 10)
                                  .map((log, idx) => {
                                    const isError = log.action.toLowerCase().includes("failed");
                                    const isSimulation = log.action.toLowerCase().includes("simulated");
                                    return (
                                      <div
                                        key={idx}
                                        className={`p-3 rounded-xl border text-[11px] leading-normal flex gap-2.5 items-start ${
                                          isError
                                            ? "bg-rose-50/40 border-rose-100 text-rose-800"
                                            : isSimulation
                                            ? "bg-amber-50/30 border-amber-100 text-amber-800"
                                            : "bg-emerald-50/30 border-emerald-100 text-emerald-800"
                                        }`}
                                      >
                                        <div className="mt-0.5">
                                          {isError ? (
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                          ) : isSimulation ? (
                                            <Info className="w-3.5 h-3.5 text-amber-500" />
                                          ) : (
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                          )}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <p className="font-medium text-slate-700">{log.action}</p>
                                          <p className="text-[9px] text-slate-400 font-mono">{log.timestamp}</p>
                                        </div>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "admin-ann" && activeRole === "Admin" && (
                    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
                      <div>
                        <h5 className="font-display font-bold text-slate-800 tracking-tight text-sm uppercase">
                          Noticeboard Editor
                        </h5>
                        <p className="text-xs text-slate-500">
                          Announce roster shifts adjustments or critical alerts
                          instantly on Doctor Noticeboards
                        </p>
                      </div>

                      <form onSubmit={handePublishAnn} className="space-y-4">
                        <textarea
                          rows={4}
                          required
                          value={annText}
                          onChange={(e) => setAnnText(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 font-semibold p-4 rounded-2xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#001F3F] text-slate-800"
                          placeholder="Type announcements instructions..."
                        />
                        <button
                          type="submit"
                          className="bg-[#001F3F] font-bold hover:bg-[#001226] text-white py-3 px-6 rounded-xl text-xs shadow-md shadow-[#001F3F]/10 transition cursor-pointer"
                        >
                          ✓ Publish Announcements
                        </button>
                      </form>

                      {/* Deletable News List */}
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <span className="text-[10px] tracking-wider text-slate-400 font-bold block uppercase">
                          Active Pins
                        </span>
                        {state.announcements.map((ann) => (
                          <div
                            key={ann.id}
                            className="p-3 bg-slate-50 border border-slate-1.50 rounded-2xl flex justify-between gap-3 items-start"
                          >
                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 font-bold font-mono">
                                {ann.date}
                              </span>
                              <p className="text-xs font-sans text-slate-700 whitespace-pre-line">
                                {ann.text}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteAnnouncement(ann.id)}
                              className="text-rose-500 hover:text-rose-700 font-bold rounded-lg p-1.5 hover:bg-rose-50 hover:underline text-xs"
                            >
                              Purge
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "admin-award" && activeRole === "Admin" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Points Assigner */}
                        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
                          <h5 className="font-display font-semibold text-slate-800 text-sm tracking-tight uppercase flex items-center gap-1.5">
                            <Trophy className="w-4 h-4 text-amber-500 fill-current" />
                            Loyalty points manually awards
                          </h5>
                          <p className="text-xs text-slate-500">
                            Inject booster points and badges on matching doctor
                            checklists
                          </p>

                          <form
                            onSubmit={handleManualPointsAward}
                            className="space-y-3 font-sans"
                          >
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">
                                Select Target Doctor
                              </label>
                              <select
                                required
                                value={selectedDrPhone}
                                onChange={(e) =>
                                  setSelectedDrPhone(e.target.value)
                                }
                                className="w-full bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-[#001F3F] cursor-pointer"
                              >
                                <option value="">-- Choose Candidate --</option>
                                {state.users
                                  .filter((u) => u.role === "Doctor")
                                  .map((u) => (
                                    <option key={u.phone} value={u.phone}>
                                      {u.name.toUpperCase()} ({u.phone})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">
                                  Award presets
                                </label>
                                <select
                                  value={selectedBadgePreset}
                                  onChange={(e) => {
                                    setSelectedBadgePreset(e.target.value);
                                    // Assign default scoring
                                    const matchingPoints =
                                      e.target.value === "Team Favorite"
                                        ? 20
                                        : e.target.value === "Iron Doctor" ||
                                            e.target.value ===
                                              "The Unstoppable" ||
                                            e.target.value ===
                                              "The Diligent Doc"
                                          ? 10
                                          : 15;
                                    setPointsToAdd(matchingPoints);
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 focus:ring-2 focus:ring-[#001F3F] cursor-pointer"
                                >
                                  <option value="Team Favorite">
                                    Team Favorite
                                  </option>
                                  <option value="Heart Winner">
                                    Heart Winner
                                  </option>
                                  <option value="Last Minute Savior">
                                    Last Minute Savior
                                  </option>
                                  <option value="Iron Doctor">
                                    Iron Doctor
                                  </option>
                                  <option value="The Unstoppable">
                                    The Unstoppable
                                  </option>
                                  <option value="The Diligent Doc">
                                    The Diligent Doc
                                  </option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">
                                  Points Digit
                                </label>
                                <input
                                  type="number"
                                  required
                                  value={pointsAmount || ""}
                                  onChange={(e) =>
                                    setPointsToAdd(
                                      Math.max(
                                        1,
                                        parseInt(e.target.value) || 0,
                                      ),
                                    )
                                  }
                                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 outline-none font-mono"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="w-full bg-[#001F3F] text-white hover:bg-[#001226] font-bold py-3 px-4 rounded-xl text-xs mt-4 transition shadow-sm"
                            >
                              ✓ Submit Point injection
                            </button>
                          </form>
                        </div>

                        {/* Scanner modules bento */}
                        <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
                          <h5 className="font-display font-semibold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                            Automated evaluation scanners
                          </h5>
                          <p className="text-xs text-slate-500 font-sans leading-relaxed">
                            Bypass slow manual sheets auditing. Command scanning
                            tasks below directly inside local memory states.
                          </p>

                          <div className="space-y-3 pt-2">
                            {/* Unstoppable monthly eval trigger */}
                            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <h6 className="text-xs font-bold text-emerald-950 font-display">
                                  Unstoppable Monthly evaluation
                                </h6>
                                <p className="text-[11px] text-slate-500 font-sans leading-relaxed max-w-xs">
                                  Auto-reward locum doctors with{" "}
                                  <strong>
                                    &gt;= 2 approved Shifts and exactly 0
                                    Cancellations
                                  </strong>{" "}
                                  for any month of audit.
                                </p>
                              </div>
                              <button
                                onClick={handleMonthlyUnstoppableScan}
                                className="bg-[#001F3F] text-white hover:bg-[#001226] text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1 tracking-wider outline-none cursor-pointer"
                              >
                                Run Check
                              </button>
                            </div>

                            {/* Google Reviews "Heart Winner Check scanner" */}
                            <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100/50 space-y-3">
                              <h6 className="text-xs font-bold text-rose-950 font-display">
                                Reviews Scanner ("Heart Winner" finder)
                              </h6>
                              <p className="text-[11px] text-slate-500 leading-normal">
                                Automated reviews parser matching 5-star ratings
                                where no score awards locker exists.
                              </p>

                              <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                                {getManualHeartCandidates().map((review, i) => {
                                  // Locate doctor's profile to retrieve phone mapping
                                  const matchesDoc = state.users.find((u) =>
                                    u.name
                                      .toUpperCase()
                                      .includes(review.name.toUpperCase()),
                                  );
                                  return (
                                    <div
                                      key={i}
                                      className="bg-white border select-none border-slate-100 rounded-xl p-3 flex justify-between items-center text-xs"
                                    >
                                      <div>
                                        <span className="font-bold block text-slate-700">
                                          Dr. {review.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          Date: {review.date}
                                        </span>
                                        <p className="text-[10px] italic text-slate-500 mt-1 line-clamp-1">
                                          "{review.comment}"
                                        </p>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleGoogleReviewScannerAward(
                                            review.name,
                                            review.badgeId,
                                            matchesDoc?.phone || "",
                                          )
                                        }
                                        className="bg-rose-600 font-bold hover:bg-rose-700 text-white text-[10px] py-1.5 px-3.5 rounded-lg shrink-0"
                                      >
                                        Gift 15
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "admin-fb" && activeRole === "Admin" && (
                    <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <h5 className="font-display font-medium text-slate-900 tracking-tight text-sm uppercase flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-emerald-500" />
                            Roster reviews & reviews database
                          </h5>
                          <p className="text-xs text-slate-500">
                            Inspect clinic evaluations compiled across sectors
                          </p>
                        </div>

                        {/* Dropdown database index selector */}
                        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl self-end">
                          {(["patient", "staff", "locum"] as const).map(
                            (fType) => (
                              <button
                                key={fType}
                                onClick={() => setActiveInspectorFb(fType)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                                  activeInspectorFb === fType
                                    ? "bg-[#001F3F] text-white shadow-sm"
                                    : "text-slate-600 hover:text-slate-800"
                                }`}
                              >
                                {fType === "patient"
                                  ? "Patient reviews"
                                  : fType === "staff"
                                    ? "Staff logs"
                                    : "Locum reviews"}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      {/* Display table list of feedback inspectors */}
                      <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full text-xs text-left text-slate-500 leading-normal">
                          <thead className="text-[10px] uppercase bg-slate-50 text-slate-400 font-black tracking-wider border-b border-slate-150">
                            <tr>
                              <th className="p-3">Ref timestamp</th>
                              <th className="p-3">Author sender</th>
                              <th className="p-3">Review subject</th>
                              <th className="p-3 text-center">
                                Stars classification
                              </th>
                              <th className="p-3">Notes & opinions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeInspectorFb === "patient" &&
                              state.feedbacksPatient.map((f, i) => (
                                <tr
                                  key={i}
                                  className="hover:bg-slate-50/50 border-b border-slate-100"
                                >
                                  <td className="p-3 font-mono text-[10px]">
                                    {f.tarikh}
                                  </td>
                                  <td className="p-3 font-bold text-slate-900">
                                    {f.reviewer}
                                  </td>
                                  <td className="p-3 text-sky-800 font-semibold">
                                    {f.target}
                                  </td>
                                  <td className="p-3 font-bold font-mono text-center text-amber-500">
                                    ⭐ {f.rating.toFixed(1)}
                                  </td>
                                  <td className="p-3 italic text-slate-650 max-w-xs truncate">
                                    "{f.komen}"
                                  </td>
                                </tr>
                              ))}
                            {activeInspectorFb === "staff" &&
                              state.feedbacksStaff.map((f, i) => (
                                <tr
                                  key={i}
                                  className="hover:bg-slate-50/50 border-b border-slate-100"
                                >
                                  <td className="p-3 font-mono text-[10px]">
                                    {f.tarikh}
                                  </td>
                                  <td className="p-3 font-bold text-slate-900">
                                    {f.reviewer}
                                  </td>
                                  <td className="p-3 text-[#001f3f] font-semibold">
                                    {f.target}
                                  </td>
                                  <td className="p-3 font-bold font-mono text-center text-amber-500">
                                    ⭐ {f.rating}
                                  </td>
                                  <td className="p-3 italic text-slate-650 max-w-xs truncate">
                                    "{f.komen}"
                                  </td>
                                </tr>
                              ))}
                            {activeInspectorFb === "locum" &&
                              state.feedbacksLocum.map((f, i) => (
                                <tr
                                  key={i}
                                  className="hover:bg-slate-50/50 border-b border-slate-100"
                                >
                                  <td className="p-3 font-mono text-[10px]">
                                    {f.tarikh}
                                  </td>
                                  <td className="p-3 font-bold text-slate-900">
                                    {f.reviewer}
                                  </td>
                                  <td className="p-3 text-emerald-800 font-semibold">
                                    {f.target}
                                  </td>
                                  <td className="p-3 font-bold font-mono text-center text-amber-500">
                                    ⭐ {f.rating}
                                  </td>
                                  <td className="p-3 italic text-slate-650 max-w-xs truncate">
                                    "{f.komen}"
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === "admin-dir" && activeRole === "Admin" && (
                    <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm space-y-4">
                      <div>
                        <h5 className="font-display font-medium text-slate-900 tracking-tight text-sm uppercase">
                          {" "}
                          Roster Directory
                        </h5>
                        <p className="text-xs text-slate-500">
                          Roster of registered doctors, credential verification
                          checklists, and coins tally
                        </p>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full text-xs text-left leading-normal text-slate-500">
                          <thead className="bg-slate-50 border-b border-slate-150 uppercase text-[10px] text-slate-400 font-black tracking-widest text-left">
                            <tr>
                              <th className="p-3">Doctor profile</th>
                              <th className="p-3">Affiliation Workplace</th>
                              <th className="p-3">Verification Checklist</th>
                              <th className="p-3 font-mono text-right">
                                Points balance
                              </th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.users
                              .filter((u) => u.role === "Doctor")
                              .map((doc) => {
                                // Verify APC and Email status fields
                                const hasEmail = doc.email?.includes("@");
                                const hasMmc =
                                  doc.mmc &&
                                  doc.mmc.split("|")[0].trim().length > 2;
                                const hasApc = doc.apc?.length > 2;
                                const complete = hasApc;

                                return (
                                  <tr
                                    key={doc.phone}
                                    className="hover:bg-slate-50/50 border-b border-slate-100 font-sans"
                                  >
                                    <td className="p-3">
                                      <div className="font-bold text-slate-800 font-display">
                                        Dr. {doc.name}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {doc.phone} | {doc.email || "No email"}
                                      </div>
                                    </td>
                                    <td className="p-3 font-medium text-slate-600">
                                      {doc.workplace ||
                                        "Government clinical facility"}
                                    </td>
                                    <td className="p-3">
                                      <div className="flex gap-2">
                                        <span
                                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${hasMmc ? "bg-sky-50 text-sky-700 border-sky-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}
                                        >
                                          MMC {hasMmc ? "✓" : "✖"}
                                        </span>
                                        <span
                                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${hasApc ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}
                                        >
                                          APC {hasApc ? "✓" : "✖"}
                                        </span>
                                        <span
                                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${complete ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"}`}
                                        >
                                          {complete
                                            ? "Complete ✓"
                                            : "Incomplete ⌛"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-right font-black font-mono text-amber-600 select-all">
                                      🪙 {doc.points}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setResetPassDoc({
                                            phone: doc.phone,
                                            name: doc.name,
                                          });
                                          setNewPasswordValue("");
                                        }}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-2 rounded transition"
                                      >
                                        Reset Pass
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteUserConfirm({
                                            phone: doc.phone,
                                            name: doc.name,
                                          });
                                        }}
                                        className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-1 px-2 rounded border border-rose-100 transition"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* iOS Floating Glassmorphic Bottom Navigation Rail for Touch Device previews */}
            <nav className="md:hidden fixed bottom-4 left-4 right-4 z-40 rounded-2xl shadow-lg border border-slate-100 bg-white/95 backdrop-blur-md flex justify-around py-2.5 px-2 select-none">
              {activeTabsList.slice(0, 5).map((tab) => {
                const isCur = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition outline-none ${
                      isCur
                        ? "text-[#007AFF] font-bold scale-105"
                        : "text-slate-400 hover:text-slate-650"
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center mb-0.5">
                      {tab.icon}
                    </div>
                    <span className="text-[9px] truncate max-w-[56px] leading-tight select-none">
                      {tab.id
                        .replace("admin-", "")
                        .replace("booking", "Book")
                        .replace("status", "Status")
                        .replace("peds-calc", "Calc")
                        .replace("announcements", "Notice")
                        .replace("fb", "Review")}
                    </span>
                  </button>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RECRUITMENT APPLICATION JOIN PORTAL MODAL DIALOG POPUP */}
      <AnimatePresence>
        {showJoinForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowJoinForm(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.form
              initial={{ scale: 0.9, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 15, opacity: 0 }}
              onSubmit={handleJoinSubmit}
              className="relative w-full max-w-sm sm:max-w-md overflow-hidden rounded-3xl bg-white border border-slate-150 p-6 shadow-2xl space-y-4"
            >
              <div>
                <h5 className="font-display font-bold text-[#001F3F] text-base uppercase">
                  {" "}
                  Roster onboarding request
                </h5>
                <p className="text-xs text-slate-500 font-sans leading-relaxed">
                  Join Ara Locum Roster. Verified candidates are invited for a
                  physical interview and registration.
                </p>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none duration-150 focus:ring-2 focus:ring-[#001F3F] text-slate-800 font-bold"
                    placeholder="e.g. Dr. Ramesh Fernandez"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase">
                    WhatsApp Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinPhone}
                    onChange={(e) => setJoinPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none duration-150 focus:ring-2 focus:ring-[#001F3F] text-slate-800 font-mono font-semibold"
                    placeholder="e.g. 0165551212"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase">
                    MMC Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinMmc}
                    onChange={(e) => setJoinMmc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none duration-150 focus:ring-2 focus:ring-[#001F3F] text-slate-800 font-mono font-bold"
                    placeholder="e.g. 93821"
                  />
                </div>

                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <label className="font-semibold block text-slate-600 mb-1">
                    Verify APC, cv & insurance file status
                  </label>
                  <input
                    type="file"
                    id="join-apc"
                    onChange={(e) =>
                      setJoinApcFile(e.target.files?.[0]?.name || "")
                    }
                    className="hidden"
                  />
                  <div className="flex gap-2 items-center">
                    <label
                      htmlFor="join-apc"
                      className="cursor-pointer bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-slate-650 hover:bg-slate-50 text-[10px] font-bold"
                    >
                      Attach PDFs
                    </label>
                    <span className="text-[10px] font-medium text-slate-500 truncate">
                      {joinApcFile ||
                        "Attach credentials files to expedite close-outs"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase">
                    Roster traits & skillsets
                  </label>
                  <input
                    type="text"
                    value={joinSkills}
                    onChange={(e) => setJoinSkills(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#001F3F] text-slate-800"
                    placeholder="e.g. Peads suturing, chest pain decongestion"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowJoinForm(false)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-650 py-3 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#001F3F] text-white hover:bg-[#001226] rounded-xl py-3 shadow-md outline-none cursor-pointer"
                >
                  Publish Application
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetPassDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="font-display font-medium text-lg text-slate-900 mb-2">
                Reset Password
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Enter new password for Dr. {resetPassDoc.name} (
                {resetPassDoc.phone}):
              </p>
              <input
                type="text"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#001F3F] text-slate-800 mb-4"
                placeholder="New Password"
              />
              <div className="flex gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setResetPassDoc(null);
                    setNewPasswordValue("");
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-650 py-2.5 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (newPasswordValue.trim() !== "") {
                      const msg = changePassword(
                        resetPassDoc.phone,
                        newPasswordValue,
                      );
                      setSuccessToast(msg);
                      setTimeout(() => setSuccessToast(""), 3000);
                      setResetPassDoc(null);
                      setNewPasswordValue("");
                    }
                  }}
                  className="flex-1 bg-[#001F3F] text-white hover:bg-[#001226] rounded-xl py-2.5 shadow-md"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Confirm Modal */}
      <AnimatePresence>
        {deleteUserConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border-2 border-rose-100"
            >
              <h3 className="font-display font-bold text-lg text-rose-600 mb-2">
                Confirm Deletion
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Are you sure you want to permanently delete Dr.{" "}
                <strong className="text-slate-900">
                  {deleteUserConfirm.name}
                </strong>{" "}
                (Phone: {deleteUserConfirm.phone})?
                <br />
                <br />
                This action cannot be undone.
              </p>
              <div className="flex gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDeleteUserConfirm(null)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-650 py-2.5 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteUser(deleteUserConfirm.phone);
                    setSuccessToast(
                      `Dr. ${deleteUserConfirm.name} has been permanently deleted.`,
                    );
                    setTimeout(() => setSuccessToast(""), 3000);
                    setDeleteUserConfirm(null);
                  }}
                  className="flex-1 bg-rose-600 text-white hover:bg-rose-700 rounded-xl py-2.5 shadow-md"
                >
                  Permanently Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm flex items-center gap-2 max-w-sm w-max"
          >
            <span>✅</span>
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
