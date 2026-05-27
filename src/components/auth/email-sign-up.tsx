"use client";

/**
 * EmailSignUp — minimal email sign-up form.
 * Stub component: renders a placeholder until a full auth UI is built.
 */

interface EmailSignUpProps {
  isFirstUser?: boolean;
}

export default function EmailSignUp(_props: EmailSignUpProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Create account</h2>
        <p className="text-sm text-muted-foreground">Enter your details to sign up</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void fetch("/api/auth/sign-up/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") }),
          }).then((r) => { if (r.ok) window.location.href = "/"; });
        }}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
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
            autoComplete="new-password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Create account
        </button>
      </form>
    </div>
  );
}
