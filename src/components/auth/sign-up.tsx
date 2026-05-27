"use client";

/**
 * SignUp — minimal sign-up form.
 * Stub component: renders a placeholder until a full auth UI is built.
 */

interface SignUpProps {
  isFirstUser?: boolean;
  emailAndPasswordEnabled?: boolean;
  socialAuthenticationProviders?: string[];
}

export default function SignUpPage({ emailAndPasswordEnabled = true }: SignUpProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Create account</h2>
        <p className="text-sm text-muted-foreground">Sign up to get started</p>
      </div>

      {emailAndPasswordEnabled ? (
        <a href="/sign-up/email" className="text-sm text-primary underline">
          Continue with email →
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">Sign-up via email is disabled.</p>
      )}
    </div>
  );
}
