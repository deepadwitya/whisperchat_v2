// Server-only helpers for the anonymous token-based auth model.
import { createHash, randomBytes } from "crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SESSION_COOKIE = "app_session";
export const SUPER_COOKIE = "super_session";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function generateToken(bytes = 24): string {
  // URL-safe base64 (no padding)
  return randomBytes(bytes).toString("base64url");
}

export function setAppSession(token: string) {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function clearAppSession() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export function setSuperSession(token: string) {
  setCookie(SUPER_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}
export function clearSuperSession() {
  deleteCookie(SUPER_COOKIE, { path: "/" });
}

export type MemberContext = {
  memberId: string;
  orgId: string;
  role: "admin" | "moderator" | "user";
  displayName: string;
};

export async function getCurrentMember(): Promise<MemberContext | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = sha256(token);
  const { data: sess } = await supabaseAdmin
    .from("session_tokens")
    .select("id, member_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!sess) return null;

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, org_id, role, display_name")
    .eq("id", sess.member_id)
    .maybeSingle();
  if (!member) return null;

  // best-effort touch
  await supabaseAdmin
    .from("session_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", sess.id);

  return {
    memberId: member.id,
    orgId: member.org_id,
    role: member.role as MemberContext["role"],
    displayName: member.display_name,
  };
}

export async function requireMember(): Promise<MemberContext> {
  const m = await getCurrentMember();
  if (!m) throw new Error("UNAUTHENTICATED");
  return m;
}

export async function requireAdmin(): Promise<MemberContext> {
  const m = await requireMember();
  if (m.role !== "admin") throw new Error("FORBIDDEN");
  return m;
}

export async function getCurrentSuperuser(): Promise<boolean> {
  const token = getCookie(SUPER_COOKIE);
  if (!token) return false;
  const { data } = await supabaseAdmin
    .from("superuser")
    .select("token_hash")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return false;
  return sha256(token) === data.token_hash;
}
