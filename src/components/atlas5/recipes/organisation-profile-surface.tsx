"use client";

/**
 * OrganisationProfileSurface — organisation_profile recipe (Sprint 5)
 * Fixture-driven entity profile: summary sections + object-layer visual blocks.
 */

import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import { BlocksView } from "@/components/atlas5/block-renderer";
import { SurfaceSection, EvidenceCountStrip } from "./surface-primitives";
import { Markdown } from "@/components/chat/layout/markdown";

export function OrganisationProfileSurface({
  artifact,
  compact = false,
}: {
  artifact: ArtifactBlock;
  compact?: boolean;
}) {
  const profile = artifact.sections ?? {};
  const blocks = artifact.visual_blocks ?? [];

  return (
    <div className="space-y-4" data-testid="organisation-profile-surface">
      {Object.entries(profile).map(([title, body]) => (
        <SurfaceSection key={title} title={title}>
          <Markdown content={body} />
        </SurfaceSection>
      ))}

      {blocks.length > 0 && (
        <BlocksView blocks={blocks} showcase={compact} />
      )}

      {(artifact.corpus_citations?.length ?? 0) > 0 && (
        <EvidenceCountStrip citations={artifact.corpus_citations!} />
      )}
    </div>
  );
}
