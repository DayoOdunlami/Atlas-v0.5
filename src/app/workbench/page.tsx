// /workbench — Atlas Workbench page (server component)
//
// URL params:
//   ?match_id=<uuid>   — atlas.matches UUID to load (null → static demo mode)
//   ?cq=<cq_id>        — canonical question (cq.match.browse | workbench | act | defend)
//
// When the backend is wired, a non-null match_id triggers an async model fetch
// in WorkbenchProvider. For now it is passed through and held in session state.

import type { CanonicalQuestionId } from "@/lib/workbench/atlas-render-model";
import { AtlasWorkbenchPage } from "@/components/workbench/atlas-workbench-page";

export const metadata = {
  title: "Atlas Workbench",
};

interface WorkbenchPageProps {
  searchParams: Promise<{
    match_id?: string;
    cq?: string;
  }>;
}

const VALID_CQ_IDS: CanonicalQuestionId[] = [
  "cq.match.browse",
  "cq.match.workbench",
  "cq.match.act",
  "cq.match.defend",
];

export default async function WorkbenchRoute({ searchParams }: WorkbenchPageProps) {
  const params = await searchParams;

  const matchId = params.match_id ?? null;
  const cqId = VALID_CQ_IDS.includes(params.cq as CanonicalQuestionId)
    ? (params.cq as CanonicalQuestionId)
    : null;

  return <AtlasWorkbenchPage initialMatchId={matchId} initialCqId={cqId} />;
}
