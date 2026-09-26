import { createClient } from "@supabase/supabase-js";

type ProvisionBody = {
  phone?: string;
  name?: string;
  role?: "Doctor" | "Admin" | "Staff";
  email?: string;
  mmc?: string;
  initialPassword?: string;
};

function extractMmc(value: string): string {
  return (value || "").split("|")[0].trim();
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+60${digits.slice(1)}`;
  return `+${digits}`;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !serviceRoleKey || !anonKey) {
    res.status(500).json({ error: "Supabase server configuration is incomplete." });
    return;
  }

  const authorization = String(req.headers?.authorization || "");
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!accessToken) {
    res.status(401).json({ error: "You must be signed in as an admin." });
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await publicClient.auth.getUser(
    accessToken,
  );
  if (callerError || !callerData.user) {
    res.status(401).json({ error: "Your login session has expired." });
    return;
  }

  const caller = callerData.user;
  const callerPhone = String(caller.user_metadata?.phone || "").trim();
  const callerEmail = String(caller.email || "").trim().toLowerCase();
  const { data: callerProfiles } = await admin
    .from("users")
    .select("phone,role,email")
    .or(
      [
        callerPhone ? `phone.eq.${callerPhone}` : "",
        callerEmail ? `email.eq.${callerEmail}` : "",
      ]
        .filter(Boolean)
        .join(","),
    )
    .limit(1);
  const callerRole = callerProfiles?.[0]?.role || caller.user_metadata?.role;
  if (callerRole !== "Admin") {
    res.status(403).json({ error: "Only an Admin can create accounts." });
    return;
  }

  const body = (req.body || {}) as ProvisionBody;
  const phone = String(body.phone || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = body.role || "Doctor";
  const mmc = extractMmc(String(body.mmc || ""));
  const initialPassword = String(body.initialPassword || "").trim();

  if (!phone || !name) {
    res.status(400).json({ error: "Name and phone number are required." });
    return;
  }
  if (email && !validEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (initialPassword.length < 6 && !/^\d{5,6}$/.test(mmc)) {
    res.status(400).json({
      error: "An initial password of at least 6 characters is required when there is no 5/6 digit MMC.",
    });
    return;
  }

  const password = /^\d{5,6}$/.test(mmc)
    ? mmc.length === 5
      ? `0${mmc}`
      : mmc
    : initialPassword;
  const authPhone = normalizePhone(phone);
  const authEmail = email || `user-${phone.replace(/\D/g, "")}@auth.aralocum.local`;
  const userMetadata = { phone, name, role, mmc };

  const { data: existingByEmail } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existing = (existingByEmail?.users || []).find(
    (user) =>
      user.email?.toLowerCase() === authEmail ||
      user.phone === authPhone ||
      user.user_metadata?.phone === phone,
  );

  const authResult = existing
    ? await admin.auth.admin.updateUserById(existing.id, {
        password,
        phone: authPhone,
        phone_confirm: true,
        user_metadata: { ...existing.user_metadata, ...userMetadata },
      })
    : await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        phone: authPhone,
        phone_confirm: true,
        user_metadata: userMetadata,
      });

  if (authResult.error) {
    res.status(400).json({ error: authResult.error.message });
    return;
  }

  res.status(200).json({
    ok: true,
    created: !existing,
    authEmail,
    loginPhone: phone,
    passwordType: /^\d{5,6}$/.test(mmc) ? "mmc" : "initial",
  });
}
