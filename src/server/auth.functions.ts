import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clearAppSession,
  clearSuperSession,
  generateToken,
  getCurrentMember,
  getCurrentSuperuser,
  setAppSession,
  setSuperSession,
  sha256,
} from "./auth.server";

// ---------- Superuser ----------

export const superuserLogin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ token: z.string().min(1).max(128), password: z.string().min(1).max(128) }).parse,
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin.from("superuser").select("*").eq("id", 1).single();
    if (!row) throw new Error("Superuser not initialized");
    if (sha256(data.token) !== row.token_hash || sha256(data.password) !== row.password_hash) {
      throw new Error("Invalid credentials");
    }
    setSuperSession(data.token);
    return { mustChange: row.must_change };
  });

export const superuserStatus = createServerFn({ method: "GET" }).handler(async () => {
  const ok = await getCurrentSuperuser();
  if (!ok) return { authenticated: false as const };
  const { data } = await supabaseAdmin.from("superuser").select("must_change").eq("id", 1).single();
  return { authenticated: true as const, mustChange: !!data?.must_change };
});

export const superuserLogout = createServerFn({ method: "POST" }).handler(async () => {
  clearSuperSession();
  return { ok: true };
});

export const superuserRotate = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ newToken: z.string().min(4).max(128), newPassword: z.string().min(4).max(128) })
      .parse,
  )
  .handler(async ({ data }) => {
    const ok = await getCurrentSuperuser();
    if (!ok) throw new Error("UNAUTHENTICATED");
    await supabaseAdmin
      .from("superuser")
      .update({
        token_hash: sha256(data.newToken),
        password_hash: sha256(data.newPassword),
        must_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSuperSession(data.newToken);
    return { ok: true };
  });

export const superuserMintMasterInvite = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orgName: z.string().trim().min(1).max(64) }).parse)
  .handler(async ({ data }) => {
    const ok = await getCurrentSuperuser();
    if (!ok) throw new Error("UNAUTHENTICATED");
    const code = generateToken(12);
    const { data: row, error } = await supabaseAdmin
      .from("master_invites")
      .insert({ code, org_name: data.orgName })
      .select()
      .single();
    if (error) throw error;
    return { code: row.code, orgName: row.org_name };
  });

export const superuserListInvites = createServerFn({ method: "GET" }).handler(async () => {
  const ok = await getCurrentSuperuser();
  if (!ok) throw new Error("UNAUTHENTICATED");
  const { data } = await supabaseAdmin
    .from("master_invites")
    .select("code, org_name, used, used_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return { invites: data ?? [], orgs: orgs ?? [] };
});

// ---------- Org bootstrap from master invite ----------

export const redeemMasterInvite = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().trim().min(1).max(128),
      adminName: z.string().trim().min(1).max(48),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("master_invites")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (!invite || invite.used) throw new Error("Invalid or used invite code");

    // Create org
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: invite.org_name })
      .select()
      .single();
    if (orgErr) throw orgErr;

    // First admin member
    const { data: member, error: memErr } = await supabaseAdmin
      .from("members")
      .insert({ org_id: org.id, display_name: data.adminName, role: "admin" })
      .select()
      .single();
    if (memErr) throw memErr;

    // Default category + #general channel
    const { data: cat } = await supabaseAdmin
      .from("categories")
      .insert({ org_id: org.id, name: "GENERAL" })
      .select()
      .single();
    await supabaseAdmin
      .from("channels")
      .insert({ org_id: org.id, category_id: cat?.id, name: "general" });

    // Mint session token
    const token = generateToken();
    await supabaseAdmin
      .from("session_tokens")
      .insert({ member_id: member.id, token_hash: sha256(token) });

    await supabaseAdmin
      .from("master_invites")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    await supabaseAdmin.from("audit_logs").insert({
      org_id: org.id,
      actor: member.display_name,
      action: "org.created",
      detail: { via: "master_invite" },
    });

    setAppSession(token);
    return { sessionToken: token, orgName: org.name, displayName: member.display_name };
  });

// ---------- Member token login / invite redeem ----------

export const loginWithToken = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(256) }).parse)
  .handler(async ({ data }) => {
    const { data: sess } = await supabaseAdmin
      .from("session_tokens")
      .select("id, member_id")
      .eq("token_hash", sha256(data.token))
      .maybeSingle();
    if (!sess) throw new Error("Invalid session token");
    setAppSession(data.token);
    return { ok: true };
  });

export const redeemOrgInvite = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().trim().min(1).max(128),
      displayName: z.string().trim().min(1).max(48),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("invite_codes")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (!invite || invite.used) throw new Error("Invalid or used invite code");

    const { data: member, error } = await supabaseAdmin
      .from("members")
      .insert({ org_id: invite.org_id, display_name: data.displayName, role: invite.role })
      .select()
      .single();
    if (error) throw error;

    const token = generateToken();
    await supabaseAdmin
      .from("session_tokens")
      .insert({ member_id: member.id, token_hash: sha256(token) });

    await supabaseAdmin
      .from("invite_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    await supabaseAdmin.from("audit_logs").insert({
      org_id: invite.org_id,
      actor: member.display_name,
      action: "member.joined",
      detail: { role: invite.role },
    });

    setAppSession(token);
    return { sessionToken: token, role: invite.role };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  clearAppSession();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const m = await getCurrentMember();
  if (!m) return { authenticated: false as const };
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .eq("id", m.orgId)
    .single();
  return {
    authenticated: true as const,
    member: m,
    org: org ?? { id: m.orgId, name: "Workspace" },
  };
});
