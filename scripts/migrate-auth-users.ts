import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ROLE_KEY;

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

let created = 0;
let updated = 0;
let skipped = 0;
let failed = 0;

for (const row of (rows || []) as AppUser[]) {
  try {
    const phone = row.phone?.trim() || "";
    const email = row.email?.trim().toLowerCase() || "";
    const mmc = extractMmcCode(row.mmc);
    const isAdmin = (row.role || "").trim().toLowerCase() === "admin";
    const password = isAdmin
      ? "klinikARA2026"
      : mmc
        ? authPassword(mmc)
        : "";

    if (!phone || (!isAdmin && !/^\d{5,6}$/.test(mmc))) {
      skipped += 1;
      console.log(
        `SKIP ${phone || "<no phone>"}: MMC must be 5 or 6 digits unless role is Admin`,
      );
      continue;
    }

    const authPhone = normalizePhone(phone);
    const existingUser =
      (isValidEmail(email) ? byEmail.get(email) : undefined) || byPhone.get(authPhone);
    const userMetadata = {
      phone,
      name: row.nama || "",
      role: row.role || "Doctor",
      mmc,
    };

    if (existingUser) {
      const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        ...(authPhone ? { phone: authPhone, phone_confirm: true } : {}),
        user_metadata: { ...existingUser.user_metadata, ...userMetadata },
      });
      if (error) throw error;
      updated += 1;
      console.log(`UPDATED ${phone}`);
      continue;
    }

    const authEmail = isValidEmail(email)
      ? email
      : `user-${phone.replace(/\D/g, "")}@auth.aralocum.local`;
    const payload = {
      email: authEmail,
      password,
      email_confirm: true,
      phone: authPhone,
      phone_confirm: true,
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
