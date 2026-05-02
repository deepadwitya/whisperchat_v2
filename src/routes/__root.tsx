import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center font-mono">
        <div className="text-[10px] tracking-[0.4em] text-muted-foreground">SIGNAL LOST</div>
        <h1 className="mt-3 text-7xl font-light">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This relay does not exist on the network.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center border border-border-strong px-4 py-2 text-xs uppercase tracking-widest hover:bg-surface-2 transition-colors"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Onion — Anonymous, encrypted communication" },
      {
        name: "description",
        content:
          "Token-based anonymous chat with end-to-end encryption. No usernames. No passwords. No traces.",
      },
      { name: "theme-color", content: "#0f0f0f" },
      { property: "og:title", content: "Onion — Anonymous, encrypted communication" },
      {
        property: "og:description",
        content: "Token-based anonymous chat with end-to-end encryption.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Onion — Anonymous, encrypted communication" },
      { name: "description", content: "WhisperNet Chat provides secure, anonymous communication with advanced organizational tools and onion routing privacy." },
      { property: "og:description", content: "WhisperNet Chat provides secure, anonymous communication with advanced organizational tools and onion routing privacy." },
      { name: "twitter:description", content: "WhisperNet Chat provides secure, anonymous communication with advanced organizational tools and onion routing privacy." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ccde503a-b372-4a9f-b0dd-a7d21d8bd21a/id-preview-9cf686af--2119472d-70f6-4c15-bfc5-29281f30f35e.lovable.app-1777726439480.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ccde503a-b372-4a9f-b0dd-a7d21d8bd21a/id-preview-9cf686af--2119472d-70f6-4c15-bfc5-29281f30f35e.lovable.app-1777726439480.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster theme="dark" position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
