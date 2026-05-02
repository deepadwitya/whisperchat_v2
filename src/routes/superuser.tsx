import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  superuserLogin,
  superuserLogout,
  superuserMintMasterInvite,
  superuserRotate,
  superuserStatus,
  superuserListInvites,
} from "@/server/auth.functions";

export const Route = createFileRoute("/superuser")({
  head: () => ({
    meta: [{ title: "Superuser portal — Onion" }],
  }),
  component: SuperPortal,
});

type Phase = "loading" | "login" | "rotate" | "console";

function SuperPortal() {
  const [phase, setPhase] = useState<Phase>("loading");
  const statusFn = useServerFn(superuserStatus);
  const loginFn = useServerFn(superuserLogin);
  const rotateFn = useServerFn(superuserRotate);
  const logoutFn = useServerFn(superuserLogout);
  const mintFn = useServerFn(superuserMintMasterInvite);
  const listFn = useServerFn(superuserListInvites);

  const [token, setToken] = useState("0000");
  const [password, setPassword] = useState("0000");
  const [newToken, setNewToken] = useState("");
  const [newPass, setNewPass] = useState("");
  const [orgName, setOrgName] = useState("");
  const [data, setData] = useState<{
    invites: { code: string; org_name: string; used: boolean; created_at: string }[];
    orgs: { id: string; name: string; created_at: string }[];
  } | null>(null);

  async function refresh() {
    try {
      const s = await statusFn();
      if (!s.authenticated) {
        setPhase("login");
        return;
      }
      if (s.mustChange) {
        setPhase("rotate");
        return;
      }
      setPhase("console");
      setData(await listFn());
    } catch {
      setPhase("login");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      await loginFn({ data: { token, password } });
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onRotate(e: React.FormEvent) {
    e.preventDefault();
    if (newToken.length < 4 || newPass.length < 4) {
      toast.error("Token and password must be at least 4 characters.");
      return;
    }
    try {
      await rotateFn({ data: { newToken, newPassword: newPass } });
      toast.success("Credentials rotated.");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onMint(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    try {
      const r = await mintFn({ data: { orgName: orgName.trim() } });
      toast.success(`Master invite minted: ${r.code}`);
      setOrgName("");
      setData(await listFn());
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onLogout() {
    await logoutFn();
    setPhase("login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="font-mono text-xs tracking-[0.3em] text-muted-foreground hover:text-foreground">
            ← onion
          </Link>
          <div className="font-mono text-[10px] tracking-[0.4em] text-muted-foreground">
            ROOT · SUPERUSER PORTAL
          </div>
        </div>

        {phase === "loading" && (
          <div className="font-mono text-sm text-muted-foreground">verifying session…</div>
        )}

        {phase === "login" && (
          <Card title="root.authenticate">
            <p className="text-xs text-muted-foreground mb-6 font-mono">
              default: token <span className="text-foreground">0000</span> · password{" "}
              <span className="text-foreground">0000</span>
            </p>
            <form onSubmit={onLogin} className="space-y-4">
              <Field label="session token">
                <input
                  className="term-input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="password">
                <input
                  type="password"
                  className="term-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <button type="submit" className="btn-primary">authenticate →</button>
            </form>
          </Card>
        )}

        {phase === "rotate" && (
          <Card title="root.rotate_credentials">
            <p className="text-xs text-muted-foreground mb-6 font-mono">
              You must replace the default credentials before continuing.
            </p>
            <form onSubmit={onRotate} className="space-y-4">
              <Field label="new session token (≥ 4 chars)">
                <input className="term-input" value={newToken} onChange={(e) => setNewToken(e.target.value)} autoFocus />
              </Field>
              <Field label="new password (≥ 4 chars)">
                <input type="password" className="term-input" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              </Field>
              <button type="submit" className="btn-primary">rotate →</button>
            </form>
          </Card>
        )}

        {phase === "console" && data && (
          <div className="space-y-8">
            <Card title="organizations.create">
              <p className="text-xs text-muted-foreground mb-4 font-mono">
                Mint a one-time master invite. The recipient becomes the founding admin of a new
                isolated organization.
              </p>
              <form onSubmit={onMint} className="flex gap-2">
                <input
                  className="term-input flex-1"
                  placeholder="organization name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <button className="btn-primary whitespace-nowrap">mint invite</button>
              </form>
            </Card>

            <Card title="master_invites">
              <div className="space-y-2 font-mono text-xs">
                {data.invites.length === 0 && (
                  <div className="text-muted-foreground">no invites minted yet.</div>
                )}
                {data.invites.map((i) => (
                  <div
                    key={i.code}
                    className="flex items-center justify-between hairline px-3 py-2"
                  >
                    <div>
                      <div className="text-foreground">{i.code}</div>
                      <div className="text-muted-foreground text-[10px] mt-1">
                        → {i.org_name}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] tracking-widest uppercase ${
                        i.used ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {i.used ? "used" : "active"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="organizations.active">
              <div className="space-y-2 font-mono text-xs">
                {data.orgs.length === 0 && (
                  <div className="text-muted-foreground">no organizations yet.</div>
                )}
                {data.orgs.map((o) => (
                  <div key={o.id} className="hairline px-3 py-2 flex justify-between">
                    <span>{o.name}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(o.created_at).toISOString().slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <button
              onClick={onLogout}
              className="text-xs font-mono text-muted-foreground hover:text-foreground tracking-widest uppercase"
            >
              terminate session ×
            </button>
          </div>
        )}
      </div>
      <SharedStyles />
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hairline-strong">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        $ {title}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}

export function SharedStyles() {
  return (
    <style>{`
      .term-input {
        width: 100%;
        background: var(--surface);
        border: 1px solid var(--border-strong);
        padding: 0.625rem 0.75rem;
        font-family: var(--font-mono);
        font-size: 0.85rem;
        color: var(--foreground);
        outline: none;
      }
      .term-input:focus { border-color: var(--foreground); }
      .btn-primary {
        background: var(--foreground);
        color: var(--background);
        font-family: var(--font-mono);
        font-size: 0.7rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        padding: 0.65rem 1rem;
        cursor: pointer;
        border: none;
        transition: opacity .15s;
      }
      .btn-primary:hover { opacity: 0.85; }
    `}</style>
  );
}
