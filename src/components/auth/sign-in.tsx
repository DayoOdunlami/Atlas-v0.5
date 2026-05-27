"use client";

/**
 * SignIn — minimal email/password sign-in form.
 * Stub component: renders a placeholder until a full auth UI is built.
 */

interface SignInProps {
  emailAndPasswordEnabled?: boolean;
  signUpEnabled?: boolean;
  socialAuthenticationProviders?: string[];
  isFirstUser?: boolean;
  showDevLogin?: boolean;
  devBypassHints?: Record<string, string> | null;
}

export default function SignIn({ emailAndPasswordEnabled = true }: SignInProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
      </div>

      {emailAndPasswordEnabled ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void fetch("/api/auth/sign-in/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
            }).then((r) => { if (r.ok) window.location.href = "/"; });
          }}
        >
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Sign in
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Email sign-in is disabled. Use a social provider.</p>
      )}
    </div>
  );
}
