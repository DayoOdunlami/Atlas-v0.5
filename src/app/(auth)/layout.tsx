import { getSession } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <main className="relative w-full flex flex-col h-screen">
      <div className="flex-1">
        <div className="flex min-h-screen w-full">
          {/* Left decorative panel — visible on large screens */}
          <div className="hidden lg:flex lg:w-1/2 bg-muted border-r flex-col p-18 relative">
            <h1 className="text-xl font-semibold flex items-center gap-3">
              <span>Atlas</span>
            </h1>
            <div className="flex-1" />
            <p className="mb-4 text-muted-foreground text-sm">
              Strategic intelligence for Connected Places Catapult
            </p>
          </div>

          <div className="w-full lg:w-1/2 p-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
