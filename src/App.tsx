import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppState } from "./useAppState";
import { Announcement, NewApplication, LocumSurveyEntry, StaffFeedbackEntry, FeedbackRecord } from "./types";
import { isSupabaseActive, verifyStaffKey } from "./supabaseService";
import {
  loadAllDataFromPublicGoogleSheet,
  fetchLocumSurveyResponses,
  fetchStaffFeedbackResponses,
  fetchPatientFeedbackFromSheets,
} from "./googleSheetsService";
import { DoctorBookingTab } from "./components/DoctorBookingTab";
import { PreShiftDeclarationForm, DECLARATION_TEXT } from "./components/PreShiftDeclarationForm";
import { DoctorStatusTab } from "./components/DoctorStatusTab";
import { DoctorProfileTab } from "./components/DoctorProfileTab";
import { DoctorFeedbackView } from "./components/DoctorFeedbackView";
import { DoctorNotificationsTab } from "./components/DoctorNotificationsTab";
import { DoctorOverviewTab } from "./components/DoctorOverviewTab";
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

const HADITH_QUOTES = [
  "Behind every diagnosis is a person who wants to be heard.",
  "A good consultation can change more than a prescription.",
  "Making a difference, one patient at a time.",
  "Every patient is an opportunity to make a difference.",
  "Care with purpose. Practice with compassion.",
  "Better care starts with every consultation.",
  "Small moments of care can make a lasting difference.",
  "Every consultation matters. Every patient matters.",
  "Here to care. Here to make a difference.",
  "Another day to make someone feel better.",
];

const DOCTOR_TAB_META: Record<string, { eyebrow: string; title: string; description: string }> = {
  booking: {
    eyebrow: "Clinical scheduling",
    title: "Book a Shift",
    description: "Find and request available locum slots.",
  },
  status: {
    eyebrow: "Your schedule",
    title: "My Shifts",
    description: "Keep track of upcoming, pending and completed shifts.",
  },
  notifications: {
    eyebrow: "Stay up to date",
    title: "Inbox",
    description: "Shift approvals and important updates in one place.",
  },
  announcements: {
    eyebrow: "Clinical reference desk",
    title: "Medical Toolkits",
    description: "Quick access to helpful resources when you need them most.",
  },
  feedback: {
    eyebrow: "Patient experience",
    title: "Patient Reviews",
    description: "See how patients experienced the care you provided.",
  },
  profile: {
    eyebrow: "Your account",
    title: "My Profile & Medals",
    description: "Manage credentials and view your clinical achievements.",
  },
  "peds-calc": {
    eyebrow: "Clinical calculator",
    title: "Dosage Calculator",
    description: "A quick reference tool for paediatric dosing checks.",
  },
};

