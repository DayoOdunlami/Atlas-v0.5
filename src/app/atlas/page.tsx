import { AtlasClientShell } from "@/components/atlas/atlas-client-shell";
import { AtlasEntryScreen } from "@/components/atlas/entry/atlas-entry-screen";
import { entryFranklin, entryNewsreader } from "@/components/atlas/entry/entry-fonts";
import { fetchAnswerSpecForPage } from "@/lib/atlas/fetch-answer-spec";

export const metadata = {
  title: "Atlas · What do you understand?",
  description: "Atlas v5 — ask a strategic question, get a cited canvas",
};

interface AtlasPageProps {
  searchParams: Promise<{ q?: string; thread?: string }>;
}

/** Single Atlas surface: entry at `/atlas`, live session at `/atlas?q=…` or `/atlas?thread=…`. */
export default async function AtlasPage({ searchParams }: AtlasPageProps) {
  const { q, thread } = await searchParams;
  const bootstrapQuery = q?.trim();
  const threadId = thread?.trim();
  const inSession = Boolean(bootstrapQuery || threadId);

  if (!inSession) {
    return (
      <div className={`${entryNewsreader.variable} ${entryFranklin.variable}`}>
        <AtlasEntryScreen />
      </div>
    );
  }

  const { spec, dataSource } = await fetchAnswerSpecForPage(bootstrapQuery);

  return (
    <AtlasClientShell
      initialSpec={spec}
      initialDataSource={dataSource}
      bootstrapQuery={bootstrapQuery}
      initialThreadId={threadId}
    />
  );
}
