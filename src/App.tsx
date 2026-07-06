import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppState } from "./useAppState";
import { NewApplication, LocumSurveyEntry, StaffFeedbackEntry, FeedbackRecord } from "./types";
import { isSupabaseActive } from "./supabaseService";
import {
  loadAllDataFromPublicGoogleSheet,
  fetchLocumSurveyResponses,
  fetchStaffFeedbackResponses,
  fetchPatientFeedbackFromSheets,
} from "./googleSheetsService";
import { DoctorBookingTab } from "./components/DoctorBookingTab";
import { DoctorStatusTab } from "./components/DoctorStatusTab";
import { DoctorProfileTab } from "./components/DoctorProfileTab";
import { DoctorFeedbackView } from "./components/DoctorFeedbackView";
import { DoctorNotificationsTab } from "./components/DoctorNotificationsTab";
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
  Loader2,
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

// Doctor names show up inconsistently across sources ("Dr Pravinaa", "DR PRAVINAA",
// "Pravinaa", trailing/leading whitespace, etc). Normalize + flexible substring match
// so filters and per-doctor views work regardless of "Dr" prefix or casing.
function normalizeDoctorName(s: string): string {
  return s.toLowerCase().replace(/^dr\.?\s+/i, "").trim();
}

function doctorNamesMatch(a: string, b: string): boolean {
  const na = normalizeDoctorName(a);
  const nb = normalizeDoctorName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Word-boundary matching only — plain .includes() would wrongly match
  // e.g. "ain" against "wan zainol" since those letters appear consecutively
  // inside "zainol", even though it's a completely different name/word.
  const wordsA = na.split(/\s+/).filter(Boolean);
  const wordsB = nb.split(/\s+/).filter(Boolean);
  const [shortWords, longWords] =
    wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  return shortWords.every((w) => longWords.includes(w));
}

