import { getFreshSupabaseSession, getSupabaseClient } from "./supabaseClient";

export async function provisionAuthUser(input: {
  phone: string;
  name: string;
  role: "Doctor" | "Admin" | "Staff";
  email?: string;
  mmc?: string;
  initialPassword: string;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Authentication service is unavailable.");

  const session = await getFreshSupabaseSession();
  const accessToken = session.access_token;

  const response = await fetch("/api/provision-auth-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Failed to create the authentication account.");
  }
}
