import { LocumSlot, UserProfile, FeedbackRecord, NewApplication, Announcement } from './types';

export const INITIAL_USERS: UserProfile[] = [
  {
    phone: "0123456789",
    name: "Dr. Atikah Abd Rahman",
    role: "Doctor",
    email: "atikah.abdrahman@gmail.com",
    mmc: "54321",
    apc: "https://drive.google.com/file/d/1apc_atikah/view",
    indemnity: "Ada | https://drive.google.com/file/d/1indem_atikah/view",
    workplace: "Hospital Selayang",
    points: 120,
    badges: "Team Favorite:2, Heart Winner:3, Iron Doctor:1, The Unstoppable:1",
    locks: "[SLOT105][SLOT108]"
  },
  {
    phone: "0172345678",
    name: "Dr. Syafiq Yazid",
    role: "Doctor",
    email: "syafiq@gmail.com",
    mmc: "65432",
    apc: "yes",
    indemnity: "Ada",
    workplace: "Klinik Kesihatan Kajang",
    points: 85,
    badges: "Heart Winner:2, Last Minute Savior:2, The Diligent Doc:1",
    locks: "[SLOT101]"
  },
  {
    phone: "0133456789",
    name: "Dr. Nurul Shuhada",
    role: "Doctor",
    email: "shuhada.nurul@gmail.com",
    mmc: "76543",
    apc: "yes",
    indemnity: "Tiada",
    workplace: "Hospital Serdang",
    points: 40,
    badges: "The Diligent Doc:2, Iron Doctor:1",
    locks: ""
  },
  {
    phone: "0185554433",
    name: "Dr. Calvin Wong",
    role: "Doctor",
    email: "calvin.wong@outlook.com",
    mmc: "87654",
    apc: "yes",
    indemnity: "Ada",
    workplace: "PPUM",
    points: 110,
    badges: "Team Favorite:3, Iron Doctor:2, The Unstoppable:2",
    locks: ""
  },
  {
    phone: "0198765432",
    name: "Admin (HQ Operations)",
    role: "Admin",
    email: "operation@hsohealthcare.com",
    mmc: "",
    apc: "",
    indemnity: "",
    points: 0,
    badges: ""
  },
  {
    phone: "0112233445",
    name: "Staff (Klinik ARA Kajang)",
    role: "Staff",
    email: "kajang@klinikara.com",
    mmc: "",
    apc: "",
    indemnity: "",
    points: 0,
    badges: ""
  }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-1",
    text: "ALERt: All locums on shift after 11 PM must lock the main entrance glass door. Patient entry is strictly via the night door chime.",
    date: "12/06/2026"
  },
  {
    id: "ann-2",
    text: "NEW INCENTIVE SCHEME:\n- Marathon 12-hour shifts: Extra RM 50 bonus.\n- Sunday Short hours: RM 45/h Cash pocket payment option available at desk.",
    date: "14/06/2026"
  }
];

export const INITIAL_FEEDBACKS_PATIENT: FeedbackRecord[] = [
  {
    tarikh: "08/06/2026",
    nama: "Roslan bin Ahmad",
    reviewer: "Roslan bin Ahmad",
    target: "Dr. Atikah Abd Rahman",
    rating: 5,
    komen: "Dr Atikah sangat lemah lembut ketika merawat anak saya yang demam. Penerangan ubat yang sangat jelas!"
  },
  {
    tarikh: "10/06/2026",
    nama: "Sarah Lim",
    reviewer: "Sarah Lim",
    target: "Dr. Syafiq Yazid",
    rating: 4.8,
    komen: "Sangat pantas dan profesional. Klinik bersih, doktor juga mesra."
  },
  {
    tarikh: "11/06/2026",
    nama: "Thinesh Kumar",
    reviewer: "Thinesh Kumar",
    target: "Dr. Atikah Abd Rahman",
    rating: 5,
    komen: "Highly recommended lock clinic. Dr Atikah was very passionate and did an amazing assessment on my chest pain."
  },
  {
    tarikh: "13/06/2026",
    nama: "Farah Diana",
    reviewer: "Farah Diana",
    target: "Dr. Calvin Wong",
    rating: 5,
    komen: "Best doctor! Sangat memahami pesakit warga emas."
  }
];

