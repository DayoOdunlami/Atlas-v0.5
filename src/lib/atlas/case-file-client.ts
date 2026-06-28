import type {
  CaseClaim,
  CaseEntitySummary,
  CaseFileSnapshot,
} from "@/lib/atlas/case-file-types";

export async function fetchCaseFile(threadId: string): Promise<CaseFileSnapshot | null> {
  const res = await fetch(`/api/atlas/case-file/${encodeURIComponent(threadId)}`, {
    cache: "no-store",
  });
  if (res.status === 503) return null;
  if (!res.ok) return null;
  return (await res.json()) as CaseFileSnapshot;
}

export async function patchCaseFile(
  threadId: string,
  claims: CaseClaim[],
): Promise<CaseFileSnapshot | null> {
  const res = await fetch(`/api/atlas/case-file/${encodeURIComponent(threadId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claims }),
  });
  if (!res.ok) return null;
  return (await res.json()) as CaseFileSnapshot;
}

export async function fetchCaseEntities(): Promise<{
  entities: CaseEntitySummary[];
  configured: boolean;
}> {
  const res = await fetch("/api/atlas/case-entities", { cache: "no-store" });
  if (res.status === 503) return { entities: [], configured: false };
  if (!res.ok) return { entities: [], configured: true };
  const data = (await res.json()) as { entities: CaseEntitySummary[] };
  return { entities: data.entities ?? [], configured: true };
}

export async function promoteToCaseEntity(
  threadId: string,
  title: string,
): Promise<{ entity: { id: string; title: string } } | null> {
  const res = await fetch("/api/atlas/case-entities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, from_thread_id: threadId, promote: true }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { entity: { id: string; title: string } };
}

export async function attachCaseEntity(
  threadId: string,
  entityId: string,
): Promise<boolean> {
  const res = await fetch(
    `/api/atlas/case-entities/${encodeURIComponent(entityId)}/attach`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId }),
    },
  );
  return res.ok;
}
