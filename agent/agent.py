from __future__ import annotations
import os

# ADK imports
from ag_ui_adk import ADKAgent
from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.lite_llm import LiteLlm

# Local imports
from modifiers import before_model, after_model
from tools import tools
from instructions import instruction_provider

# Model selector: LLM_PROVIDER env var controls which model is used.
# Options: "openai" (default), "anthropic", "google"
_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()
if _PROVIDER == "anthropic":
    _MODEL = LiteLlm(model=os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-6"))
elif _PROVIDER == "google":
    _MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
else:
    _MODEL = LiteLlm(model=os.getenv("LLM_MODEL", "openai/gpt-4o"))


def on_before_agent(callback_context: CallbackContext):
    return None


dashboard_agent = Agent(
    name="DashboardAgent",
    model=_MODEL,
    tools=tools,
    # run-loop modifiers
    before_agent_callback=on_before_agent,
    before_model_callback=before_model,
    after_model_callback=after_model,
    # system instructions
    instruction=instruction_provider,
)

# Create ADK middleware agent instance
dashboard_agent = ADKAgent(
    adk_agent=dashboard_agent,
    app_name="dashboard_app",
    user_id="demo_user",
    session_timeout_seconds=3600,
    use_in_memory_services=True,
)