export const INITIAL_FEEDBACKS_STAFF: FeedbackRecord[] = [
  {
    tarikh: "05/06/2026",
    nama: "Staff Sarah (SK)",
    reviewer: "Staff Sarah (SK)",
    target: "Dr. Atikah Abd Rahman",
    rating: 5,
    komen: "Dr Atikah sangat rajin membantu ketika keadaan klinik sesak (peak hours). Sangat disenangi staf!"
  },
  {
    tarikh: "10/06/2026",
    nama: "Staff Aina (KJ)",
    reviewer: "Staff Aina (KJ)",
    target: "Dr. Calvin Wong",
    rating: 5,
    komen: "Doctor arrived 10 minutes early, always smiling and managed the queue efficiently."
  }
];

export const INITIAL_FEEDBACKS_LOCUM: FeedbackRecord[] = [
  {
    tarikh: "02/06/2026",
    nama: "Dr. Atikah Abd Rahman",
    reviewer: "Dr. Atikah Abd Rahman",
    target: "Klinik ARA Kajang",
    rating: 5,
    komen: "Ubat-ubatan sangat lengkap. Staf nurse sangat cekap mendaftarkan pesakit dan membuat check-up awal."
  },
  {
    tarikh: "07/06/2026",
    nama: "Dr. Syafiq Yazid",
    reviewer: "Dr. Syafiq Yazid",
    target: "Klinik ARA Seri Kembangan",
    rating: 4,
    komen: "Sistem dispenser ubat baru agak lambat pada mulanya tetapi mesra pengguna."
  }
];

export const INITIAL_NEW_APPLICATIONS: NewApplication[] = [
  {
    timestamp: "14/06/2026 15:45:10",
    nama: "Dr. Aaron Fernandez",
    phone: "0165551212",
    mmc: "93821",
    apc: "https://drive.google.com/file/d/apc_aaron/view",
    ins: "https://drive.google.com/file/d/ins_aaron/view",
    cvUrl: "https://drive.google.com/file/d/cv_aaron/view",
    skills: "Laceration Suturing, Peads Intubation, Ultrasound Assessment"
  },
  {
    timestamp: "14/06/2026 18:22:15",
    nama: "Dr. Siti Aminah",
    phone: "0123344556",
    mmc: "82736",
    apc: "https://drive.google.com/file/d/apc_aminah/view",
    ins: "https://drive.google.com/file/d/ins_aminah/view",
    cvUrl: "https://drive.google.com/file/d/cv_aminah/view",
    skills: "Primary Care Pediatrics, Chronic Disease Counselling"
  }
];

