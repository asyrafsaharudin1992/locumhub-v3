import { getFreshSupabaseSession, getSupabaseClient } from "./supabaseClient";

export async function resetAuthUserPassword(phone: string, newPassword: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Authentication service is unavailable.");
  const session = await getFreshSupabaseSession();
  const accessToken = session.access_token;
  const response = await fetch("/api/reset-auth-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ phone, newPassword }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Failed to reset Auth password.");
}
