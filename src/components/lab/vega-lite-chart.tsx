"use client";

/**
 * VegaLiteChart — renders a Vega-Lite spec via vega-embed.
 *
 * vega-embed is vanilla JS (no React); we mount it into a ref div and
 * clean up on unmount / spec change. Dynamic import keeps the ~620 kB
 * bundle out of the initial chunk.
 *
 * Usage:
 *   <VegaLiteChart spec={myVlSpec} className="w-full" />
 *
 * The caller is responsible for producing a valid Vega-Lite v5 spec object.
 * Pass `width: "container"` in the spec to fill the parent div.
 */

import { useEffect, useRef, useState } from "react";

interface VegaLiteChartProps {
  /** A Vega-Lite v5 TopLevelSpec (as a plain JS object — no need to import VL types). */
  spec: object;
  className?: string;
}

export function VegaLiteChart({ spec, className }: VegaLiteChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // JSON.stringify the spec as the effect dependency — object identity changes
  // on every render, but we only want to re-embed when the contents change.
  const specJson = JSON.stringify(spec);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    // vega-embed returns an EmbedResult with a finalize() method
    let embedResult: { finalize: () => void } | null = null;

    import("vega-embed")
      .then(async ({ default: embed }) => {
        if (cancelled || !containerRef.current) return;
        try {
          // Clear previous chart before re-embedding
          containerRef.current.innerHTML = "";
          embedResult = await embed(
            containerRef.current,
            // vega-embed accepts TopLevelSpec but typed as VisualizationSpec; cast is safe
            JSON.parse(specJson) as Parameters<typeof embed>[1],
            {
              actions: false,   // hide the ... menu
              renderer: "svg",
              // Let the parent div control sizing
              defaultStyle: false,
            },
          );
          if (!cancelled) setError(null);
        } catch (e) {
          if (!cancelled) {
            console.warn("[VegaLiteChart] embed error:", e);
            setError(e instanceof Error ? e.message : "Render error");
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(`Failed to load vega-embed: ${e}`);
      });

    return () => {
      cancelled = true;
      try {
        embedResult?.finalize();
      } catch {
        // finalize can throw if the view is already torn down — swallow
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specJson]);

  if (error) {
    return (
      <div className={`flex items-center justify-center text-xs text-destructive ${className ?? ""}`}>
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
