"use client";

/**
 * /atlas5-test — fixture test harness for Playwright smoke tests.
 *
 * Mounts ChatPane (cold session entry) and ArtifactPane side by side.
 * Loads a fixture via ?recipe=<name> query param.
 * With no recipe param (or ?cold=1), shows the cold session entry.
 *
 * data-testid="atlas5-test-root" — required by Playwright suite.
 */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ChatPane } from "@/components/atlas5/chat-pane";
import { ArtifactPane } from "@/components/atlas5/artifact-pane";
import { useArtifactStore } from "@/lib/atlas5/artifact-store";
import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";

function FixtureLoader() {
  const searchParams = useSearchParams();
  const recipe = searchParams.get("recipe");
  const { setArtifact } = useArtifactStore();

  useEffect(() => {
    if (!recipe || recipe === "cold") return;
    fetch(`/api/atlas5/fixture?recipe=${encodeURIComponent(recipe)}`)
      .then((r) => r.json())
      .then((data: { artifact?: ArtifactBlock }) => {
        if (data.artifact) setArtifact(data.artifact);
      })
      .catch(() => {});
  }, [recipe, setArtifact]);

  return null;
}

export default function Atlas5TestPage() {
  return (
    <div
      data-testid="atlas5-test-root"
      className="flex h-screen bg-background"
    >
      <FixtureLoader />
      {/* Chat pane — shows cold session entry when no thread_id + no messages */}
      <div className="w-80 shrink-0 border-r border-border">
        <ChatPane />
      </div>
      {/* Artifact pane — renders fixture when loaded */}
      <div className="flex-1 min-w-0">
        <ArtifactPane />
      </div>
    </div>
  );
}
