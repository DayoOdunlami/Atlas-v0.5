/**
 * Brain JSON often includes nulls / extra enum values — normalize before Zod.
 */

const VALID_EVOLVED = new Set([
  "verdict",
  "tier",
  "instrument",
  "chart",
  "stats",
  "blindspot",
]);

function stripNulls<T>(value: T): T {
  if (value === null || value === undefined) {
    return undefined as T;
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => stripNulls(v))
      .filter((v) => v !== undefined) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

export function sanitizeAnswerSpecForMouth(spec: unknown): unknown {
  if (!spec || typeof spec !== "object") return spec;
  const raw = stripNulls(structuredClone(spec)) as Record<string, unknown>;

  if (raw.canvas === null) delete raw.canvas;

  if (Array.isArray(raw.corpus_citations)) {
    raw.corpus_citations = raw.corpus_citations
      .filter((c) => c && typeof c === "object")
      .map((c) => {
        const row = { ...(c as Record<string, unknown>) };
        if (row.source_type === null || row.source_type === undefined) {
          row.source_type = "project";
        }
        return row;
      });
  }

  if (raw.provenance && typeof raw.provenance === "object") {
    const prov: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.provenance as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const entry = { ...(v as Record<string, unknown>) };
      if (entry.url === null) delete entry.url;
      if (entry.row === null) entry.row = "corpus";
      if (entry.trustNote === null) delete entry.trustNote;
      prov[k] = entry;
    }
    raw.provenance = prov;
  }

  if (raw.reconciliation && typeof raw.reconciliation === "object") {
    const rec = raw.reconciliation as Record<string, unknown>;
    if (Array.isArray(rec.notes)) {
      rec.notes = rec.notes.map((n) => {
        if (!n || typeof n !== "object") return n;
        const note = { ...(n as Record<string, unknown>) };
        for (const key of ["message", "corpus_signal", "external_signal", "note"]) {
          if (note[key] === null) delete note[key];
        }
        return note;
      });
    }
    if (rec.retrieval && typeof rec.retrieval === "object") {
      const ret = { ...(rec.retrieval as Record<string, unknown>) };
      for (const key of ["corpus_ms", "external_ms", "govuk_count", "exa_count", "corpus_thin", "external_led"]) {
        if (ret[key] === null) delete ret[key];
      }
      rec.retrieval = ret;
    }
    raw.reconciliation = rec;
  }

  if (raw.carriedFrom && typeof raw.carriedFrom === "object") {
    const cf = raw.carriedFrom as Record<string, unknown>;
    if (Array.isArray(cf.evolvedFields)) {
      cf.evolvedFields = cf.evolvedFields.filter((f) =>
        typeof f === "string" && VALID_EVOLVED.has(f),
      );
    }
    raw.carriedFrom = cf;
  }

  if (raw.thread_id === null) delete raw.thread_id;

  return raw;
}