// Helper to generate date string relative to current date (2026-06-14)
export function getInitialSlots(): LocumSlot[] {
  return [
    // Past Slots in May (History) - All Approved and Completed with PTS & Sales
    {
      id: "SLOT101",
      tarikh: "15/05/2026",
      masa: "8am-8pm",
      cawangan: "Seri Kembangan",
      status: "Approved",
      dr: "Dr. Atikah Abd Rahman",
      phone: "0123456789",
      gaji: 540,
      sales: 2450,
      pesakit: 45,
      bookedAt: "10/05/2026 09:00:00"
    },
    {
      id: "SLOT102",
      tarikh: "18/05/2026",
      masa: "6pm-11pm",
      cawangan: "Kajang",
      status: "Approved",
      dr: "Dr. Syafiq Yazid",
      phone: "0172345678",
      gaji: 250,
      sales: 1200,
      pesakit: 22,
      bookedAt: "15/05/2026 14:30:00"
    },
    {
      id: "SLOT103",
      tarikh: "20/05/2026",
      masa: "11pm-8am",
      cawangan: "Seri Kembangan",
      status: "Approved",
      dr: "Dr. Atikah Abd Rahman",
      phone: "0123456789",
      gaji: 350,
      sales: 1850,
      pesakit: 14,
      bookedAt: "19/05/2026 23:45:00"
    },
    {
      id: "SLOT104",
      tarikh: "25/05/2026",
      masa: "8am-8pm",
      cawangan: "Kajang",
      status: "Approved",
      dr: "Dr. Calvin Wong",
      phone: "0185554433",
      gaji: 540,
      sales: 3100,
      pesakit: 52,
      bookedAt: "20/05/2026 10:15:00"
    },
    // June 2026 Slots (Current Month)
    {
      id: "SLOT105",
      tarikh: "01/06/2026",
      masa: "8am-6pm",
      cawangan: "Seri Kembangan",
      status: "Approved",
      dr: "Dr. Atikah Abd Rahman",
      phone: "0123456789",
      gaji: 450,
      sales: 2100,
      pesakit: 38,
      bookedAt: "28/05/2026 09:30:12"
    },
    {
      id: "SLOT106",
      tarikh: "05/06/2026",
      masa: "6pm-10pm",
      cawangan: "Kajang",
      status: "Approved",
      dr: "Dr. Nurul Shuhada",
      phone: "0133456789",
      gaji: 180,
      sales: 950,
      pesakit: 18,
      bookedAt: "04/06/2026 12:11:00"
    },
    {
      id: "SLOT107",
      tarikh: "10/06/2026",
      masa: "8pm-10pm",
      cawangan: "Seri Kembangan",
      status: "Approved",
      dr: "Dr. Calvin Wong",
      phone: "0185554433",
      gaji: 120,
      sales: 550,
      pesakit: 8,
      bookedAt: "09/06/2026 17:50:00"
    },
    // Active Booking Request (Pending approvals) in mid June (around today, 14th June)
    {
      id: "SLOT108",
      tarikh: "16/06/2026",
      masa: "6pm-11pm",
      cawangan: "Seri Kembangan",
      status: "Pending",
      dr: "Dr. Atikah Abd Rahman",
      phone: "0123456789",
      gaji: 250,
      bookedAt: "14/06/2026 19:40:00"
    },
    {
      id: "SLOT109",
      tarikh: "17/06/2026",
      masa: "8am-8pm",
      cawangan: "Kajang",
      status: "Pending",
      dr: "Dr. Syafiq Yazid",
      phone: "0172345678",
      gaji: 540,
      bookedAt: "13/06/2026 10:20:00"
    },
    {
      id: "SLOT110",
      tarikh: "18/06/2026",
      masa: "8pm-10pm",
      cawangan: "Seri Kembangan",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 120
    },
    {
      id: "SLOT111",
      tarikh: "20/06/2026",
      masa: "11pm-8am",
      cawangan: "Kajang",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 300
    },
    {
      id: "SLOT112",
      tarikh: "22/06/2026",
      masa: "6pm-10pm",
      cawangan: "Seri Kembangan",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 180
    },
    {
      id: "SLOT113",
      tarikh: "24/06/2026",
      masa: "8am-6pm",
      cawangan: "Kajang",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 450
    },
    {
      id: "SLOT114",
      tarikh: "25/06/2026",
      masa: "8am-8pm",
      cawangan: "Seri Kembangan",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 540
    },
    // July 2026 Slots (Upcoming Month)
    {
      id: "SLOT201",
      tarikh: "01/07/2026",
      masa: "8am-6pm",
      cawangan: "Seri Kembangan",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 450
    },
    {
      id: "SLOT202",
      tarikh: "02/07/2026",
      masa: "6pm-10pm",
      cawangan: "Kajang",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 180
    },
    {
      id: "SLOT203",
      tarikh: "05/07/2026",
      masa: "11pm-8am",
      cawangan: "Seri Kembangan",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 300
    },
    {
      id: "SLOT204",
      tarikh: "08/07/2026",
      masa: "8pm-10pm",
      cawangan: "Kajang",
      status: "Available",
      dr: "",
      phone: "",
      gaji: 120
    }
  ];
}
