import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAuthConfig } from "@/lib/auth/config";

export default async function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signUpEnabled } = getAuthConfig();

  return (
    <div className="animate-in fade-in duration-1000 w-full h-full flex flex-col p-4 md:p-8 justify-center relative">
      <div className="w-full flex justify-end absolute top-0 right-0">
        {signUpEnabled && (
          <Link href="/sign-in">
            <Button variant="ghost">Sign in</Button>
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-4 w-full md:max-w-md mx-auto">
        {children}
      </div>
    </div>
  );
}
