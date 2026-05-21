"""
Windows runner for the ADK dashboard agent.
reload=False avoids the multiprocessing spawn issue on Windows Python 3.13.
Usage: python run_agent.py
"""
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

if __name__ == '__main__':
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    if provider == "google" and not os.getenv("GOOGLE_API_KEY"):
        print("⚠️  GOOGLE_API_KEY not set — check agent/.env")
        sys.exit(1)
    elif provider == "anthropic" and not os.getenv("ANTHROPIC_API_KEY"):
        print("⚠️  ANTHROPIC_API_KEY not set — check agent/.env")
        sys.exit(1)
    elif provider == "openai" and not os.getenv("OPENAI_API_KEY"):
        print("⚠️  OPENAI_API_KEY not set — check agent/.env")
        sys.exit(1)

    import uvicorn
    print(f"🚀 ADK Dashboard Agent starting on http://localhost:8000 (provider={provider}) ...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
