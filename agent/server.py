from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint

from graph import graph

app = FastAPI(title="Atlas LangGraph Agent")

agent = LangGraphAgent(
    name="my_agent",
    description="Atlas AI decision workbench agent for Connected Places Catapult",
    graph=graph,
)

add_langgraph_fastapi_endpoint(app, agent, path="/")

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
