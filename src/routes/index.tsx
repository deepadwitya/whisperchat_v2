import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Onion — Anonymous, encrypted communication" },
      {
        name: "description",
        content:
          "A token-based anonymous workspace for secure, encrypted communication. No usernames, no passwords, no traces.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 border border-border-strong flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-foreground" />
          </div>
          <span className="font-mono text-sm tracking-[0.3em]">ONION</span>
        </div>
        <nav className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
          <Link
            to="/superuser"
            className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            superuser
          </Link>
          <Link
            to="/login"
            className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            session
          </Link>
          <Link
            to="/join"
            className="px-3 py-2 border border-border-strong hover:bg-surface-2 transition-colors"
          >
            redeem invite →
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-32">
        <div className="font-mono text-[10px] tracking-[0.4em] text-muted-foreground mb-6">
          ANONYMOUS · ENCRYPTED · TOKEN-AUTHENTICATED
        </div>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight max-w-3xl leading-[1.05]">
          Communication
          <br />
          <span className="text-muted-foreground">without identity.</span>
        </h1>
        <p className="mt-8 max-w-xl text-base text-muted-foreground leading-relaxed">
          Onion is a workspace for organizations that need to talk securely. Members are
          authenticated by long-lived session tokens — no usernames, no passwords, no email
          addresses. Messages are end-to-end encrypted in your browser before they ever touch the
          server.
        </p>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/join"
            className="px-6 py-3 bg-foreground text-background text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 transition-colors"
          >
            I have an invite code
          </Link>
          <Link
            to="/login"
            className="px-6 py-3 border border-border-strong text-xs font-mono uppercase tracking-widest hover:bg-surface-2 transition-colors"
          >
            Resume with token
          </Link>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-px bg-border">
          {[
            {
              k: "01",
              h: "Token-based identity",
              d: "Receive an opaque session token on join. Store it. There is nothing else to remember, and nothing else for an attacker to steal.",
            },
            {
              k: "02",
              h: "End-to-end encryption",
              d: "Messages are encrypted with AES-GCM in your browser using a passphrase the server never sees. We store ciphertext.",
            },
            {
              k: "03",
              h: "Isolated organizations",
              d: "Each org is a sealed instance with its own admins, channels, roles, and audit log. No cross-tenant data, ever.",
            },
          ].map((f) => (
            <div key={f.k} className="bg-background p-8">
              <div className="font-mono text-[10px] tracking-[0.4em] text-muted-foreground">
                {f.k}
              </div>
              <h3 className="mt-3 text-lg font-medium">{f.h}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-24 hairline-strong p-6 font-mono text-xs">
          <div className="text-muted-foreground mb-2">$ onion.session.verify</div>
          <div className="text-foreground">
            ► token <span className="text-muted-foreground">a3f2···9e7c</span> authenticated
          </div>
          <div className="text-muted-foreground mt-1">
            anonymous · e2e encrypted · org-isolated
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border mx-auto max-w-6xl px-6 py-8 flex items-center justify-between text-xs font-mono text-muted-foreground">
        <div>onion · v1.0</div>
        <div className="tracking-[0.3em]">NO LOGS · NO ACCOUNTS · NO TRACES</div>
      </footer>
    </main>
  );
}
