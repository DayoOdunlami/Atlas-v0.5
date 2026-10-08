"use client"

export function ChatSuggestions({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void
}) {
  const suggestions = [
    "What is the current rail modernization strategy?",
    "Summarize the key lessons learned from recent rail projects",
    "What are the main challenges in railway electrification?",
    "How does the TRL mapping process work for new rail technologies?",
    "What are the best practices for change management in rail projects?",
  ]

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Welcome to Strategy AI</h2>
        <p className="mt-2 text-muted-foreground">
          Select a sector and use case, then ask a question or try one of these examples:
        </p>
      </div>
      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className="rounded-lg border p-4 text-left text-sm hover:bg-muted"
            onClick={() => onSuggestionClick(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
