import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ROLE_KEY;
const staffAccessPassword = process.env.STAFF_ACCESS_PASSWORD;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ROLE_KEY) before running this migration.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as any },
});

type AppUser = {
  phone: string | null;
  email: string | null;
  mmc: string | null;
  nama: string | null;
  role: string | null;
};

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+60${digits.slice(1)}`;
  return `+${digits}`;
}

function isValidEmail(value: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

function authPassword(mmc: string): string {
  // Supabase Auth requires at least six characters. Keep the user's MMC as
  // the visible credential and add a leading zero only for five-digit MMCs.
  return mmc.length === 5 ? `0${mmc}` : mmc;
}

function extractMmcCode(value: string | null): string {
  return (value || "").split("|")[0].trim();
}

const { data: rows, error: rowsError } = await admin
  .from("users")
  .select("phone,email,mmc,nama,role");

if (rowsError) throw rowsError;

const { data: existing, error: existingError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (existingError) throw existingError;

const existingUsers = (existing?.users || []) as any[];
const byEmail = new Map(
  existingUsers
    .filter((user) => user.email)
    .map((user) => [user.email!.trim().toLowerCase(), user]),
);
const byPhone = new Map(
  existingUsers
    .filter((user) => user.phone)
    .map((user) => [normalizePhone(user.phone!), user]),
);

// Some legacy profiles contain placeholder/shared emails such as
// `example@gmail.com`. Auth emails must be unique, so only use a profile
// email when it belongs to exactly one public profile. Duplicate emails get
// a stable per-phone identity instead; the public profile email is preserved.
const emailUseCounts = new Map<string, number>();
for (const row of (rows || []) as AppUser[]) {
  const email = row.email?.trim().toLowerCase() || "";
  if (isValidEmail(email)) emailUseCounts.set(email, (emailUseCounts.get(email) || 0) + 1);
}

let created = 0;
let updated = 0;
let skipped = 0;
let failed = 0;
const adminInitialPassword = (process.env.ADMIN_INITIAL_PASSWORD || "").trim();

for (const row of (rows || []) as AppUser[]) {
  try {
    const phone = row.phone?.trim() || "";
    const email = row.email?.trim().toLowerCase() || "";
    const mmc = extractMmcCode(row.mmc);
    const isAdmin = (row.role || "").trim().toLowerCase() === "admin";
    const isStaff = (row.role || "").trim().toLowerCase() === "staff";
    const password = isAdmin
      ? adminInitialPassword
      : isStaff
        ? staffAccessPassword || ""
        : mmc
          ? authPassword(mmc)
          : "";

    if (!phone || (isAdmin && !adminInitialPassword) || (isStaff && !staffAccessPassword) || (!isAdmin && !isStaff && !/^\d{5,6}$/.test(mmc))) {
      skipped += 1;
      console.log(
        `SKIP ${phone || "<no phone>"}: MMC must be 5 or 6 digits unless role is Admin or Staff`,
      );
      continue;
    }

    const authPhone = normalizePhone(phone);
    const authEmail = isValidEmail(email) && emailUseCounts.get(email) === 1
      ? email
      : `user-${phone.replace(/\D/g, "")}@auth.aralocum.local`;
    const existingByEmail = byEmail.get(authEmail);
    const existingByPhone = byPhone.get(authPhone);
    // Some legacy Admin rows contain the same phone as a Doctor but with a
    // 60... prefix instead of 01... . Do not merge those profiles into one
    // Auth account. An exact email match remains the strongest identity link.
    const existingUser = existingByEmail ||
      (existingByPhone &&
      String(existingByPhone.user_metadata?.phone || "").trim() === phone
        ? existingByPhone
        : undefined);
    const userMetadata = {
      phone,
      name: row.nama || "",
      role: row.role || "Doctor",
      mmc,
    };

    if (existingUser) {
      const canUpdatePhone =
        !existingByPhone || existingByPhone.id === existingUser.id;
      const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        ...(canUpdatePhone ? { phone: authPhone, phone_confirm: true } : {}),
        user_metadata: { ...existingUser.user_metadata, ...userMetadata },
      });
      if (error) throw error;
      updated += 1;
      console.log(`UPDATED ${phone}`);
      continue;
    }

    const canAttachPhone = !existingByPhone || existingByPhone.id === existingUser?.id;
    const payload = {
      email: authEmail,
      password,
      email_confirm: true,
      ...(canAttachPhone ? { phone: authPhone, phone_confirm: true } : {}),
      user_metadata: userMetadata,
    };

    const { data: createdUser, error } = await admin.auth.admin.createUser(payload);
    if (error) throw error;
    if (createdUser.user.email) byEmail.set(createdUser.user.email.toLowerCase(), createdUser.user);
    if (createdUser.user.phone) byPhone.set(normalizePhone(createdUser.user.phone), createdUser.user);
    created += 1;
    console.log(`CREATED ${phone}`);
  } catch (error: any) {
    failed += 1;
    console.error(`FAILED ${row.phone || "<no phone>"}: ${error?.message || error}`);
  }
}

console.log(`Migration complete: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed.`);