export default function App() {
  const {
    state,
    loginUser,
    registerUser,
    deleteUser,
    logout,
    changePassword,
    updateProfile,
    uploadCredentialFile,
    adminCreateUser,
    bookSlot,
    cancelSlotByDoctor,
    adminApproveSlot,
    adminManageSlot,
    adminCreateBulkSlots,
    adminLogCMEAttendance,
    publishAnnouncement,
    deleteAnnouncement,
    adminGivePoints,
    completeSlotAndAwardPoints,
    recalculateBadges,
    processMonthlyUnstoppable,
    processIronDoctorScan,
    migrateHistoricalBadgesToSupabase,
    reconcilePointsFromBadgeAwards,
    getManualHeartCandidates,
    refreshHeartWinnerAwardedIds,
    giftHeartWinnerReview,
    submitRecruitment,
    logActivity,
    markNotificationsAsRead,
    deleteNotification,
    dismissAdminAlert,

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
  const [staffKeywordInput, setStaffKeywordInput] = useState("");
  const [staffAuthError, setStaffAuthError] = useState("");

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

  // On page load/refresh, currentUser is restored from localStorage but
  // activeTab is not — it resets to its default ("booking"). Without this,
  // a restored Admin/Staff session would land on a blank content area (since
  // those tabs are role-gated) instead of their actual landing page.
  useEffect(() => {
    if (state.currentUser) {
      if (state.currentUser.role === "Admin") {
        setActiveTab("admin-cal");
      } else if (state.currentUser.role === "Staff") {
        setActiveTab("admin-cal");
      } else {
        setActiveTab("booking");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "admin-tasks") {
      // The recruitment pipeline is sourced directly from the "NEW LOCUM" Google Form
      // responses sheet — not from Supabase — so it always reflects real submissions.
      setLoadingRecruitment(true);
      loadAllDataFromPublicGoogleSheet(
        "1JhLEA8DjNyt0-fIVybtUY5MCuaP2XsN0UftHlYfe6lM",
      )
        .then((data) => {
          if (data) {
            // Later rows in the sheet = newer submissions, so just reverse
            // row order to put the latest on top (parsing the timestamp
            // string with new Date() was unreliable and scrambled the order).
            const latestFirst = [...data.newApplications].reverse();
            setRecruitmentApplications(latestFirst);
          }
        })
        .catch((err) =>
          console.error("Failed to fetch recruitment applications:", err),
        )
        .finally(() => setLoadingRecruitment(false));
    }
  }, [activeTab]);

  // Feedback data — sourced directly from the 3 Google Forms/Sheets, not Supabase
  const [patientFeedbackEntries, setPatientFeedbackEntries] = useState<
    FeedbackRecord[]
  >([]);
  const [staffFeedbackEntries, setStaffFeedbackEntries] = useState<
    StaffFeedbackEntry[]
  >([]);
  const [locumSurveyEntries, setLocumSurveyEntries] = useState<
    LocumSurveyEntry[]
  >([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Log CME/Briefing Attendance (multi-doctor) form state
  const [cmeSelectedPhones, setCmeSelectedPhones] = useState<string[]>([]);
  const [cmeDate, setCmeDate] = useState("");
  const [cmeTime, setCmeTime] = useState("2pm-4pm");
  const [cmeType, setCmeType] = useState<"CME" | "Briefing">("CME");

  useEffect(() => {
    if (activeTab === "admin-fb" || activeTab === "feedback") {
      setLoadingFeedback(true);
      Promise.all([
        fetchPatientFeedbackFromSheets(),
        fetchStaffFeedbackResponses(),
        fetchLocumSurveyResponses(),
      ])
        .then(([patients, staff, locum]) => {
          setPatientFeedbackEntries(patients);
          setStaffFeedbackEntries(staff);
          setLocumSurveyEntries(locum);
        })
        .catch((err) => console.error("Failed to fetch feedback data:", err))
        .finally(() => setLoadingFeedback(false));
    }
  }, [activeTab]);

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
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"Doctor" | "Admin" | "Staff">("Doctor");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [createUserError, setCreateUserError] = useState("");

  // Manual Points Evaluator States
  const [selectedDrPhone, setSelectedDrPhone] = useState("");
  const [pointsAmount, setPointsToAdd] = useState<number>(15);
  const [selectedBadgePreset, setSelectedBadgePreset] =
    useState("Heart Winner");
  const [selectedAwardMonth, setSelectedAwardMonth] = useState(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  });

  // Feedback Inspector database selector tab
  const [activeInspectorFb, setActiveInspectorFb] = useState<
    "patient" | "staff" | "locum"
  >("patient");
  const [expandedFbRow, setExpandedFbRow] = useState<string | null>(null);
  const [feedbackDoctorFilter, setFeedbackDoctorFilter] = useState<string>("All");


  const handleStaffKeywordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffAuthError("");
    const keyword = staffKeywordInput.trim();
    if (!keyword) {
      setStaffAuthError("Please enter your access keyword.");
      return;
    }
    // A staff "keyword" is really just that staff account's password — this
    // lets admin issue staff members a simple keyword (via Create User) instead
    // of a phone number + password pair for this restricted, view-only role.
    let encodedKeyword = "";
    try {
      encodedKeyword = btoa(keyword);
    } catch (err) {}
    const staffUser = state.users.find(
      (u) => u.role === "Staff" && u.password === encodedKeyword,
    );
    if (!staffUser) {
      setStaffAuthError("Invalid access keyword.");
      return;
    }
    const res = loginUser(staffUser.phone, keyword, "Staff");
    if (res.success) {
      setActiveTab("admin-cal");
      setStaffKeywordInput("");
    } else {
      setStaffAuthError(res.message);
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
        setActiveTab("admin-cal");
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
      selectedAwardMonth,
    );
    alert(res);
    setSelectedDrPhone("");
  };

  const handleMonthlyUnstoppableScan = async () => {
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
      const resp = await processMonthlyUnstoppable(m, y);
      alert(resp);
    }
  };

  const handleIronDoctorScan = async () => {
    if (
      window.confirm(
        "Scan all completed shifts for Iron Doctor eligibility (12+ hour shifts that have already ended)?",
      )
    ) {
      const resp = await processIronDoctorScan();
      alert(resp);
    }
  };

  const [isMigratingBadges, setIsMigratingBadges] = useState(false);
  const handleMigrateBadges = async () => {
    if (
      !window.confirm(
        "Copy every doctor's existing badge history into the new badge_awards table? Safe to run more than once."
      )
    )
      return;
    setIsMigratingBadges(true);
    const resp = await migrateHistoricalBadgesToSupabase();
    setIsMigratingBadges(false);
    alert(resp);
  };

  const [isReconcilingPoints, setIsReconcilingPoints] = useState(false);
  const handleReconcilePoints = async () => {
    if (
      !window.confirm(
        "Rebuild every doctor's badges & points to match what's currently in badge_awards? This OVERWRITES their current badges/points with the badge_awards totals — use this after a reset/cleanup to bring the two back in sync."
      )
    )
      return;
    setIsReconcilingPoints(true);
    const resp = await reconcilePointsFromBadgeAwards();
    setIsReconcilingPoints(false);
    alert(resp);
  };

  const handleGoogleReviewScannerAward = async (
    name: string,
    badgeId: string,
    phone: string,
  ) => {
    if (!phone) {
      alert("❌ Selection error. Target is unmapped.");
      return;
    }
    const res = await giftHeartWinnerReview(phone, badgeId);
    alert(res);
  };

  // Restrict navigation arrays depending on logged roles
  const activeRole = state.currentUser?.role;

  const unreadNotificationsCount = state.currentUser && state.currentUser.role === "Doctor"
    ? (state.notifications || []).filter(
        (n) => n.phone?.trim() === state.currentUser?.phone?.trim() && !n.isRead
      ).length
    : 0;

  const pendingApprovalCount = state.currentUser && state.currentUser.role === "Admin"
    ? (state.slots || []).filter((s) => s.status === "Pending").length
    : 0;

  const DOCTOR_TABS = [
    {
      id: "booking",
      label: "Book Slot",
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      id: "status",
      label: "MyStatus",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Mail className="w-4 h-4 text-rose-500" />,
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
  ];

  const activeTabsList =
    activeRole === "Admin"
      ? ADMIN_TABS
      : activeRole === "Staff"
        ? STAFF_TABS
        : DOCTOR_TABS;

  // Unique doctor names for the admin feedback filter dropdown — dedupe names that
  // only differ by "Dr" prefix/casing (e.g. "Dr Pravinaa" and "PRAVINAA" collapse to one).
  // Only this specific admin account can perform actions (Add User, Reset
  // Password, Delete) in Locum Directory — other admins can view everything
  // on the sidebar, but Locum Directory management is restricted.
  // Matched by phone (reliable) with email as a secondary check, since email
  // casing/whitespace can vary.
  const isSuperAdmin =
    state.currentUser?.phone === "0182194256" ||
    (state.currentUser?.email || "").trim().toLowerCase() === "operation@hsohealthcare.com";

  const feedbackDoctorOptions = (() => {
    const raw = [
      ...patientFeedbackEntries.map((f) => f.target),
      ...staffFeedbackEntries.map((f) => f.doctorName),
    ].filter((n) => n && n.trim());
    const seen: { normalized: string; display: string }[] = [];
    raw.forEach((name) => {
      const norm = normalizeDoctorName(name);
      if (!norm) return;
      if (!seen.some((s) => doctorNamesMatch(s.display, name))) {
        seen.push({ normalized: norm, display: name.trim() });
      }
    });
    return seen.sort((a, b) => a.display.localeCompare(b.display));
  })();

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
              <div className="mx-auto flex h-14 w-14 items-center justify-center">
                <img src="/logo.png" alt="Klinik ARA 24 Jam" className="w-14 h-14 object-contain" />
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
                <p className="text-[11px] text-slate-400 text-center font-sans">
                  Forgot your password? Please contact your clinic admin to have it reset.
                </p>
              </form>

              {/* Staff quick access — keyword only, view-only Clinical Schedule access */}
              <div className="border-t border-slate-100/80 pt-4 text-left space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">
                  Staff quick access
                </span>
                <form onSubmit={handleStaffKeywordLogin} className="flex gap-2">
                  <input
                    type="password"
                    value={staffKeywordInput}
                    onChange={(e) => setStaffKeywordInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Enter access keyword"
                  />
                  <button
                    type="submit"
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 rounded-xl text-xs transition cursor-pointer shrink-0"
                  >
                    Enter
                  </button>
                </form>
                {staffAuthError && (
                  <p className="text-xs text-rose-500 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {staffAuthError}
                  </p>
                )}
              </div>

              {/* Recruiter join pipeline onboarding */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                  Interested in joining our medical team at Klinik ARA 24 Jam?
                </p>
                <a
                  href="https://forms.gle/RKDNR6Q7b28gQ5v3A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs font-bold text-sky-600 hover:text-sky-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Begin Application Request
                </a>
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
                <img src="/logo.png" alt="Klinik ARA 24 Jam" className="w-8 h-8 object-contain" />
                <span className="font-display font-bold text-slate-900 tracking-tight text-sm">
                  ARA LOCUM HUB
                </span>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {activeTabsList.map((tab) => {
                  const isCur = activeTab === tab.id;
                  const isNotificationTab = tab.id === "notifications";
                  const isPendingTasksTab = tab.id === "admin-tasks";
                  const badgeCount = isNotificationTab
                    ? unreadNotificationsCount
                    : isPendingTasksTab
                      ? pendingApprovalCount
                      : 0;
                  const showRedBadge = badgeCount > 0;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center justify-between text-xs font-semibold py-2.5 px-4 rounded-xl transition ${
                        isCur
                          ? showRedBadge
                            ? "bg-rose-50 text-rose-700 shadow-sm border border-rose-100"
                            : "bg-indigo-50 text-indigo-700 shadow-sm"
                          : showRedBadge
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 hover:text-rose-700 border border-rose-200/50"
                            : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3 font-sans">
                        <span
                          className={`${
                            isCur
                              ? showRedBadge
                                ? "text-rose-600"
                                : "text-indigo-600"
                              : showRedBadge
                                ? "text-rose-500"
                                : "text-slate-400"
                          }`}
                        >
                          {tab.icon}
                        </span>
                        <span className={showRedBadge ? "text-rose-600 font-bold animate-pulse flex items-center gap-1.5" : ""}>
                          {tab.label}
                          {showRedBadge && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold inline-flex items-center justify-center leading-none">
                              {badgeCount > 99 ? "99+" : badgeCount}
                            </span>
                          )}
                        </span>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isCur
                            ? showRedBadge
                              ? "translate-x-0.5 text-rose-500"
                              : "translate-x-0.5 text-indigo-500"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* User profile brief card */}
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700 font-display shrink-0">
                  {state.currentUser.role === "Admin" ? "HQ" : state.currentUser.role === "Staff" ? "CA" : "DR"}
                </div>
                <div className="truncate flex-1">
                  <p className="text-[11px] font-bold text-slate-800 truncate">
                    {state.currentUser.role === "Admin"
                      ? "Operations Admin"
                      : state.currentUser.role === "Staff"
                        ? "CA ARA"
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
                <img src="/logo.png" alt="Klinik ARA 24 Jam" className="w-6 h-6 object-contain" />
                <span className="font-display font-semibold text-slate-800 text-[13px] tracking-widest">
                  ARA LOCUM HUB
                </span>
              </div>

              <div className="flex items-center gap-2">
                {state.currentUser.role === "Doctor" ? (
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`text-[10px] font-bold p-1.5 rounded-lg border uppercase leading-none transition ${
                      activeTab === "profile"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Profile
                  </button>
                ) : (
                  <span className="text-[10px] font-bold bg-slate-100 p-1.5 rounded-lg border text-slate-600 uppercase leading-none">
                    {state.currentUser.role}
                  </span>
                )}
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
                      : state.currentUser.role === "Staff"
                        ? "CA ARA"
                        : `Dr. ${state.currentUser.name}`}
                  </h3>
                  <p className="text-xs text-slate-500 font-sans">
                    {state.currentUser.role === "Admin"
                      ? "Roster database and clinical slots synchronized safely."
                      : "Thank you for being part of Klinik ARA 24 Jam."}
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
                  {activeTab === "booking" && activeRole === "Doctor" && (
                    <DoctorBookingTab
                      slots={state.slots}
                      currentUser={state.currentUser}
                      onBookSlot={bookSlot}
                      onRefresh={() => {}}
                    />
                  )}

                  {activeTab === "status" && activeRole === "Doctor" && (
                    <DoctorStatusTab
                      slots={state.slots}
                      currentUser={state.currentUser}
                      onCancelSlot={cancelSlotByDoctor}
                    />
                  )}

                  {activeTab === "notifications" && activeRole === "Doctor" && state.currentUser && (
                    <DoctorNotificationsTab
                      notifications={state.notifications}
                      currentUser={state.currentUser}
                      onDeleteNotification={deleteNotification}
                      onMarkRead={markNotificationsAsRead}
                    />
                  )}

                  {activeTab === "announcements" && activeRole === "Doctor" && (
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
                        <button
                          type="button"
                          onClick={() => setActiveTab("peds-calc")}
                          className="bg-white rounded-2xl border border-slate-100 p-4 font-semibold text-slate-700 hover:text-[#001F3F] text-xs transition flex items-center justify-between cursor-pointer"
                        >
                          <span>🧮 Paeds Calculator</span>
                          <Calculator className="w-3.5 h-3.5 text-slate-300" />
                        </button>
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

                  {activeTab === "feedback" && activeRole === "Doctor" && (
                    <DoctorFeedbackView
                      feedbacks={patientFeedbackEntries.filter((f) => {
                        if (!f.target || !f.target.trim()) return false; // no doctor recorded — admin-only
                        return doctorNamesMatch(f.target, state.currentUser?.name || "");
                      })}
                    />
                  )}

                  {activeTab === "profile" && activeRole === "Doctor" && (
                    <DoctorProfileTab
                      currentUser={state.currentUser}
                      onChangePassword={changePassword}
                      onUpdateProfile={updateProfile}
                      onUploadFile={uploadCredentialFile}
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
                      onRecalculateBadges={(month, year) =>
                        recalculateBadges(month, year, patientFeedbackEntries)
                      }
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
                        adminAlerts={state.adminAlerts}
                        onDismissAlert={dismissAdminAlert}
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
                                  .filter(
                                    (u) =>
                                      u.role === "Doctor" &&
                                      !/^(unknown|n\/a|test)$/i.test(
                                        u.name.trim(),
                                      ),
                                  )
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
                                  <option value="Last Minute Saviour">
                                    Last Minute Saviour
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

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">
                                Award Month
                              </label>
                              <input
                                type="month"
                                required
                                value={selectedAwardMonth.split("/").reverse().join("-")}
                                onChange={(e) => {
                                  const [y, m] = e.target.value.split("-");
                                  if (y && m) setSelectedAwardMonth(`${m}/${y}`);
                                }}
                                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 outline-none font-mono cursor-pointer"
                              />
                              <p className="text-[9px] text-slate-400">
                                Which month this award counts towards for
                                monthly dashboard breakdowns.
                              </p>
                            </div>

                            <button
                              type="submit"
                              className="w-full bg-[#001F3F] text-white hover:bg-[#001226] font-bold py-3 px-4 rounded-xl text-xs mt-4 transition shadow-sm"
                            >
                              ✓ Submit Point injection
                            </button>
                          </form>
                        </div>

                        {/* Log CME/Briefing Attendance — multi-doctor at once.
                            Works around the "one slot = one doctor" limit by
                            creating one Approved slot per selected doctor for
                            the same session; The Diligent Doc detection
                            (badgeEngine.ts) already picks these up as-is. */}
                        <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
                          <h5 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
                            📋 Log CME/Briefing Attendance
                          </h5>
                          <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                            Select every doctor who attended one session —
                            creates one Approved record per doctor so all of
                            them qualify for The Diligent Doc once you run
                            "Recalculate Badges" for this month.
                          </p>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">
                                Session Type
                              </label>
                              <select
                                value={cmeType}
                                onChange={(e) =>
                                  setCmeType(e.target.value as "CME" | "Briefing")
                                }
                                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 cursor-pointer"
                              >
                                <option value="CME">CME</option>
                                <option value="Briefing">Briefing</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">
                                Date
                              </label>
                              <input
                                type="date"
                                value={cmeDate}
                                onChange={(e) => setCmeDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">
                              Time
                            </label>
                            <input
                              type="text"
                              value={cmeTime}
                              onChange={(e) => setCmeTime(e.target.value)}
                              placeholder="e.g. 2pm-4pm"
                              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">
                              Attendees ({cmeSelectedPhones.length} selected)
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                              {state.users
                                .filter(
                                  (u) =>
                                    u.role === "Doctor" &&
                                    !/^(unknown|n\/a|test)$/i.test(
                                      u.name.trim(),
                                    ),
                                )
                                .map((u) => (
                                  <label
                                    key={u.phone}
                                    className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={cmeSelectedPhones.includes(u.phone)}
                                      onChange={(e) => {
                                        setCmeSelectedPhones((prev) =>
                                          e.target.checked
                                            ? [...prev, u.phone]
                                            : prev.filter((p) => p !== u.phone),
                                        );
                                      }}
                                    />
                                    <span>Dr. {u.name}</span>
                                  </label>
                                ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!cmeDate) {
                                alert("❌ Pick a date first.");
                                return;
                              }
                              const res = adminLogCMEAttendance(
                                cmeSelectedPhones,
                                cmeDate,
                                cmeTime,
                                cmeType,
                              );
                              alert(res);
                              setCmeSelectedPhones([]);
                            }}
                            className="w-full bg-[#001F3F] text-white hover:bg-[#001226] font-bold py-3 px-4 rounded-xl text-xs transition shadow-sm"
                          >
                            ✓ Log Attendance for {cmeSelectedPhones.length} Doctor(s)
                          </button>
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
                            {/* Rebuild users.badges/points from badge_awards. This is the
                                ONLY scanner kept here — "Migrate to badge_awards" (wrote the
                                opposite direction, from the old badges string into
                                badge_awards, which could re-introduce stale/corrupted data)
                                and the two "Run Check" buttons (Iron Doctor auto-scan /
                                Unstoppable Monthly evaluation) were removed: both called
                                separate, older functions (processIronDoctorScan /
                                processMonthlyUnstoppable) that duplicated what
                                "Recalculate Badges" on the Analytics Dashboard already does
                                correctly, using cruder detection logic and without the
                                idempotent-points fix — running them corrupted badge_awards.
                                Use "Recalculate Badges" (Analytics Dashboard) for all
                                automatic badge detection now; use this button afterward to
                                sync points/badges. */}
                            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <h6 className="text-xs font-bold text-amber-950 font-display">
                                  Reconcile points from badge_awards
                                </h6>
                                <p className="text-[11px] text-slate-500 font-sans leading-relaxed max-w-xs">
                                  Rebuilds each doctor's badges &amp; points to
                                  match badge_awards exactly — run this after
                                  using "Recalculate Badges" on the Analytics
                                  Dashboard, or after any reset/cleanup, to
                                  bring the two tables back in sync. This
                                  OVERWRITES current badges/points.
                                </p>
                              </div>
                              <button
                                onClick={handleReconcilePoints}
                                disabled={isReconcilingPoints}
                                className="bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1 tracking-wider outline-none cursor-pointer shrink-0 disabled:opacity-60"
                              >
                                {isReconcilingPoints ? "Reconciling..." : "Reconcile Now"}
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
                                {getManualHeartCandidates(patientFeedbackEntries).map((review, i) => {
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
                                        <span className="text-[9px] text-slate-300 font-mono block">
                                          Row: {review.row}
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
                                            review.phone,
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
                            {loadingFeedback
                              ? "Loading feedback from Google Sheets..."
                              : "Inspect clinic evaluations compiled across sectors"}
                          </p>
                        </div>

                        {/* Dropdown database index selector */}
                        <div className="flex flex-wrap gap-2 self-end items-center">
                          {activeInspectorFb !== "locum" && feedbackDoctorOptions.length > 0 && (
                            <select
                              value={feedbackDoctorFilter}
                              onChange={(e) => setFeedbackDoctorFilter(e.target.value)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 outline-none cursor-pointer"
                            >
                              <option value="All">All Doctors</option>
                              {feedbackDoctorOptions.map((opt) => (
                                <option key={opt.normalized} value={opt.normalized}>
                                  {opt.display}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
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
                                    ? "Patients → Doctor"
                                    : fType === "staff"
                                      ? "Staff → Doctor"
                                      : "Doctor → Clinic"}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Patients -> Doctor: star-rated table */}
                      {activeInspectorFb === "patient" && (
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-xs text-left text-slate-500 leading-normal">
                            <thead className="text-[10px] uppercase bg-slate-50 text-slate-400 font-black tracking-wider border-b border-slate-150">
                              <tr>
                                <th className="p-3">Ref timestamp</th>
                                <th className="p-3">Patient</th>
                                <th className="p-3">Branch</th>
                                <th className="p-3">Doctor</th>
                                <th className="p-3 text-center">Rating /5</th>
                                <th className="p-3">Notes & opinions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {patientFeedbackEntries
                                .filter(
                                  (f) =>
                                    feedbackDoctorFilter === "All" ||
                                    doctorNamesMatch(f.target, feedbackDoctorFilter),
                                )
                                .map((f, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 border-b border-slate-100">
                                  <td className="p-3 font-mono text-[10px]">{f.tarikh}</td>
                                  <td className="p-3 font-bold text-slate-900">{f.reviewer}</td>
                                  <td className="p-3 text-slate-600">{f.cawangan || "—"}</td>
                                  <td className="p-3 text-sky-800 font-semibold">
                                    {f.target || <span className="text-slate-300 italic">Not specified</span>}
                                  </td>
                                  <td className="p-3 font-bold font-mono text-center text-amber-500">
                                    ⭐ {f.rating.toFixed(1)}
                                  </td>
                                  <td
                                    onClick={() => setExpandedFbRow(expandedFbRow === `p-${i}` ? null : `p-${i}`)}
                                    title="Click to expand"
                                    className={`p-3 italic text-slate-650 cursor-pointer hover:bg-slate-100/70 transition ${
                                      expandedFbRow === `p-${i}` ? "" : "max-w-xs truncate"
                                    }`}
                                  >
                                    "{f.komen}"
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Staff -> Doctor: categorical, no star rating */}
                      {activeInspectorFb === "staff" && (
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-xs text-left text-slate-500 leading-normal">
                            <thead className="text-[10px] uppercase bg-slate-50 text-slate-400 font-black tracking-wider border-b border-slate-150">
                              <tr>
                                <th className="p-3">Ref timestamp</th>
                                <th className="p-3">Staff</th>
                                <th className="p-3">Doctor</th>
                                <th className="p-3">Branch</th>
                                <th className="p-3">Category</th>
                                <th className="p-3">Details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {staffFeedbackEntries
                                .filter(
                                  (f) =>
                                    feedbackDoctorFilter === "All" ||
                                    doctorNamesMatch(f.doctorName, feedbackDoctorFilter),
                                )
                                .map((f, i) => {
                                const catLower = f.category.toLowerCase();
                                const catStyle = catLower.includes("aduan serius")
                                  ? "bg-rose-50 text-rose-700 border-rose-100"
                                  : catLower.includes("isu kecil")
                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                    : catLower.includes("positif")
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                      : "bg-slate-50 text-slate-600 border-slate-150";
                                return (
                                  <tr key={i} className="hover:bg-slate-50/50 border-b border-slate-100">
                                    <td className="p-3 font-mono text-[10px]">{f.timestamp}</td>
                                    <td className="p-3 font-bold text-slate-900">{f.staffName}</td>
                                    <td className="p-3 text-[#001f3f] font-semibold">{f.doctorName}</td>
                                    <td className="p-3">{f.cawangan}</td>
                                    <td className="p-3">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${catStyle}`}>
                                        {f.category}
                                      </span>
                                    </td>
                                    <td
                                      onClick={() => setExpandedFbRow(expandedFbRow === `s-${i}` ? null : `s-${i}`)}
                                      title="Click to expand"
                                      className={`p-3 italic text-slate-650 cursor-pointer hover:bg-slate-100/70 transition ${
                                        expandedFbRow === `s-${i}` ? "" : "max-w-xs truncate"
                                      }`}
                                    >
                                      "{f.details}"
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Doctor -> Clinic: open-ended operational survey, card layout */}
                      {activeInspectorFb === "locum" && (
                        <div className="space-y-3">
                          {locumSurveyEntries.length === 0 ? (
                            <p className="text-xs text-slate-400 italic p-4">No survey responses yet.</p>
                          ) : (
                            locumSurveyEntries.map((s, i) => (
                              <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] font-mono text-slate-400">{s.timestamp}</span>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {s.clinics || "Clinic not specified"} &middot; {s.duration || "?"}
                                  </span>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                                  {s.workflowSmooth && <p><strong>Workflow smooth?</strong> {s.workflowSmooth}</p>}
                                  {s.feltSupported && <p><strong>Felt supported?</strong> {s.feltSupported}</p>}
                                  {s.safetyConcerns && <p><strong>Safety concerns?</strong> {s.safetyConcerns}</p>}
                                  {s.medsSufficient && <p><strong>Stock sufficient?</strong> {s.medsSufficient}</p>}
                                </div>
                                {s.workflowElaborate && <p className="text-xs text-slate-600"><strong>Elaboration:</strong> {s.workflowElaborate}</p>}
                                {s.staffFeedback && <p className="text-xs text-slate-600"><strong>Staff attitude:</strong> {s.staffFeedback}</p>}
                                {s.medsFeedback && <p className="text-xs text-slate-600"><strong>Medication feedback:</strong> {s.medsFeedback}</p>}
                                {s.appreciate && <p className="text-xs text-emerald-700"><strong>Appreciates:</strong> {s.appreciate}</p>}
                                {s.improve && <p className="text-xs text-rose-700"><strong>Suggested improvement:</strong> {s.improve}</p>}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "admin-dir" && activeRole === "Admin" && (
                    <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
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
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setCreateUserError("");
                              setNewUserName("");
                              setNewUserPhone("");
                              setNewUserPassword("");
                              setNewUserRole("Doctor");
                              setNewUserEmail("");
                              setShowCreateUserModal(true);
                            }}
                            className="bg-[#001F3F] hover:bg-[#001226] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Add User
                          </button>
                        )}
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
                                      {isSuperAdmin ? (
                                        <>
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
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-300 italic">View only</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>

                      {/* Staff Accounts — their password IS the "keyword" used on the login screen's Staff quick access */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                          <div>
                            <h5 className="font-display font-medium text-slate-900 tracking-tight text-sm uppercase">
                              Staff Accounts
                            </h5>
                            <p className="text-xs text-slate-500">
                              Each staff member's password is their login keyword — reset here anytime.
                            </p>
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-xs text-left leading-normal text-slate-500">
                            <thead className="bg-slate-50 border-b border-slate-150 uppercase text-[10px] text-slate-400 font-black tracking-widest text-left">
                              <tr>
                                <th className="p-3">Name</th>
                                <th className="p-3">Phone</th>
                                <th className="p-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {state.users
                                .filter((u) => u.role === "Staff")
                                .map((staff) => (
                                  <tr
                                    key={staff.phone}
                                    className="hover:bg-slate-50/50 border-b border-slate-100 font-sans"
                                  >
                                    <td className="p-3 font-bold text-slate-800 font-display">
                                      {staff.name}
                                    </td>
                                    <td className="p-3 font-mono text-[10px] text-slate-400">
                                      {staff.phone}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                      {isSuperAdmin ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setResetPassDoc({
                                                phone: staff.phone,
                                                name: staff.name,
                                              });
                                              setNewPasswordValue("");
                                            }}
                                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-2 rounded transition"
                                          >
                                            Set Keyword
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteUserConfirm({
                                                phone: staff.phone,
                                                name: staff.name,
                                              });
                                            }}
                                            className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-1 px-2 rounded border border-rose-100 transition"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-300 italic">View only</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              {state.users.filter((u) => u.role === "Staff").length === 0 && (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center text-slate-400 italic">
                                    No staff accounts yet — use "Add User" above to create one.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Admin Accounts — reset password here too, no need to touch Supabase directly */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                          <div>
                            <h5 className="font-display font-medium text-slate-900 tracking-tight text-sm uppercase">
                              Admin Accounts
                            </h5>
                            <p className="text-xs text-slate-500">
                              Reset another admin's password here anytime.
                            </p>
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-xs text-left leading-normal text-slate-500">
                            <thead className="bg-slate-50 border-b border-slate-150 uppercase text-[10px] text-slate-400 font-black tracking-widest text-left">
                              <tr>
                                <th className="p-3">Name</th>
                                <th className="p-3">Phone</th>
                                <th className="p-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {state.users
                                .filter((u) => u.role === "Admin")
                                .map((admin) => (
                                  <tr
                                    key={admin.phone}
                                    className="hover:bg-slate-50/50 border-b border-slate-100 font-sans"
                                  >
                                    <td className="p-3 font-bold text-slate-800 font-display">
                                      {admin.name}
                                      {admin.phone === state.currentUser?.phone && (
                                        <span className="ml-1.5 text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                          You
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 font-mono text-[10px] text-slate-400">
                                      {admin.phone}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                      {isSuperAdmin ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setResetPassDoc({
                                                phone: admin.phone,
                                                name: admin.name,
                                              });
                                              setNewPasswordValue("");
                                            }}
                                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-2 rounded transition"
                                          >
                                            Reset Password
                                          </button>
                                          {admin.phone !== state.currentUser?.phone && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteUserConfirm({
                                                  phone: admin.phone,
                                                  name: admin.name,
                                                });
                                              }}
                                              className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-1 px-2 rounded border border-rose-100 transition"
                                            >
                                              Delete
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-300 italic">View only</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              {state.users.filter((u) => u.role === "Admin").length === 0 && (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center text-slate-400 italic">
                                    No admin accounts found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
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
                const isNotificationTab = tab.id === "notifications";
                const isPendingTasksTab = tab.id === "admin-tasks";
                const badgeCount = isNotificationTab
                  ? unreadNotificationsCount
                  : isPendingTasksTab
                    ? pendingApprovalCount
                    : 0;
                const showRedBadge = badgeCount > 0;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition outline-none relative ${
                      isCur
                        ? showRedBadge
                          ? "text-rose-600 font-bold scale-105"
                          : "text-[#007AFF] font-bold scale-105"
                        : showRedBadge
                          ? "text-rose-500 font-medium animate-pulse"
                          : "text-slate-400 hover:text-slate-650"
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center mb-0.5 relative">
                      {tab.icon}
                      {showRedBadge && (
                        <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-[3px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-white">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] truncate max-w-[56px] leading-tight select-none">
                      {tab.id === "notifications"
                        ? "Inbox"
                        : tab.id
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

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4"
            >
              <div>
                <h3 className="font-display font-medium text-lg text-slate-900">
                  Add New User
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Create an account with an initial password. The user can change it themselves later.
                </p>
              </div>

              <div className="space-y-3 text-left">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#001F3F]"
                    placeholder="e.g. Ahmad Faisal"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#001F3F] font-mono"
                    placeholder="e.g. 0123456789"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-1">
                    Initial Password / Keyword
                  </label>
                  <input
                    type="text"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#001F3F] font-mono"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-1">
                    Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as "Doctor" | "Admin" | "Staff")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#001F3F]"
                  >
                    <option value="Doctor">Doctor</option>
                    <option value="Staff">Staff (view-only Clinical Schedule)</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-1">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#001F3F]"
                    placeholder="optional@example.com"
                  />
                </div>
              </div>

              {createUserError && (
                <p className="text-xs text-rose-500 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {createUserError}
                </p>
              )}

              <div className="flex gap-2 text-xs font-bold pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-650 py-2.5 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreatingUser}
                  onClick={async () => {
                    setIsCreatingUser(true);
                    setCreateUserError("");
                    const result = await adminCreateUser(
                      newUserName,
                      newUserPhone,
                      newUserPassword,
                      newUserRole,
                      newUserEmail,
                    );
                    setIsCreatingUser(false);
                    if (result.success) {
                      setShowCreateUserModal(false);
                      setSuccessToast(result.message);
                      setTimeout(() => setSuccessToast(""), 3000);
                    } else {
                      setCreateUserError(result.message);
                    }
                  }}
                  className="flex-1 bg-[#001F3F] text-white hover:bg-[#001226] rounded-xl py-2.5 shadow-md disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isCreatingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isCreatingUser ? "Creating..." : "Create Account"}
                </button>
              </div>
            </motion.div>
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
                Enter new password/keyword for {resetPassDoc.name} (
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
                  onClick={async () => {
                    if (newPasswordValue.trim() !== "") {
                      const phone = resetPassDoc.phone;
                      const pass = newPasswordValue;
                      setResetPassDoc(null);
                      setNewPasswordValue("");
                      const msg = await changePassword(phone, pass);
                      setSuccessToast(msg);
                      setTimeout(() => setSuccessToast(""), 3000);
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
                  onClick={async () => {
                    const targetName = deleteUserConfirm.name;
                    const targetPhone = deleteUserConfirm.phone;
                    setDeleteUserConfirm(null);
                    const result = await deleteUser(targetPhone);
                    if (result === "success") {
                      setSuccessToast(
                        `Dr. ${targetName} has been permanently deleted.`,
                      );
                      setTimeout(() => setSuccessToast(""), 3000);
                    } else {
                      alert(result);
                    }
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