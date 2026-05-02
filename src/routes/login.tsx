import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { loginWithToken } from "@/server/auth.functions";
import { SharedStyles } from "./superuser";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Resume session — Onion" }] }),
  component: Login,
});

function Login() {
  const [token, setToken] = useState("");
  const fn = useServerFn(loginWithToken);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fn({ data: { token: token.trim() } });
      nav({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="font-mono text-xs tracking-[0.3em] text-muted-foreground hover:text-foreground">
            ← onion
          </Link>
          <div className="font-mono text-[10px] tracking-[0.4em] text-muted-foreground">
            SESSION RESUME
          </div>
        </div>

        <div className="hairline-strong">
          <div className="border-b border-border px-4 py-2 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            $ session.resume
          </div>
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              session token
            </div>
            <input
              className="term-input"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="paste your token"
            />
            <button className="btn-primary w-full">authenticate →</button>
          </form>
        </div>

        <p className="mt-6 font-mono text-xs text-muted-foreground text-center">
          no token?{" "}
          <Link to="/join" className="text-foreground hover:underline">
            redeem an invite
          </Link>
        </p>
      </div>
      <SharedStyles />
    </main>
  );
}
