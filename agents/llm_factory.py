"""
Atlas 5 — model-agnostic LLM factory.

Reads two env vars so the model can be swapped without touching any graph code:

    MODEL_PROVIDER   anthropic (default) | openai
    MODEL_NAME       claude-sonnet-4-6 (default) | gpt-4o | etc.

Both providers are exposed through LangChain's BaseChatModel interface so
graph nodes call .invoke() / .ainvoke() identically regardless of provider.
Extended thinking / reasoning tokens are provider-specific bonuses that are
NOT required — the graphs emit their own reasoning_trace for observability.
"""
from __future__ import annotations

import os
from langchain_core.language_models import BaseChatModel


def get_llm(max_tokens: int = 4096) -> BaseChatModel:
    provider = os.environ.get("MODEL_PROVIDER", "anthropic").lower()
    model_name = os.environ.get("MODEL_NAME", "claude-sonnet-4-6")

    if provider == "openai":
        from langchain_openai import ChatOpenAI  # type: ignore[import]
        return ChatOpenAI(
            model=model_name,
            max_tokens=max_tokens,
            api_key=os.environ["OPENAI_API_KEY"],
        )

    # Default: Anthropic
    from langchain_anthropic import ChatAnthropic
    return ChatAnthropic(
        model=model_name,
        api_key=os.environ["ANTHROPIC_API_KEY"],
        max_tokens=max_tokens,
    )
