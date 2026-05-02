import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateToken, requireAdmin, requireMember, sha256 } from "./auth.server";

// Channel + category list for current member's org
export const getWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const m = await requireMember();
  const [{ data: cats }, { data: chans }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from("categories")
      .select("id, name, position")
      .eq("org_id", m.orgId)
      .order("position"),
    supabaseAdmin
      .from("channels")
      .select("id, name, category_id, position")
      .eq("org_id", m.orgId)
      .order("position"),
    supabaseAdmin
      .from("members")
      .select("id, display_name, role")
      .eq("org_id", m.orgId)
      .order("created_at"),
  ]);
  return {
    categories: cats ?? [],
    channels: chans ?? [],
    members: members ?? [],
  };
});

export const createChannel = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(32)
        .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes only"),
      categoryId: z.string().uuid().nullable().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const m = await requireAdmin();
    const { data: row, error } = await supabaseAdmin
      .from("channels")
      .insert({ org_id: m.orgId, name: data.name, category_id: data.categoryId ?? null })
      .select()
      .single();
    if (error) throw error;
    await supabaseAdmin.from("audit_logs").insert({
      org_id: m.orgId,
      actor: m.displayName,
      action: "channel.created",
      detail: { name: row.name },
    });
    return row;
  });

export const createCategory = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().trim().min(1).max(32) }).parse)
  .handler(async ({ data }) => {
    const m = await requireAdmin();
    const { data: row, error } = await supabaseAdmin
      .from("categories")
      .insert({ org_id: m.orgId, name: data.name.toUpperCase() })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const createInvite = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ role: z.enum(["admin", "moderator", "user"]).default("user") }).parse,
  )
  .handler(async ({ data }) => {
    const m = await requireAdmin();
    const code = generateToken(10);
    const { data: row, error } = await supabaseAdmin
      .from("invite_codes")
      .insert({ org_id: m.orgId, code, role: data.role, created_by: m.memberId })
      .select()
      .single();
    if (error) throw error;
    return { code: row.code, role: row.role };
  });

export const listInvites = createServerFn({ method: "GET" }).handler(async () => {
  const m = await requireAdmin();
  const { data } = await supabaseAdmin
    .from("invite_codes")
    .select("code, role, used, created_at")
    .eq("org_id", m.orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
});

// ---------- Messages ----------

export const listMessages = createServerFn({ method: "POST" })
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const m = await requireMember();
    // Confirm channel belongs to member's org
    const { data: chan } = await supabaseAdmin
      .from("channels")
      .select("org_id")
      .eq("id", data.channelId)
      .maybeSingle();
    if (!chan || chan.org_id !== m.orgId) throw new Error("FORBIDDEN");

    const { data: msgs } = await supabaseAdmin
      .from("messages")
      .select("id, ciphertext, iv, member_id, created_at")
      .eq("channel_id", data.channelId)
      .order("created_at", { ascending: true })
      .limit(200);

    const memberIds = Array.from(new Set((msgs ?? []).map((x) => x.member_id)));
    const { data: members } = memberIds.length
      ? await supabaseAdmin.from("members").select("id, display_name").in("id", memberIds)
      : { data: [] as { id: string; display_name: string }[] };

    const nameMap = new Map(members?.map((x) => [x.id, x.display_name]));
    return (msgs ?? []).map((x) => ({
      ...x,
      author: nameMap.get(x.member_id) ?? "anon",
    }));
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      ciphertext: z.string().min(1).max(20000),
      iv: z.string().min(1).max(64),
    }).parse,
  )
  .handler(async ({ data }) => {
    const m = await requireMember();
    const { data: chan } = await supabaseAdmin
      .from("channels")
      .select("org_id")
      .eq("id", data.channelId)
      .maybeSingle();
    if (!chan || chan.org_id !== m.orgId) throw new Error("FORBIDDEN");

    const { data: row, error } = await supabaseAdmin
      .from("messages")
      .insert({
        channel_id: data.channelId,
        member_id: m.memberId,
        ciphertext: data.ciphertext,
        iv: data.iv,
      })
      .select()
      .single();
    if (error) throw error;
    return { id: row.id, created_at: row.created_at, author: m.displayName };
  });