const DoctorTabHeader: React.FC<{ tab: string }> = ({ tab }) => {
  const meta = DOCTOR_TAB_META[tab];
  if (!meta) return null;
  return (
    <div className="relative mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#082f49] via-[#0a3b5d] to-[#0d5078] px-5 py-5 text-white shadow-[0_12px_30px_rgba(8,47,73,0.14)] sm:px-7 sm:py-6">
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-sky-300/10 blur-3xl" />
      <div className="relative">
        <span className="block text-[10px] font-bold tracking-[0.2em] text-sky-300 uppercase">{meta.eyebrow}</span>
        <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{meta.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">{meta.description}</p>
      </div>
    </div>
  );
};

export default function App() {
  // Public pre-shift declaration form — reached by scanning the static
  // per-branch QR code at the clinic counter. Deliberately checked here,
  // before any of useAppState()'s hooks run, and returns immediately: no
  // login required, no admin/doctor session needed. The URL is expected
  // to look like "?declare=Kajang" (the QR code embeds this link).
  const declareBranchParam = new URLSearchParams(window.location.search).get('declare');
  if (declareBranchParam !== null) {
    return <PreShiftDeclarationForm initialBranch={declareBranchParam} />;
  }

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
    adminEditSlotTiming,
    adminCreateBulkSlots,
    adminLogCMEAttendance,
    publishAnnouncement,
    editAnnouncement,
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
    allBadgeAwards,
    shiftDeclarations,
    refreshShiftDeclarations,
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
    authReady,
    setIsSupabaseEnabled,
    pullFromSupabase,
    pushToSupabase,
  } = useAppState();
  const [dailyQuote] = useState(
    () => HADITH_QUOTES[Math.floor(Math.random() * HADITH_QUOTES.length)],
  );

  // Navigation states
  const [activeTab, setActiveTab] = useState<string>("overview");
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
        setActiveTab("overview");
      }
    }
  }, [state.currentUser?.phone, state.currentUser?.role]);

  useEffect(() => {
    setStickyPendingSlots((prev) => {
      const next = { ...prev };
      state.slots.forEach((s) => {
        if (resolvedSlotIdsRef.current.has(s.id)) return;
        if (s.status === "Pending") {
          next[s.id] = s;
        } else if (next[s.id]) {
          // This exact slot ID was found again, but with a real,
          // definitively different status — genuinely resolved (approved/
          // declined/cancelled elsewhere), not just dropped by a flaky
          // fetch. Safe to remove from the sticky cache.
          delete next[s.id];
        }
      });
      // Anything in the sticky cache whose ID isn't in this fetch AT ALL
      // is left untouched — that's exactly the flaky-fetch case being
      // guarded against, so it stays visible until a fetch either
      // confirms it's still Pending or shows it resolved.
      return next;
    });
  }, [state.slots]);

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

  // Filters for the badge history table (Loyalty Awards page)
  const [badgeHistoryDoctor, setBadgeHistoryDoctor] = useState("");
  const [badgeHistoryMonth, setBadgeHistoryMonth] = useState("");
  const [declarationsPage, setDeclarationsPage] = useState(0);
  const [printDeclaration, setPrintDeclaration] = useState<any>(null);

  // Sticky cache of pending slot bookings — the 10-second background poll
  // (pullFromSupabase) occasionally returns a slots snapshot that's
  // missing a genuinely-still-pending record (a flaky fetch, not a real
  // status change), which made the "Booking approvals" list flicker/
  // disappear moments after correctly showing a real pending booking.
  // This keeps a doctor's booking visible once seen, until it's either
  // explicitly approved/declined here, OR a fresh fetch shows that exact
  // slot ID with a definitively different (non-Pending) status — which
  // means it was genuinely resolved elsewhere, not just dropped by a bad
  // fetch.
  const [stickyPendingSlots, setStickyPendingSlots] = useState<Record<string, any>>({});
  // IDs the admin has explicitly approved/declined this session — once
  // resolved, never re-add to stickyPendingSlots even if a slow/stale
  // background poll still returns that slot as "Pending" (the action just
  // hasn't finished propagating to Supabase yet). Without this, clicking
  // Decline would make the card disappear for a moment, then reappear as
  // soon as the next 10-second poll ran with pre-decline data.
  const resolvedSlotIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab === "admin-fb" || activeTab === "feedback" || activeTab === "overview") {
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
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);

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
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [directoryDoctorSearch, setDirectoryDoctorSearch] = useState("");
  const [directoryPage, setDirectoryPage] = useState(1);


  const handleStaffKeywordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffAuthError("");
    const keyword = staffKeywordInput.trim();
    if (!keyword) {
      setStaffAuthError("Please enter your access keyword.");
      return;
    }
    // The keyword IS that staff account's password under the hood — this
    // lets admin issue staff members a simple keyword (via Create User)
    // instead of a phone number + password pair for this restricted,
    // view-only role. The match is now found server-side (verify_staff_key
    // RPC), so no password/keyword value is ever compared in the browser.
    const staffRes = await verifyStaffKey(keyword);
    if (!staffRes.success || !staffRes.user) {
      setStaffAuthError(staffRes.message || "Invalid access keyword.");
      return;
    }
    const staffPhone = String(staffRes.user.phone || "").trim();
    const res = await loginUser(staffPhone, undefined, "Staff", staffRes.user);
    if (res.success) {
      setActiveTab("admin-cal");
      setStaffKeywordInput("");
    } else {
      setStaffAuthError(res.message);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
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
    const res = await loginUser(phoneInput, passwordInput);
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

  const startEditingAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncementId(announcement.id);
    setAnnText(announcement.text);
  };

  const cancelEditingAnnouncement = () => {
    setEditingAnnouncementId(null);
    setAnnText("");
  };

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncementId || !annText.trim()) return;
    const response = editAnnouncement(editingAnnouncementId, annText.trim());
    alert(response);
    cancelEditingAnnouncement();
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
    ? Object.keys(stickyPendingSlots).length
    : 0;

  const DOCTOR_TABS = [
    {
      id: "overview",
      label: "Overview",
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: "booking",
      label: "Book Slot",
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      id: "status",
      label: "My Shifts",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Mail className="w-4 h-4 text-rose-500" />,
    },
    {
      id: "announcements",
      label: "Medical Toolkits",
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
      id: "announcements",
      label: "Medical Toolkits",
      icon: <BookOpen className="w-4 h-4 text-sky-400" />,
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

  const filteredAdminPatientFeedback = patientFeedbackEntries.filter(
    (feedback) =>
      feedbackDoctorFilter === "All" ||
      doctorNamesMatch(feedback.target, feedbackDoctorFilter),
  );
  const filteredAdminStaffFeedback = staffFeedbackEntries.filter(
    (feedback) =>
      feedbackDoctorFilter === "All" ||
      doctorNamesMatch(feedback.doctorName, feedbackDoctorFilter),
  );
  const activeAdminFeedbackCount =
    activeInspectorFb === "patient"
      ? filteredAdminPatientFeedback.length
      : activeInspectorFb === "staff"
        ? filteredAdminStaffFeedback.length
        : locumSurveyEntries.length;
  const activeAdminFeedbackPageCount = Math.max(
    1,
    Math.ceil(activeAdminFeedbackCount / 20),
  );
  const adminFeedbackPageStart = (feedbackPage - 1) * 20;
  const paginatedAdminPatientFeedback = filteredAdminPatientFeedback.slice(
    adminFeedbackPageStart,
    adminFeedbackPageStart + 20,
  );
  const paginatedAdminStaffFeedback = filteredAdminStaffFeedback.slice(
    adminFeedbackPageStart,
    adminFeedbackPageStart + 20,
  );
  const paginatedAdminLocumFeedback = locumSurveyEntries.slice(
    adminFeedbackPageStart,
    adminFeedbackPageStart + 20,
  );
  const directorySearchTerm = directoryDoctorSearch.trim().toLowerCase();
  const filteredDirectoryDoctors = state.users
    .filter((user) =>
      user.role === "Doctor" &&
      (!directorySearchTerm || user.name.toLowerCase().includes(directorySearchTerm)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const directoryPageCount = Math.max(1, Math.ceil(filteredDirectoryDoctors.length / 10));
  const paginatedDirectoryDoctors = filteredDirectoryDoctors.slice(
    (directoryPage - 1) * 10,
    directoryPage * 10,
  );

  useEffect(() => {
    setFeedbackPage(1);
  }, [activeInspectorFb, feedbackDoctorFilter]);

  useEffect(() => {
    if (feedbackPage > activeAdminFeedbackPageCount) {
      setFeedbackPage(activeAdminFeedbackPageCount);
    }
  }, [feedbackPage, activeAdminFeedbackPageCount]);

  useEffect(() => {
    setDirectoryPage(1);
  }, [directoryDoctorSearch]);

  useEffect(() => {
    if (directoryPage > directoryPageCount) setDirectoryPage(directoryPageCount);
  }, [directoryPage, directoryPageCount]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col">
      <AnimatePresence mode="wait">
        {!authReady ? (
          <motion.div
            key="auth-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500"
          >
            Checking secure session...
          </motion.div>
        ) : !state.currentUser ? (
          /* Authentication Screen with one-click quick logins */
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-white p-3 sm:p-5 md:h-screen md:p-4"
          >
            <div className="relative w-full md:flex md:max-w-5xl md:overflow-hidden md:rounded-[32px] md:shadow-[0_24px_70px_rgba(15,23,42,0.12)] lg:max-w-6xl">
              <section className="relative hidden min-h-[640px] w-1/2 overflow-hidden bg-gradient-to-br from-[#0d5078] via-[#0a3b5d] to-[#061d2d] p-12 text-white md:flex md:flex-col md:justify-center">
                <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-sky-300/15" />
                <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[#1591c7]/35" />
                <div className="pointer-events-none absolute right-16 top-16 h-28 w-28 rounded-full bg-[#37b7d3]/20" />
                <div className="pointer-events-none absolute bottom-24 left-16 h-32 w-32 rounded-full border-[22px] border-sky-300/10" />
                <div className="relative z-10 max-w-md">
                  <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 p-2.5 shadow-lg ring-1 ring-white/15">
                    <img src="/logo-ara-white.png" alt="AraLocum Hub" className="h-full w-full object-contain" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300">AraLocum Hub</span>
                  <h1 className="mt-3 font-display text-5xl font-bold leading-[1.05] tracking-tight text-white">Welcome back!</h1>
                  <p className="mt-5 max-w-sm text-lg leading-relaxed text-slate-300">Sign in to access your existing profile and continue managing your clinical shifts.</p>
                  <div className="mt-10 h-1 w-20 rounded-full bg-sky-300" />
                </div>
              </section>
              <div className="relative w-full max-w-sm overflow-hidden rounded-[30px] border border-sky-300/20 bg-gradient-to-br from-[#0b4569] via-[#082f49] to-[#061d2d] p-5 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:max-w-md sm:p-6 md:w-1/2 md:max-w-none md:rounded-none md:border-0 md:bg-white md:p-10 md:text-left md:shadow-none lg:p-12">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#3b82b5] opacity-45 blur-sm md:hidden" />
              <div className="pointer-events-none absolute -left-28 bottom-[-120px] h-72 w-72 rounded-full bg-[#0a5b86] opacity-80 md:hidden" />
              <div className="pointer-events-none absolute -right-24 bottom-[-90px] h-56 w-56 rounded-full bg-[#1b79ae] opacity-70 md:hidden" />
              <div className="pointer-events-none absolute bottom-[-30px] left-1/4 h-48 w-48 rounded-full bg-[#061d2d] opacity-75 md:hidden" />
              <div className="relative z-10 space-y-5 md:space-y-4 lg:space-y-5">
              {/* Clinic Logo */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center md:hidden">
                <img src="/logo-ara-white.png" alt="Klinik ARA 24 Jam" className="w-16 h-16 object-contain" />
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                  AraLocum Hub
                </h2>
                <p className="mt-1 text-xs font-medium text-white">
                  Every shift matters, every patient counts
                </p>
              </div>

              <form
                onSubmit={handleManualLogin}
                className="space-y-3.5 text-left md:space-y-3"
              >
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white">
                    Phone validation
                  </label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full rounded-full border border-white/20 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200 sm:text-sm md:border-slate-200"
                    placeholder="e.g. 0123456789"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white">
                    Password
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full rounded-full border border-white/20 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200 sm:text-sm md:border-slate-200"
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
                  className="w-full cursor-pointer rounded-full bg-[#082f49] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0d5078] outline-none"
                >
                  Sign In Securely
                </button>
                <p className="text-center font-sans text-[11px] text-sky-200/80 md:text-slate-400">
                  Forgot your password? Please contact your clinic admin to have it reset.
                </p>
              </form>

                {/* Local development quick logins only. */}
                {import.meta.env.DEV && <div className="space-y-2 rounded-2xl border border-sky-200/20 bg-slate-950/25 p-2.5 text-left md:border-slate-200 md:bg-slate-50">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-white">
                    ⚡ Quick Dev Logins
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => loginUser("0182194256", "dev")}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] transition"
                    >
                      Dev Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => loginUser("0198765432", "dev")}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] transition"
                    >
                      Dev Doctor
                    </button>
                    <button
                      type="button"
                      onClick={() => loginUser("0112233445", "dev", "Staff")}
                      className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] transition"
                    >
                      Dev Staff
                    </button>
                  </div>
                </div>}

                {/* Staff quick access — keyword only, view-only Clinical Schedule access */}
                <div className="space-y-2 border-t border-white/15 pt-3 text-left md:border-slate-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-white">
                    Staff quick access
                  </span>
                  <form onSubmit={handleStaffKeywordLogin} className="flex gap-2">
                    <input
                      type="password"
                      value={staffKeywordInput}
                      onChange={(e) => setStaffKeywordInput(e.target.value)}
                      className="flex-1 rounded-full border border-white/20 bg-white px-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200 md:border-slate-200"
                      placeholder="Enter access keyword"
                    />
                    <button
                      type="submit"
                      className="shrink-0 cursor-pointer rounded-full bg-[#082f49] px-4 text-xs font-bold text-white transition hover:bg-[#0d5078]"
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
              <div className="rounded-2xl border border-white/20 bg-white/10 p-2.5 text-left shadow-sm backdrop-blur-sm md:border-slate-200 md:bg-slate-50">
                <p className="text-[11px] font-medium leading-relaxed text-sky-100 md:text-slate-600">
                  Interested in joining our medical team at Klinik ARA 24 Jam?
                </p>
                <a
                  href="https://forms.gle/RKDNR6Q7b28gQ5v3A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#082f49] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0d5078]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Begin Application Request
                </a>
              </div>
              </div>
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
            <aside className="hidden md:flex flex-col w-64 bg-[#082f49] text-slate-200 border-r border-[#0b4569] shrink-0 p-5 space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-white/10">
                <img src="/logo-ara-white.png" alt="Klinik ARA 24 Jam" className="w-8 h-8 object-contain" />
                <span className="font-display font-bold text-white tracking-tight text-sm">
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
                            : "bg-white text-[#082f49] shadow-sm"
                          : showRedBadge
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 hover:text-rose-700 border border-rose-200/50"
                            : "hover:bg-white/10 text-slate-300 hover:text-white"
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
                            : "text-slate-500"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* User profile brief card */}
              <div className="p-3 bg-white/10 rounded-xl border border-white/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-400/20 border border-sky-300/30 flex items-center justify-center font-bold text-xs text-sky-100 font-display shrink-0">
                  {state.currentUser.role === "Admin" ? "HQ" : state.currentUser.role === "Staff" ? "CA" : "DR"}
                </div>
                <div className="truncate flex-1">
                  <p className="text-[11px] font-bold text-white truncate">
                    {state.currentUser.role === "Admin"
                      ? "Operations Admin"
                      : state.currentUser.role === "Staff"
                        ? "CA ARA"
                        : `Dr. ${state.currentUser.name}`}
                  </p>
                  <p className="text-[9px] text-sky-200/80 font-semibold tracking-wider uppercase">
                    {state.currentUser.role}
                  </p>
                </div>
              </div>

            </aside>

            {/* Mobile Actions Topbar Header */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-10 sticky top-0 backdrop-blur-md bg-white/95">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#082f49]">
                  <img src="/logo-ara-white.png" alt="Klinik ARA 24 Jam" className="h-5 w-5 object-contain" />
                </span>
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
              <div className="hidden md:flex items-center justify-end">
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-1.5 rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-[11px] font-semibold text-rose-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
              {import.meta.env.DEV && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-800">
                  Local preview mode — live data is view-only. Booking, edits and uploads are disabled.
                </div>
              )}
              {/* User Dynamic Greeting Banner */}
              <div className="flex flex-col items-start gap-5 rounded-[28px] bg-gradient-to-br from-[#082f49] via-[#0a3b5d] to-[#0d5078] px-6 py-7 text-white shadow-[0_12px_30px_rgba(8,47,73,0.14)] ring-1 ring-sky-300/20 sm:flex-row sm:justify-between sm:px-8 sm:py-8">
                <div className="min-w-0 space-y-1 text-left">
                  <span className="block text-[11px] font-semibold tracking-[0.16em] text-sky-300 uppercase">
                    Klinik ARA 24 Jam
                  </span>
                  <h3 className="font-display text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl">
                    Welcome,{" "}
                    {state.currentUser.role === "Admin"
                      ? "HQ Operations Office"
                      : state.currentUser.role === "Staff"
                        ? "CA ARA"
                        : `Dr. ${state.currentUser.name}`}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                    {state.currentUser.role === "Admin"
                      ? "Roster database and clinical slots synchronized safely."
                      : "Thank you for being part of Klinik ARA 24 Jam."}
                  </p>
                </div>

                <div className="flex w-full shrink-0 flex-col items-start gap-3 sm:w-auto sm:max-w-none sm:items-end">
                  <span className="rounded-full bg-white/10 px-3.5 py-2 text-[11px] font-medium text-slate-200 ring-1 ring-white/15">
                    {new Date().toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <div className="border-l-2 border-sky-300/40 pl-3 text-left sm:border-l-0 sm:border-r-2 sm:pr-3 sm:text-right">
                    <div>
                      <p className="whitespace-normal text-[11px] italic leading-relaxed text-slate-300 sm:whitespace-nowrap">
                        “{dailyQuote}”
                      </p>
                    </div>
                  </div>
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
                  {activeRole === "Doctor" && (activeTab === "status" || activeTab === "peds-calc") && (
                    <DoctorTabHeader tab={activeTab} />
                  )}

                  {activeTab === "overview" && activeRole === "Doctor" && state.currentUser && (
                    <DoctorOverviewTab
                      slots={state.slots}
                      currentUser={state.currentUser}
                      notifications={state.notifications}
                      feedbacks={patientFeedbackEntries}
                      onNavigate={setActiveTab}
                    />
                  )}

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
                      announcements={state.announcements}
                      currentUser={state.currentUser}
                      onDeleteNotification={deleteNotification}
                      onMarkRead={markNotificationsAsRead}
                    />
                  )}

                  {activeTab === "announcements" && (activeRole === "Doctor" || activeRole === "Admin") && (
                    <div className="space-y-6">
                      <div className="relative overflow-hidden rounded-[28px] bg-[#082f49] p-6 text-white shadow-[0_12px_32px_rgba(8,47,73,0.18)]">
                        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-sky-300/10 blur-2xl" />
                        <div className="relative flex items-start justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-bold tracking-[0.2em] text-sky-300 uppercase block">
                              Clinical reference desk
                            </span>
                            <h4 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                              Medical Toolkits
                            </h4>
                            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
                              Quick access to helpful resources when you need them most.
                            </p>
                          </div>
                          <div className="hidden rounded-2xl border border-white/10 bg-white/10 p-3 sm:block">
                            <BookOpen className="h-6 w-6 text-sky-200" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <a
                          href="https://sites.google.com/moh.gov.my/nag/contents/section-c-clinical-pathways-in-primary-care?authuser=0"
                          target="_blank"
                          rel="noopener"
                          className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                        >
                          <span className="mb-4 flex items-center justify-between text-sky-600"><BookOpen className="h-5 w-5" /><ExternalLink className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-sky-500" /></span>
                          <span>National Antibiotic Guidelines (NAG) 2024</span>
                        </a>
                        <a
                          href="https://www.acadmed.org.my/index.cfm?&menuid=67"
                          target="_blank"
                          rel="noopener"
                          className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                        >
                          <span className="mb-4 flex items-center justify-between text-indigo-500"><FileText className="h-5 w-5" /><ExternalLink className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-indigo-500" /></span>
                          <span>Malaysia Clinical Practice Guidelines (CPG)</span>
                        </a>
                        <a
                          href="https://www.mdcalc.com/"
                          target="_blank"
                          rel="noopener"
                          className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                        >
                          <span className="mb-4 flex items-center justify-between text-emerald-500"><Calculator className="h-5 w-5" /><ExternalLink className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-emerald-500" /></span>
                          <span>MDCalc Medical Calculators</span>
                        </a>
                        <a
                          href="https://drive.google.com/file/d/1GQnsrxuF-lbyFJ5U28ZGpfjJgp5fD5Rh/view?usp=sharing"
                          target="_blank"
                          rel="noopener"
                          className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                        >
                          <span className="mb-4 flex items-center justify-between text-violet-500"><HelpCircle className="h-5 w-5" /><ExternalLink className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-violet-500" /></span>
                          <span>PLATO Guide for Doctors</span>
                        </a>
                        <a
                          href="https://mpaeds.my/wp-content/uploads/2026/03/Paediatric-Protocols-for-Malaysia-Hospital-1.pdf"
                          target="_blank"
                          rel="noopener"
                          className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                        >
                          <span className="mb-4 flex items-center justify-between text-rose-500"><Heart className="h-5 w-5" /><ExternalLink className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-rose-500" /></span>
                          <span>Paediatric Protocols for Malaysia Hospitals</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setActiveTab("peds-calc")}
                          className="group flex min-h-[112px] cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-700 shadow-[0_4px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                        >
                          <span className="mb-4 flex items-center justify-between text-amber-500"><Calculator className="h-5 w-5" /><ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-amber-500" /></span>
                          <span>Paeds Calculator</span>
                        </button>
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
                      allBadgeAwards={allBadgeAwards}
                      onRecalculateBadges={async (month, year) => {
                        // Don't rely on patientFeedbackEntries — it's only
                        // populated after visiting the Feedback Management
                        // tab, so clicking Recalculate Badges straight from
                        // this tab (a very normal thing to do) would run
                        // with an empty feedback list and silently skip
                        // Heart Winner every time. Fetch fresh right here
                        // instead, so it works regardless of which tabs
                        // were visited this session.
                        let feedbackForRecalc = patientFeedbackEntries;
                        try {
                          feedbackForRecalc = await fetchPatientFeedbackFromSheets();
                          setPatientFeedbackEntries(feedbackForRecalc);
                        } catch (err) {
                          console.error(
                            "Recalculate Badges: failed to fetch fresh feedback, falling back to cached patientFeedbackEntries",
                            err,
                          );
                        }
                        return recalculateBadges(month, year, feedbackForRecalc);
                      }}
                    />
                  )}

                  {activeTab === "admin-cal" &&
                    (activeRole === "Admin" || activeRole === "Staff") && (
                      <AdminScheduleTab
                        slots={state.slots}
                        users={state.users}
                        currentUserRole={activeRole || "Admin"}
                        onManageSlot={adminManageSlot}
                        onEditTiming={adminEditSlotTiming}
                        onBulkCreateSlots={adminCreateBulkSlots}
                        adminAlerts={state.adminAlerts}
                        onDismissAlert={dismissAdminAlert}
                      />
                    )}

                  {activeTab === "admin-tasks" && activeRole === "Admin" && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="rounded-[28px] bg-gradient-to-br from-[#082f49] via-[#0a3b5d] to-[#0d5078] p-5 text-white shadow-[0_12px_30px_rgba(8,47,73,0.14)] sm:p-6">
                          <span className="text-[10px] font-bold tracking-[0.2em] text-sky-300 uppercase">Admin workspace</span>
                          <h5 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">Booking Approvals</h5>
                          <p className="mt-1 text-xs text-slate-300">Review pending shift requests and recruitment candidates.</p>
                        </div>
                        <h5 className="px-1 font-display font-bold text-slate-900 tracking-tight text-sm uppercase">
                          Pending Slots Registrations
                        </h5>

                        {Object.keys(stickyPendingSlots).length === 0 ? (
                          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-150 shadow-sm">
                            No shift approvals pending at this time.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.values(stickyPendingSlots).map((slot: any) => {
                              return (
                                <div
                                  key={slot.id}
                                  className="bg-white rounded-3xl border border-sky-100 p-5 shadow-[0_6px_22px_rgba(15,23,42,0.04)] space-y-4"
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
                                        resolvedSlotIdsRef.current.add(slot.id);
                                        setStickyPendingSlots((prev) => {
                                          const next = { ...prev };
                                          delete next[slot.id];
                                          return next;
                                        });
                                        const res = await adminApproveSlot(
                                          slot.id,
                                        );
                                        if (/not found/i.test(res)) {
                                          // Blocking alert() freezes repaint,
                                          // making the already-removed card
                                          // look "stuck" until the dialog is
                                          // dismissed — skip it entirely so
                                          // the card just disappears cleanly.
                                          console.warn(
                                            "Slot no longer exists — removed from pending list:",
                                            slot.id,
                                          );
                                        } else {
                                          alert(res);
                                        }
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
                                            resolvedSlotIdsRef.current.add(slot.id);
                                            setStickyPendingSlots((prev) => {
                                              const next = { ...prev };
                                              delete next[slot.id];
                                              return next;
                                            });
                                            const res = await adminManageSlot(
                                              "CANCEL",
                                              slot.id,
                                            );
                                            if (/not found/i.test(res)) {
                                              console.warn(
                                                "Slot no longer exists — removed from pending list:",
                                                slot.id,
                                              );
                                            } else {
                                              alert(res);
                                            }
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

                      <form
                        onSubmit={editingAnnouncementId ? handleSaveAnnouncement : handePublishAnn}
                        className="space-y-4"
                      >
                        <textarea
                          rows={4}
                          required
                          value={annText}
                          onChange={(e) => setAnnText(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 font-semibold p-4 rounded-2xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#001F3F] text-slate-800"
                          placeholder="Type announcements instructions..."
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            className="bg-[#001F3F] font-bold hover:bg-[#001226] text-white py-3 px-6 rounded-xl text-xs shadow-md shadow-[#001F3F]/10 transition cursor-pointer"
                          >
                            {editingAnnouncementId ? "✓ Save Announcement" : "✓ Publish Announcements"}
                          </button>
                          {editingAnnouncementId && (
                            <button
                              type="button"
                              onClick={cancelEditingAnnouncement}
                              className="border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 py-3 px-5 rounded-xl text-xs transition cursor-pointer"
                            >
                              Cancel Edit
                            </button>
                          )}
                        </div>
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
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditingAnnouncement(ann)}
                                className="text-[#001F3F] hover:text-[#001226] font-bold rounded-lg px-2 py-1.5 hover:bg-blue-50 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteAnnouncement(ann.id)}
                                className="text-rose-500 hover:text-rose-700 font-bold rounded-lg px-2 py-1.5 hover:bg-rose-50 hover:underline text-xs"
                              >
                                Purge
                              </button>
                            </div>
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
                          </div>
                      </div>

                      {/* Badge History table — filter by doctor and month to
                          see exactly what a doctor earned, sourced straight
                          from badge_awards (the source of truth). */}
                      <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
                        <h5 className="font-display font-semibold text-slate-800 text-sm tracking-tight uppercase flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-slate-500" />
                          Badge History
                        </h5>
                        <p className="text-xs text-slate-500">
                          Filter by doctor and/or month to see exactly which
                          badges were awarded, sourced live from badge_awards.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <select
                            value={badgeHistoryDoctor}
                            onChange={(e) => setBadgeHistoryDoctor(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 cursor-pointer"
                          >
                            <option value="">All Doctors</option>
                            {Array.from(
                              new Set(allBadgeAwards.map((r) => r.doctor_name)),
                            )
                              .sort()
                              .map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                          </select>
                          <select
                            value={badgeHistoryMonth}
                            onChange={(e) => setBadgeHistoryMonth(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 cursor-pointer"
                          >
                            <option value="">All Months</option>
                            {Array.from(
                              new Set(allBadgeAwards.map((r) => r.month_tag)),
                            )
                              .sort()
                              .reverse()
                              .map((mt) => (
                                <option key={mt} value={mt}>
                                  {mt}
                                </option>
                              ))}
                          </select>
                        </div>

                        {(() => {
                          const filtered = allBadgeAwards.filter(
                            (r) =>
                              (!badgeHistoryDoctor || r.doctor_name === badgeHistoryDoctor) &&
                              (!badgeHistoryMonth || r.month_tag === badgeHistoryMonth),
                          );

                          // Group: doctor -> badge -> [{month, count}], so
                          // each doctor's card shows every badge they've
                          // earned, with a cumulative total plus a
                          // month-by-month breakdown underneath.
                          const byDoctor: {
                            [doctor: string]: {
                              [badge: string]: { month: string; count: number }[];
                            };
                          } = {};
                          filtered.forEach((r) => {
                            if (!byDoctor[r.doctor_name]) byDoctor[r.doctor_name] = {};
                            if (!byDoctor[r.doctor_name][r.badge_name]) {
                              byDoctor[r.doctor_name][r.badge_name] = [];
                            }
                            byDoctor[r.doctor_name][r.badge_name].push({
                              month: r.month_tag,
                              count: r.award_count,
                            });
                          });
                          const POINTS_PER_BADGE_LOCAL: { [badge: string]: number } = {
                            "Iron Doctor": 10,
                            "Heart Winner": 15,
                            "The Unstoppable": 10,
                            "The Diligent Doc": 10,
                            "Last Minute Saviour": 20,
                            "Team Favorite": 20,
                          };

                          const doctorTotals: { [doctor: string]: number } = {};
                          Object.keys(byDoctor).forEach((doctorName) => {
                            const badges = byDoctor[doctorName];
                            doctorTotals[doctorName] = Object.keys(badges).reduce((sum, bn) => {
                              const perBadge = POINTS_PER_BADGE_LOCAL[bn] ?? 10;
                              const badgeCount = badges[bn].reduce((s, e) => s + e.count, 0);
                              return sum + perBadge * badgeCount;
                            }, 0);
                          });

                          // Highest total AraCoins first, not alphabetical
                          const doctorNames = Object.keys(byDoctor).sort(
                            (a, b) => doctorTotals[b] - doctorTotals[a],
                          );

                          if (doctorNames.length === 0) {
                            return (
                              <p className="text-center text-slate-400 text-xs py-8">
                                No badges match this filter.
                              </p>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {doctorNames.map((doctorName) => {
                                const badges = byDoctor[doctorName];
                                const badgeNames = Object.keys(badges).sort();
                                const doctorTotal = doctorTotals[doctorName];
                                return (
                                  <div
                                    key={doctorName}
                                    className="rounded-2xl border border-slate-100 p-4 space-y-3 bg-slate-50/50"
                                  >
                                    <div className="flex justify-between items-baseline">
                                      <h6 className="font-display font-bold text-slate-800 text-sm">
                                        {doctorName}
                                      </h6>
                                      <span className="text-xs font-bold text-amber-600 font-mono">
                                        🪙 {doctorTotal}
                                      </span>
                                    </div>
                                    <div className="space-y-2.5">
                                      {badgeNames.map((badgeName) => {
                                        const entries = [...badges[badgeName]].sort((a, b) =>
                                          b.month.localeCompare(a.month),
                                        );
                                        const total = entries.reduce((sum, e) => sum + e.count, 0);
                                        return (
                                          <div
                                            key={badgeName}
                                            className="bg-white rounded-xl p-3 border border-slate-100"
                                          >
                                            <div className="flex justify-between items-center">
                                              <span className="text-xs font-bold text-slate-700">
                                                {badgeName}
                                              </span>
                                              <span className="text-xs font-bold text-amber-600">
                                                ×{total} total
                                              </span>
                                            </div>
                                            <div className="mt-1.5 space-y-0.5">
                                              {entries.map((e, i) => (
                                                <div
                                                  key={i}
                                                  className="flex justify-between text-[10px] text-slate-500"
                                                >
                                                  <span className="font-mono">{e.month}</span>
                                                  <span>×{e.count}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Pre-Shift Declarations — QR check-in submissions.
                          Staff display a static per-branch QR code at the
                          counter; doctors scan it to acknowledge the
                          clinical practice declaration before starting
                          their shift. */}
                      <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
                        <h5 className="font-display font-semibold text-slate-800 text-sm tracking-tight uppercase flex items-center gap-1.5">
                          <ClipboardList className="w-4 h-4 text-slate-500" />
                          Pre-Shift Declarations (QR Check-In)
                        </h5>
                        <p className="text-xs text-slate-500">
                          Print and display the QR code for each branch at the counter. Doctors
                          scan it to read and acknowledge the clinical practice declaration
                          before starting their shift.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {["Kajang", "Seri Kembangan", "Semenyih"].map((branch) => {
                            const declareUrl = `${window.location.origin}${window.location.pathname}?declare=${encodeURIComponent(branch)}`;
                            const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(declareUrl)}`;
                            return (
                              <div
                                key={branch}
                                className="rounded-2xl border border-slate-100 p-4 text-center space-y-2"
                              >
                                <p className="text-xs font-bold text-slate-700">{branch}</p>
                                <img
                                  src={qrImg}
                                  alt={`QR code for ${branch}`}
                                  className="mx-auto rounded-lg border border-slate-100"
                                />
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(declareUrl);
                                    alert(`Link copied for ${branch}:\n${declareUrl}`);
                                  }}
                                  className="text-[10px] text-indigo-600 font-bold"
                                >
                                  Copy link
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Recent Submissions ({shiftDeclarations.length})
                          </span>
                          <button
                            onClick={refreshShiftDeclarations}
                            className="text-[10px] font-bold text-indigo-600"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50">
                              <tr className="text-slate-400 uppercase text-[10px]">
                                <th className="text-left p-3 font-bold">Doctor</th>
                                <th className="text-left p-3 font-bold">Branch</th>
                                <th className="text-left p-3 font-bold">Resident Standby</th>
                                <th className="text-right p-3 font-bold">Declared At</th>
                                <th className="text-right p-3 font-bold">Print</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {shiftDeclarations
                                .slice(declarationsPage * 10, declarationsPage * 10 + 10)
                                .map((d) => (
                                  <tr key={d.id}>
                                    <td className="p-3 font-semibold text-slate-700">{d.doctor_name}</td>
                                    <td className="p-3 text-slate-600">{d.branch}</td>
                                    <td className="p-3 text-slate-500">{d.resident_doctor_name || '—'}</td>
                                    <td className="p-3 text-right text-slate-400 font-mono">
                                      {new Date(d.declared_at).toLocaleString('en-GB')}
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        onClick={() => setPrintDeclaration(d)}
                                        className="text-indigo-600 font-bold text-[10px] border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-50"
                                      >
                                        View
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              {shiftDeclarations.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-6 text-center text-slate-400">
                                    No declarations submitted yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {shiftDeclarations.length > 10 && (
                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => setDeclarationsPage((p) => Math.max(0, p - 1))}
                              disabled={declarationsPage === 0}
                              className="text-[10px] font-bold text-slate-500 disabled:opacity-30"
                            >
                              ← Previous
                            </button>
                            <span className="text-[10px] text-slate-400">
                              Page {declarationsPage + 1} of{" "}
                              {Math.ceil(shiftDeclarations.length / 10)}
                            </span>
                            <button
                              onClick={() =>
                                setDeclarationsPage((p) =>
                                  (p + 1) * 10 < shiftDeclarations.length ? p + 1 : p,
                                )
                              }
                              disabled={(declarationsPage + 1) * 10 >= shiftDeclarations.length}
                              className="text-[10px] font-bold text-slate-500 disabled:opacity-30"
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Printable view of a single shift declaration — for
                      keeping a physical record in case of medical/legal
                      issues arising from that shift. */}
                  {printDeclaration && (
                    <div
                      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:bg-white print:!static print:!block print:!p-0 print:!h-auto print:!w-auto"
                      onClick={() => setPrintDeclaration(null)}
                    >
                      <div
                        className="printable-declaration bg-white rounded-3xl sm:max-w-2xl w-full max-h-[85vh] overflow-y-auto p-8 space-y-6 print:max-h-none print:overflow-visible print:rounded-none print:shadow-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-center space-y-1 pb-4 border-b border-slate-100">
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                            Klinik ARA 24 Jam
                          </p>
                          <h2 className="text-lg font-bold text-slate-800">
                            Locum Doctor: Declaration &amp; Rules of Safe Clinical Practice
                          </h2>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 uppercase font-bold block">Doctor</span>
                            <span className="text-slate-700 font-semibold">
                              Dr. {printDeclaration.doctor_name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 uppercase font-bold block">Branch</span>
                            <span className="text-slate-700 font-semibold">{printDeclaration.branch}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 uppercase font-bold block">MMC Number</span>
                            <span className="text-slate-700 font-semibold">
                              {printDeclaration.mmc_number || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 uppercase font-bold block">Phone</span>
                            <span className="text-slate-700 font-semibold">
                              {printDeclaration.doctor_phone || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 uppercase font-bold block">
                              Resident Doctor on Standby
                            </span>
                            <span className="text-slate-700 font-semibold">
                              {printDeclaration.resident_doctor_name || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 uppercase font-bold block">
                              Declared At
                            </span>
                            <span className="text-slate-700 font-semibold">
                              {new Date(printDeclaration.declared_at).toLocaleString('en-GB')}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4 border border-slate-100 rounded-2xl p-4">
                          {DECLARATION_TEXT.map((section) => (
                            <div key={section.title}>
                              <h3 className="text-xs font-bold text-slate-700 mb-1">
                                {section.title}
                              </h3>
                              <ul className="list-disc list-inside space-y-0.5">
                                {section.body.map((line, i) => (
                                  <li key={i} className="text-[11px] text-slate-500 leading-relaxed">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-slate-600 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
                          I hereby acknowledge and agree to the above terms and conditions, and
                          commit to upholding them throughout my shift.
                        </p>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400 uppercase font-bold block mb-4">
                              Signature (Digital Acknowledgment)
                            </span>
                            <span className="text-slate-700 font-semibold border-b border-slate-300 pb-1">
                              Dr. {printDeclaration.doctor_name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 uppercase font-bold block mb-4">
                              Clinic Chop
                            </span>
                            <div className="border-b border-slate-300 h-6" />
                          </div>
                        </div>

                        <div className="flex gap-3 print:hidden">
                          <button
                            onClick={() => setPrintDeclaration(null)}
                            className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => {
                              const sectionsHtml = DECLARATION_TEXT.map(
                                (section) => `
                                  <div style="margin-bottom:12px;">
                                    <h3 style="font-size:12px;font-weight:700;color:#334155;margin:0 0 4px;">${section.title}</h3>
                                    <ul style="margin:0;padding-left:18px;">
                                      ${section.body
                                        .map(
                                          (line) =>
                                            `<li style="font-size:11px;color:#64748b;line-height:1.5;">${line}</li>`,
                                        )
                                        .join('')}
                                    </ul>
                                  </div>
                                `,
                              ).join('');

                              const html = `
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <meta charset="utf-8" />
                                  <title>Pre-Shift Declaration — Dr. ${printDeclaration.doctor_name}</title>
                                  <style>
                                    @page { size: A4; margin: 0; }
                                    * { box-sizing: border-box; }
                                    html, body { margin: 0; padding: 0; background: #e2e8f0; }
                                    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1e293b; }
                                    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 18mm; }
                                    .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
                                    .header .brand { font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; }
                                    .header h1 { font-size: 16px; margin: 4px 0 0; }
                                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 11px; margin-bottom: 16px; }
                                    .grid .label { color: #94a3b8; text-transform: uppercase; font-weight: 700; font-size: 9px; display: block; }
                                    .grid .value { color: #334155; font-weight: 600; }
                                    .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
                                    .box h3 { font-size: 12px; font-weight: 700; color: #334155; margin: 0 0 4px; }
                                    .box:last-of-type h3, .box h3:last-child { margin-bottom: 0; }
                                    .box ul { margin: 0 0 12px; padding-left: 18px; }
                                    .box > div:last-child ul { margin-bottom: 0; }
                                    .box li { font-size: 11px; color: #64748b; line-height: 1.5; }
                                    .ack { font-size: 11px; background: #eef2ff; border: 1px solid #e0e7ff; border-radius: 10px; padding: 10px; margin-bottom: 20px; }
                                    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 11px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
                                    .sign-grid .label { color: #94a3b8; text-transform: uppercase; font-weight: 700; font-size: 9px; display: block; margin-bottom: 16px; }
                                    .sign-line { border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
                                    @media print {
                                      body { background: #fff; }
                                      .page { width: auto; min-height: 0; margin: 0; padding: 0; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="page">
                                  <div class="header">
                                    <div class="brand">Klinik ARA 24 Jam</div>
                                    <h1>Locum Doctor: Declaration &amp; Rules of Safe Clinical Practice</h1>
                                  </div>
                                  <div class="grid">
                                    <div><span class="label">Doctor</span><span class="value">Dr. ${printDeclaration.doctor_name}</span></div>
                                    <div><span class="label">Branch</span><span class="value">${printDeclaration.branch}</span></div>
                                    <div><span class="label">MMC Number</span><span class="value">${printDeclaration.mmc_number || '—'}</span></div>
                                    <div><span class="label">Phone</span><span class="value">${printDeclaration.doctor_phone || '—'}</span></div>
                                    <div><span class="label">Resident Doctor on Standby</span><span class="value">${printDeclaration.resident_doctor_name || '—'}</span></div>
                                    <div><span class="label">Declared At</span><span class="value">${new Date(printDeclaration.declared_at).toLocaleString('en-GB')}</span></div>
                                  </div>
                                  <div class="box">${sectionsHtml}</div>
                                  <div class="ack">I hereby acknowledge and agree to the above terms and conditions, and commit to upholding them throughout my shift.</div>
                                  <div class="sign-grid">
                                    <div>
                                      <span class="label">Signature (Digital Acknowledgment)</span>
                                      <span class="sign-line">Dr. ${printDeclaration.doctor_name}</span>
                                    </div>
                                    <div>
                                      <span class="label">Clinic Chop</span>
                                      <div class="sign-line">&nbsp;</div>
                                    </div>
                                  </div>
                                  </div>
                                </body>
                                </html>
                              `;

                              const printWindow = window.open('', '_blank', 'width=850,height=1100');
                              if (printWindow) {
                                printWindow.document.write(html);
                                printWindow.document.close();
                                printWindow.onload = () => {
                                  printWindow.focus();
                                  printWindow.print();
                                };
                              }
                            }}
                            className="flex-1 bg-[#001F3F] text-white font-bold py-3 rounded-xl text-sm"
                          >
                            🖨️ Print
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "admin-fb" && activeRole === "Admin" && (
                    <div className="space-y-5">
                      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#082f49] via-[#0a3b5d] to-[#0d5078] p-5 text-white shadow-[0_12px_30px_rgba(8,47,73,0.14)] sm:p-7">
                        <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-sky-300/10 blur-2xl" />
                        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">Feedback intelligence</span>
                            <h5 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                              <MessageSquare className="h-6 w-6 text-sky-300" />
                              Feedback Management
                            </h5>
                            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
                            {loadingFeedback
                              ? "Loading feedback from Google Sheets..."
                              : "Review patient, staff and doctor feedback in one clear workspace."}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:min-w-[310px]">
                            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                              <span className="block text-[10px] uppercase tracking-wider text-sky-200">Patients</span>
                              <strong className="mt-1 block text-2xl font-semibold">{patientFeedbackEntries.length}</strong>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                              <span className="block text-[10px] uppercase tracking-wider text-sky-200">Staff</span>
                              <strong className="mt-1 block text-2xl font-semibold">{staffFeedbackEntries.length}</strong>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                              <span className="block text-[10px] uppercase tracking-wider text-sky-200">Doctor</span>
                              <strong className="mt-1 block text-2xl font-semibold">{locumSurveyEntries.length}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        {/* Dropdown database index selector */}
                        <div className="flex flex-wrap items-center gap-2">
                          {activeInspectorFb !== "locum" && feedbackDoctorOptions.length > 0 && (
                            <select
                              value={feedbackDoctorFilter}
                              onChange={(e) => setFeedbackDoctorFilter(e.target.value)}
                              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-sky-400"
                            >
                              <option value="All">All Doctors</option>
                              {feedbackDoctorOptions.map((opt) => (
                                <option key={opt.normalized} value={opt.normalized}>
                                  {opt.display}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1">
                            {(["patient", "staff", "locum"] as const).map(
                              (fType) => (
                                <button
                                  key={fType}
                                  onClick={() => setActiveInspectorFb(fType)}
                                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
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
                        <span className="text-xs font-semibold text-slate-400">
                          {activeAdminFeedbackCount} records · Page {feedbackPage} of {activeAdminFeedbackPageCount}
                        </span>
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
                              {paginatedAdminPatientFeedback.map((f, i) => (
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
                        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
                          <table className="w-full min-w-[820px] text-left text-xs leading-normal">
                            <thead className="bg-[#082f49] text-[10px] font-black uppercase tracking-wider text-sky-100">
                              <tr>
                                <th className="px-4 py-3.5">Submitted</th>
                                <th className="px-4 py-3.5">Staff member</th>
                                <th className="px-4 py-3.5">Doctor</th>
                                <th className="px-4 py-3.5">Branch</th>
                                <th className="px-4 py-3.5">Category</th>
                                <th className="px-4 py-3.5">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                          {paginatedAdminStaffFeedback.map((f, i) => {
                            const catLower = f.category.toLowerCase();
                            const isSerious = catLower.includes("aduan serius");
                            const isMinor = catLower.includes("isu kecil");
                            const isPositive = catLower.includes("positif");
                            const catStyle = isSerious
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : isMinor
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : isPositive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600";
                            const categoryIcon = isSerious ? <AlertTriangle className="h-3.5 w-3.5" /> : isPositive ? <CheckCircle className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />;
                            const rowId = `s-${i}`;
                            return (
                              <tr key={i} className="align-top transition hover:bg-sky-50/40">
                                <td className="whitespace-nowrap px-4 py-4 font-mono text-[10px] text-slate-400">{f.timestamp || "—"}</td>
                                <td className="px-4 py-4 font-bold text-slate-900">{f.staffName || "Staff member"}</td>
                                <td className="px-4 py-4 font-semibold text-[#0d5078]">{f.doctorName || "Doctor not specified"}</td>
                                <td className="px-4 py-4 font-medium text-slate-600">{f.cawangan || "—"}</td>
                                <td className="px-4 py-4">
                                  <span className={`inline-flex max-w-[180px] items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-black uppercase tracking-wide ${catStyle}`}>
                                    {categoryIcon}
                                    <span className="leading-tight">{f.category || "Uncategorised"}</span>
                                  </span>
                                </td>
                                <td className="max-w-[280px] px-4 py-4">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedFbRow(expandedFbRow === rowId ? null : rowId)}
                                    title="Click to expand"
                                    className={`text-left italic leading-relaxed text-slate-600 transition hover:text-[#0d5078] ${expandedFbRow === rowId ? "" : "line-clamp-2"}`}
                                  >
                                    “{f.details || "No additional details provided."}”
                                  </button>
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
                            paginatedAdminLocumFeedback.map((s, i) => (
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

                      {activeAdminFeedbackCount > 20 && (
                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <button
                            type="button"
                            disabled={feedbackPage === 1}
                            onClick={() => setFeedbackPage((page) => Math.max(1, page - 1))}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-300 hover:text-[#082f49] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ← Previous
                          </button>
                          <span className="text-xs font-bold text-slate-500">
                            Page {feedbackPage} of {activeAdminFeedbackPageCount}
                          </span>
                          <button
                            type="button"
                            disabled={feedbackPage === activeAdminFeedbackPageCount}
                            onClick={() => setFeedbackPage((page) => Math.min(activeAdminFeedbackPageCount, page + 1))}
                            className="rounded-xl bg-[#082f49] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0d5078] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Next →
                          </button>
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

                      <div className="relative max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={directoryDoctorSearch}
                          onChange={(e) => setDirectoryDoctorSearch(e.target.value)}
                          placeholder="Search doctor name..."
                          aria-label="Search doctor name"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        />
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
                            {filteredDirectoryDoctors.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-xs font-semibold text-slate-400">
                                  No doctors found matching “{directoryDoctorSearch}”.
                                </td>
                              </tr>
                            ) : paginatedDirectoryDoctors.map((doc) => {
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

                      {filteredDirectoryDoctors.length > 10 && (
                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-xs font-semibold text-slate-400">
                            {filteredDirectoryDoctors.length} doctors · Page {directoryPage} of {directoryPageCount}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={directoryPage === 1}
                              onClick={() => setDirectoryPage((page) => Math.max(1, page - 1))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-300 hover:text-[#082f49] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ← Previous
                            </button>
                            <button
                              type="button"
                              disabled={directoryPage === directoryPageCount}
                              onClick={() => setDirectoryPage((page) => Math.min(directoryPageCount, page + 1))}
                              className="rounded-xl bg-[#082f49] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0d5078] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}

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
                            .replace("announcements", "Tools")
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
