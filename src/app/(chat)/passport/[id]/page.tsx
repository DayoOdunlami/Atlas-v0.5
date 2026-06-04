import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getPassportDetail } from "@/lib/passport/queries";
import { PassportHeader } from "@/components/passport/passport-header";
import { PassportDocuments } from "@/components/passport/passport-documents";
import { PassportClaimsSection } from "@/components/passport/passport-claims-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Brain, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PassportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const data = await getPassportDetail(id);
  if (!data) notFound();

  const { passport, documents, claims } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href="/passport">
          <ArrowLeft className="size-4 mr-1.5" />
          All passports
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card className="border-border/60 lg:sticky lg:top-4 lg:self-start">
            <CardContent className="pt-6">
              <PassportHeader passport={passport} />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                Evidence Documents
                <span className="text-xs font-normal text-muted-foreground ml-auto tabular-nums">
                  {documents.length} file{documents.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PassportDocuments documents={documents} />
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-2 border-b bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="size-4" />
              Claims & evidence
              <span className="text-xs font-normal text-muted-foreground ml-auto tabular-nums">
                {claims.length} claim{claims.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal pt-1">
              Scan by domain — verify or reject to update confidence tier
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <PassportClaimsSection initialClaims={claims} />
          </CardContent>
        </Card>
      </div>

      {/* Ask JARVIS shortcut */}
      <div className="text-center pb-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/?passport=${id}`}>
            Ask JARVIS about this passport →
          </Link>
        </Button>
      </div>
    </div>
  );
}
