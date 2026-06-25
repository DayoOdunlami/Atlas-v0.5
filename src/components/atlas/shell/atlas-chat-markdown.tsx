"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

/** Compact markdown for the SoWhat chat rail — bold, lists, links only. */
export function AtlasChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="m-0 mb-2 last:mb-0" style={{ lineHeight: 1.55 }}>
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 600, color: T.ink }}>{children}</strong>
        ),
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => (
          <ul className="my-2 ms-4 list-disc space-y-1" style={{ lineHeight: 1.5 }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 ms-4 list-decimal space-y-1" style={{ lineHeight: 1.5 }}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.corpus, textDecoration: "underline" }}
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code
            style={{
              fontFamily: atlasFont.mono,
              fontSize: "0.92em",
              background: "#EDE9E0",
              padding: "0 4px",
              borderRadius: 3,
            }}
          >
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
