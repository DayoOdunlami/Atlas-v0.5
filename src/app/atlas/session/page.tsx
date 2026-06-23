import { AtlasClientShell } from "@/components/atlas/atlas-client-shell";
import { fetchAnswerSpecForPage } from "@/lib/atlas/fetch-answer-spec";

export const metadata = {
  title: "Atlas · Session",
  description: "Atlas v5 answer surface — live brain + canvas",
};

export default async function AtlasSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { spec, dataSource } = await fetchAnswerSpecForPage(q);
  return (
    <AtlasClientShell
      initialSpec={spec}
      initialDataSource={dataSource}
      bootstrapQuery={q?.trim()}
    />
  );
}
