import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { redeemMasterInvite, redeemOrgInvite } from "@/server/auth.functions";
import { SharedStyles } from "./superuser";

export const Route = createFileRoute("/join")({
  head: () => ({ meta: [{ title: "Redeem invite — Onion" }] }),
  component: Join,
});

function Join() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const memberFn = useServerFn(redeemOrgInvite);
  const masterFn = useServerFn(redeemMasterInvite);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    // Try as org-level invite first; fall back to master invite.
    try {
      const r = await memberFn({ data: { code: code.trim(), displayName: name.trim() } });
      setIssuedToken(r.sessionToken);
      return;
    } catch {
      // try master
    }
    try {
      const r = await masterFn({ data: { code: code.trim(), adminName: name.trim() } });
      setIssuedToken(r.sessionToken);
      toast.success(`Organization "${r.orgName}" created.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (issuedToken) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="hairline-strong">
            <div className="border-b border-border px-4 py-2 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              $ session.token.issued
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm">
                <span className="text-foreground">Save this session token.</span>{" "}
                <span className="text-muted-foreground">
                  It is the only way to resume your session. We do not store it in plaintext and we
                  cannot recover it.
                </span>
              </p>
              <div className="hairline p-3 font-mono text-xs break-all bg-surface select-all">
                {issuedToken}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary flex-1"
                  onClick={async () => {
                    await navigator.clipboard.writeText(issuedToken);
                    toast.success("Token copied");
                  }}
                >
                  copy token
                </button>
                <button className="btn-primary flex-1" onClick={() => nav({ to: "/app" })}>
                  enter workspace →
                </button>
              </div>
            </div>
          </div>
        </div>
        <SharedStyles />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="font-mono text-xs tracking-[0.3em] text-muted-foreground hover:text-foreground">
            ← onion
          </Link>
          <div className="font-mono text-[10px] tracking-[0.4em] text-muted-foreground">
            INVITE REDEMPTION
          </div>
        </div>
        <div className="hairline-strong">
          <div className="border-b border-border px-4 py-2 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            $ invite.redeem
          </div>
          <form onSubmit={submit} className="p-5 space-y-4">
            <label className="block">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">
                invite code
              </div>
              <input className="term-input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </label>
            <label className="block">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">
                display name (visible to org)
              </div>
              <input
                className="term-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. raven"
                maxLength={48}
              />
            </label>
            <button className="btn-primary w-full">redeem →</button>
          </form>
        </div>

        <p className="mt-6 font-mono text-xs text-muted-foreground text-center">
          already have a token?{" "}
          <Link to="/login" className="text-foreground hover:underline">
            resume session
          </Link>
        </p>
      </div>
      <SharedStyles />
    </main>
  );
}
