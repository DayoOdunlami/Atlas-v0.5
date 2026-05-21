import os
from langchain_core.language_models import BaseChatModel


def get_chat_model() -> BaseChatModel:
    """
    Thin model factory. Configure via env:
      LLM_PROVIDER    = anthropic (default) | openai
      LLM_MODEL       = claude-sonnet-4-6 (default)
      LLM_TEMPERATURE = 0.2 (default)
    """
    provider = os.getenv("LLM_PROVIDER", "anthropic").lower()
    model = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
    temperature = float(os.getenv("LLM_TEMPERATURE", "0.2"))

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, temperature=temperature)
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, temperature=temperature)
    else:
        raise ValueError(
            f"Unsupported LLM_PROVIDER: {provider!r}. "
            "Supported values: 'anthropic', 'openai'."
        )
