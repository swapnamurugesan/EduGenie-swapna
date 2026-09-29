"""EduGenie - Google Gemini Powered Learning Assistant
Main FastAPI Application Server.
"""

from datetime import datetime, timezone
import logging
import time
import uuid
from typing import Dict
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from config import settings
from schemas import (
    ExplainRequest,
    ExplainResponse,
    HealthResponse,
    LearningPathRequest,
    LearningPathResponse,
    QARequest,
    QAResponse,
    QuizRequest,
    QuizResponse,
    StandardErrorResponse,
    SummarizeRequest,
    SummarizeResponse,
)
from ai_client import AIProviderError, gemini_client
from qna import answer_question
from explanation_module import explain_concept, local_engine
from quiz_module import generate_quiz
from summary_module import summarize_content
from learning_path import generate_learning_path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("edugenie.main")

app = FastAPI(
    title="EduGenie",
    description="Google Gemini Powered Learning Assistant API",
    version="1.0.0",
)

# Mount static and template directories
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Simple in-memory rate limiter per IP for local demonstration
_client_requests: Dict[str, list] = {}


@app.middleware("http")
async def add_request_metadata_and_rate_limit(request: Request, call_next):
    req_id = str(uuid.uuid4())
    request.state.request_id = req_id
    start_time = time.perf_counter()

    # Rate limiting check (sliding 60-second window)
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    if client_ip not in _client_requests:
        _client_requests[client_ip] = []
    
    # Filter out requests older than 60 seconds
    _client_requests[client_ip] = [ts for ts in _client_requests[client_ip] if now - ts < 60]

    # Check limit only on POST API routes
    if request.url.path.startswith(("/qa", "/explain", "/quiz", "/summarize", "/learn")):
        if len(_client_requests[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
            logger.warning("Rate limit exceeded for client %s on %s", client_ip, request.url.path)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded ({settings.RATE_LIMIT_PER_MINUTE} requests/min). Please wait a moment.",
                        "details": "This local rate limiter protects from runaway requests."
                    }
                },
                headers={"X-Request-ID": req_id}
            )
        _client_requests[client_ip].append(now)

    try:
        response: Response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        response.headers["X-Request-ID"] = req_id
        # Log request metadata without sensitive body payloads
        logger.info(
            "[%s] %s %s -> status=%d duration=%.2fms",
            req_id[:8],
            request.method,
            request.url.path,
            response.status_code,
            duration_ms
        )
        return response
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error("[%s] Unhandled exception on %s %s: %s", req_id[:8], request.method, request.url.path, str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An internal server error occurred.",
                    "details": str(exc)
                }
            },
            headers={"X-Request-ID": req_id}
        )


# ==========================================
# Exception Handlers
# ==========================================
@app.exception_handler(AIProviderError)
async def ai_provider_exception_handler(request: Request, exc: AIProviderError):
    req_id = getattr(request.state, "request_id", "unknown")
    logger.warning("[%s] AI Provider Error: [%s] %s", req_id[:8], exc.code, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        },
        headers={"X-Request-ID": req_id}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = getattr(request.state, "request_id", "unknown")
    errors = exc.errors()
    error_msgs = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []) if l != "body")
        msg = err.get("msg", "Invalid value")
        error_msgs.append(f"{loc}: {msg}" if loc else msg)

    formatted_msg = "; ".join(error_msgs) if error_msgs else "Validation error on submitted data."
    logger.warning("[%s] Request Validation Error: %s", req_id[:8], formatted_msg)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": formatted_msg,
                "details": "Please check your input fields and try again."
            }
        },
        headers={"X-Request-ID": req_id}
    )


# ==========================================
# Frontend Route
# ==========================================
@app.get("/", response_class=HTMLResponse)
async def serve_home(request: Request):
    """Render the primary EduGenie single-page web interface."""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "gemini_configured": gemini_client.is_api_key_configured(),
            "explanation_provider": settings.EXPLANATION_PROVIDER,
            "gemini_model": settings.GEMINI_MODEL,
        }
    )


# ==========================================
# Health & Status Endpoint
# ==========================================
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """System health check and configuration status."""
    return HealthResponse(
        status="healthy",
        api_key_configured=gemini_client.is_api_key_configured(),
        gemini_model=settings.GEMINI_MODEL,
        explanation_provider=settings.EXPLANATION_PROVIDER,
        local_model_loaded=local_engine.is_loaded(),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ==========================================
# Feature 1: Ask a Question (Q&A)
# ==========================================
@app.post("/qa", response_model=QAResponse)
async def api_qa(request: QARequest):
    """Academic question answering with structured explanations and examples."""
    return answer_question(request)


# ==========================================
# Feature 2: Explain a Concept
# ==========================================
@app.post("/explain", response_model=ExplainResponse)
async def api_explain(request: ExplainRequest):
    """Concept breakdown with analogies and takeaways using configured provider."""
    return await explain_concept(request)


# ==========================================
# Feature 3: Generate and Attempt Quiz
# ==========================================
@app.post("/quiz", response_model=QuizResponse)
async def api_quiz(request: QuizRequest):
    """Generate exactly 3 validated multiple choice questions with explanations."""
    return generate_quiz(request)


# ==========================================
# Feature 4: Summarize Content
# ==========================================
@app.post("/summarize", response_model=SummarizeResponse)
async def api_summarize(request: SummarizeRequest):
    """Summarize educational text preserving critical facts with word counts."""
    return summarize_content(request)


# ==========================================
# Feature 5: Personalized Learning Path
# ==========================================
@app.post("/learn/recommendations", response_model=LearningPathResponse)
async def api_learning_path(request: LearningPathRequest):
    """Generate structured, realistic week-by-week educational curricula."""
    return generate_learning_path(request)
