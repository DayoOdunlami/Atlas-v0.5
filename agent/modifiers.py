from typing import Optional

# ADK imports
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse, LlmRequest
from google.genai import types


def before_model(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> Optional[LlmResponse]:
    """
    Inspects/modifies the LLM request or skips the call.
    LiteLLM requires system_instruction to be a plain string, not a types.Content object.
    """
    agent_name = callback_context.agent_name
    if agent_name == "DashboardAgent":
        prefix = f"""
You manage a dashboard for a user.

Current dashboard: {callback_context.state}

When asked for the current dashboard, pinned metrics or charts please reference the current dashboard and respond.
"""
        existing = llm_request.config.system_instruction
        if isinstance(existing, types.Content):
            existing_text = " ".join(
                part.text or "" for part in (existing.parts or [])
            )
        elif isinstance(existing, str):
            existing_text = existing
        else:
            existing_text = str(existing) if existing else ""

        llm_request.config.system_instruction = prefix + existing_text

    return None


# --- Define the Callback Function ---
def after_model(
    callback_context: CallbackContext, llm_response: LlmResponse
) -> Optional[LlmResponse]:
    """Stop the consecutive tool calling of the agent"""
    agent_name = callback_context.agent_name
    # --- Inspection ---
    if agent_name == "DashboardAgent":
        if llm_response.content and llm_response.content.parts:
            # Assuming simple text response for this example
            if (
                llm_response.content.role == "model"
                and llm_response.content.parts[0].text
            ):
                callback_context._invocation_context.end_invocation = True

        elif llm_response.error_message:
            return None
        else:
            return None  # Nothing to modify
    return None
