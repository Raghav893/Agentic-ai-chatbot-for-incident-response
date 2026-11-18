import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .evidence import InvalidUrl, inspect_url
from .orchestrator import Orchestrator, UpstreamFailure
from .schemas import AnalysisResponse, ChatRequest, EmailRequest, UrlRequest


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(follow_redirects=False) as client:
        app.state.orchestrator = Orchestrator(
            client,
            os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip(),
            os.getenv("DEEPSEEK_API_KEY", "").strip(),
            os.getenv("VIRUSTOTAL_API_KEY", "").strip(),
        )
        yield


app = FastAPI(title="ThreatGuard AI Service", lifespan=lifespan, redoc_url=None)


@app.exception_handler(UpstreamFailure)
async def handle_upstream_failure(_request: Request, error: UpstreamFailure) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"detail": str(error)})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ai/chat")
async def chat(payload: ChatRequest, request: Request) -> AnalysisResponse:
    return await request.app.state.orchestrator.analyze(payload, "chat")


@app.post("/ai/analyze-url")
async def analyze_url(payload: UrlRequest, request: Request) -> AnalysisResponse:
    try:
        url = inspect_url(payload.url)
    except InvalidUrl as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return await request.app.state.orchestrator.analyze(ChatRequest(message=payload.url), "url", url)


@app.post("/ai/analyze-email")
async def analyze_email(payload: EmailRequest, request: Request) -> AnalysisResponse:
    return await request.app.state.orchestrator.analyze(ChatRequest(message=payload.content), "email")
