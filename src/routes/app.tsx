import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { me, logout } from "@/server/auth.functions";
import {
  createChannel,
  createCategory,
  createInvite,
  getWorkspace,
  listInvites,
  listMessages,
  sendMessage,
} from "@/server/workspace.functions";
import {
  decryptMessage,
  encryptMessage,
  loadOrgKey,
  saveOrgKey,
  clearOrgKey,
} from "@/lib/crypto";
import { supabase } from "@/integrations/supabase/client";
import { SharedStyles } from "./superuser";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Workspace — Onion" }] }),
  loader: async () => {
    const m = await me();
    if (!m.authenticated) throw redirect({ to: "/login" });
    return m;
  },
  component: AppShell,
});

type Msg = {
  id: string;
  ciphertext: string;
  iv: string;
  member_id: string;
  author: string;
  created_at: string;
  plaintext?: string;
};

function AppShell() {
  const data = Route.useLoaderData();
  const member = data.authenticated ? data.member : null;
  const org = data.authenticated ? data.org : null;
  const nav = useNavigate();
  const logoutFn = useServerFn(logout);

  const wsFn = useServerFn(getWorkspace);
  const [ws, setWs] = useState<{
    categories: { id: string; name: string }[];
    channels: { id: string; name: string; category_id: string | null }[];
    members: { id: string; display_name: string; role: string }[];
  } | null>(null);
  const [activeChannelId, setActive] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [keyModal, setKeyModal] = useState(false);
  const [orgKey, setOrgKey] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    setOrgKey(loadOrgKey(org.id));
    if (!loadOrgKey(org.id)) setKeyModal(true);
  }, [org]);

  async function refreshWs() {
    const r = await wsFn();
    setWs(r);
    if (!activeChannelId && r.channels[0]) setActive(r.channels[0].id);
  }
  useEffect(() => {
    refreshWs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!member || !org) return null;

  return (
    <div className="h-screen w-screen bg-background text-foreground flex font-sans overflow-hidden">
      {/* Left rail */}
      <aside className="w-64 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <div className="font-mono text-[10px] tracking-[0.4em] text-muted-foreground">
            ORGANIZATION
          </div>
          <div className="mt-1 text-sm font-medium truncate">{org.name}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${orgKey ? "bg-success" : "bg-destructive"}`} />
            {orgKey ? "encrypted · key loaded" : "encryption key not set"}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2">
          {ws?.categories.length === 0 && ws?.channels.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground font-mono">
              no channels yet
            </div>
          )}

          {ws?.categories.map((cat) => {
            const chans = ws.channels.filter((c) => c.category_id === cat.id);
            return (
              <div key={cat.id} className="mb-4">
                <div className="px-3 py-1 font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
                  {cat.name}
                </div>
                {chans.map((c) => (
                  <ChannelButton
                    key={c.id}
                    name={c.name}
                    active={activeChannelId === c.id}
                    onClick={() => setActive(c.id)}
                  />
                ))}
              </div>
            );
          })}

          {/* Uncategorized */}
          {(() => {
            const uncats = ws?.channels.filter((c) => !c.category_id) ?? [];
            if (uncats.length === 0) return null;
            return (
              <div className="mb-4">
                <div className="px-3 py-1 font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
                  CHANNELS
                </div>
                {uncats.map((c) => (
                  <ChannelButton
                    key={c.id}
                    name={c.name}
                    active={activeChannelId === c.id}
                    onClick={() => setActive(c.id)}
                  />
                ))}
              </div>
            );
          })()}

          {member.role === "admin" && (
            <button
              onClick={() => setShowSettings(true)}
              className="mt-4 w-full text-left px-3 py-2 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground"
            >
              + manage workspace
            </button>
          )}
        </div>

        <div className="border-t border-border p-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{member.displayName}</div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              {member.role}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              title="Re-enter encryption key"
              onClick={() => setKeyModal(true)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              KEY
            </button>
            <button
              title="Sign out"
              onClick={async () => {
                await logoutFn();
                if (org) clearOrgKey(org.id);
                nav({ to: "/" });
              }}
              className="text-[10px] font-mono text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {activeChannelId && ws ? (
          <ChannelView
            channel={ws.channels.find((c) => c.id === activeChannelId)!}
            orgId={org.id}
            orgKey={orgKey}
            currentMemberId={member.memberId}
            onMissingKey={() => setKeyModal(true)}
          />
        ) : (
          <EmptyState />
        )}
      </main>

      {/* Members rail */}
      <aside className="w-56 shrink-0 border-l border-border bg-surface hidden lg:flex flex-col">
        <div className="px-4 py-3 border-b border-border font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
          MEMBERS · {ws?.members.length ?? 0}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {ws?.members.map((m) => (
            <div
              key={m.id}
              className="px-4 py-1.5 flex items-center gap-2 text-sm hover:bg-surface-2"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="truncate">{m.display_name}</span>
              {m.role !== "user" && (
                <span className="ml-auto font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
                  {m.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </aside>

      {keyModal && org && (
        <KeyModal
          orgId={org.id}
          onSet={(k) => {
            saveOrgKey(org.id, k);
            setOrgKey(k);
            setKeyModal(false);
          }}
          onClose={() => setKeyModal(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            refreshWs();
          }}
        />
      )}
      <SharedStyles />
    </div>
  );
}

function ChannelButton({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
        active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="text-muted-foreground">#</span>
      <span className="truncate">{name}</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-center">
      <div className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
        select a channel
      </div>
    </div>
  );
}

function ChannelView({
  channel,
  orgId,
  orgKey,
  currentMemberId,
  onMissingKey,
}: {
  channel: { id: string; name: string };
  orgId: string;
  orgKey: string | null;
  currentMemberId: string;
  onMissingKey: () => void;
}) {
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  async function decryptAll(rows: Msg[]) {
    if (!orgKey) return rows;
    return Promise.all(
      rows.map(async (m) => ({
        ...m,
        plaintext: await decryptMessage(m.ciphertext, m.iv, orgKey, orgId),
      })),
    );
  }

  async function load() {
    const rows = (await listFn({ data: { channelId: channel.id } })) as Msg[];
    const dec = await decryptAll(rows);
    setMsgs(dec);
    queueMicrotask(() => scrollRef.current?.scrollTo({ top: 9e9 }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, orgKey]);

  // Realtime subscription on this channel's messages
  useEffect(() => {
    const ch = supabase
      .channel(`messages:${channel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channel.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            ciphertext: string;
            iv: string;
            member_id: string;
            created_at: string;
          };
          // We don't get author name from realtime payload; refetch tail.
          await load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, orgKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    if (!orgKey) {
      onMissingKey();
      return;
    }
    try {
      const { ciphertext, iv } = await encryptMessage(input.trim(), orgKey, orgId);
      await sendFn({ data: { channelId: channel.id, ciphertext, iv } });
      setInput("");
      // realtime will refresh; also force load for snappiness
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <div className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-muted-foreground">#</span>
          <span className="font-medium">{channel.name}</span>
          <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
            E2E · AES-256-GCM
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {msgs.length === 0 && (
          <div className="text-center font-mono text-xs text-muted-foreground tracking-widest uppercase py-12">
            channel is empty
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className="group flex gap-3">
            <div className="h-8 w-8 shrink-0 border border-border-strong flex items-center justify-center font-mono text-[10px] uppercase">
              {m.author?.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{m.author}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-0.5">
                {m.plaintext ?? <span className="text-muted-foreground italic">🔒 encrypted</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-border p-4">
        <div className="hairline-strong flex items-center bg-surface">
          <span className="px-3 text-muted-foreground font-mono text-xs">›</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={orgKey ? `message #${channel.name} (encrypted)` : "set encryption key to send"}
            disabled={!orgKey}
            className="flex-1 bg-transparent py-3 pr-3 outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
          />
        </div>
      </form>
    </>
  );
}

function KeyModal({
  orgId,
  onSet,
  onClose,
}: {
  orgId: string;
  onSet: (k: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md hairline-strong bg-surface">
        <div className="border-b border-border px-4 py-2 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          $ encryption.key.set
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter the shared passphrase for this organization. It is used to derive an AES-256 key
            in your browser. The server never sees this value.
          </p>
          <input
            type="password"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="term-input"
            placeholder="organization passphrase"
          />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 hairline px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground">
              skip
            </button>
            <button
              disabled={!val}
              onClick={() => onSet(val)}
              className="btn-primary flex-1 disabled:opacity-40"
            >
              set key
            </button>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            Tip: every member of this org must enter the same passphrase to read messages.
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const createChan = useServerFn(createChannel);
  const createCat = useServerFn(createCategory);
  const mintInvite = useServerFn(createInvite);
  const listInv = useServerFn(listInvites);

  const [chanName, setChanName] = useState("");
  const [catName, setCatName] = useState("");
  const [role, setRole] = useState<"admin" | "moderator" | "user">("user");
  const [invites, setInvites] = useState<{ code: string; role: string; used: boolean }[]>([]);

  async function refresh() {
    setInvites(await listInv());
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto hairline-strong bg-surface">
        <div className="sticky top-0 bg-surface border-b border-border px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            $ workspace.settings
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        <div className="p-5 space-y-8">
          <section>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
              create category
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!catName.trim()) return;
                try {
                  await createCat({ data: { name: catName.trim() } });
                  setCatName("");
                  toast.success("Category created");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <input
                className="term-input flex-1"
                placeholder="GENERAL"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
              <button className="btn-primary">add</button>
            </form>
          </section>

          <section>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
              create channel
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!chanName.trim()) return;
                try {
                  await createChan({ data: { name: chanName.trim().toLowerCase() } });
                  setChanName("");
                  toast.success("Channel created");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <input
                className="term-input flex-1"
                placeholder="ops"
                value={chanName}
                onChange={(e) => setChanName(e.target.value)}
              />
              <button className="btn-primary">add</button>
            </form>
          </section>

          <section>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
              mint invite
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await mintInvite({ data: { role } });
                  refresh();
                  toast.success("Invite minted");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="term-input"
              >
                <option value="user">user</option>
                <option value="moderator">moderator</option>
                <option value="admin">admin</option>
              </select>
              <button className="btn-primary flex-1">mint</button>
            </form>
            <div className="mt-3 space-y-2 font-mono text-xs">
              {invites.map((i) => (
                <div key={i.code} className="hairline px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-foreground select-all">{i.code}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
                      {i.role}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] tracking-widest uppercase ${
                      i.used ? "text-muted-foreground" : "text-success"
                    }`}
                  >
                    {i.used ? "used" : "active"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
