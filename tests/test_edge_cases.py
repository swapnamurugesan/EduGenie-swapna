"""Comprehensive provider error, edge-case, and rate-limiting tests."""

from unittest.mock import MagicMock
from starlette.testclient import TestClient
from config import settings
from ai_client import AIProviderError, gemini_client
from schemas import QuizQuestion
from quiz_module import _RawQuizOutput


def test_gemini_quota_exhausted_mapping(client: TestClient, monkeypatch):
    """Test that Google Gemini RESOURCE_EXHAUSTED maps to 429 QUOTA_EXHAUSTED."""
    settings.GEMINI_API_KEY = "test_key"
    monkeypatch.setattr(
        gemini_client,
        "generate_structured",
        MagicMock(side_effect=AIProviderError(
            message="Gemini API rate limit or quota exceeded. Please wait a moment and try again.",
            code="QUOTA_EXHAUSTED",
            status_code=429
        ))
    )

    response = client.post("/qa", json={"question": "Explain black holes", "level": "intermediate"})
    assert response.status_code == 429
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "QUOTA_EXHAUSTED"


def test_gemini_auth_failure_mapping(client: TestClient, monkeypatch):
    """Test that invalid credentials map to 401 AUTHENTICATION_FAILED."""
    settings.GEMINI_API_KEY = "invalid_key"
    monkeypatch.setattr(
        gemini_client,
        "generate_structured",
        MagicMock(side_effect=AIProviderError(
            message="Invalid Gemini API key.",
            code="AUTHENTICATION_FAILED",
            status_code=401
        ))
    )

    response = client.post("/qa", json={"question": "Explain relativity", "level": "advanced"})
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"


def test_quiz_fails_if_duplicate_options_persist(client: TestClient, monkeypatch):
    """Test that if model repeatedly outputs invalid schema, a clean 502 error is returned."""
    monkeypatch.setattr(
        gemini_client,
        "generate_structured",
        MagicMock(side_effect=AIProviderError(
            message="Failed to validate structured AI output.",
            code="INVALID_STRUCTURED_OUTPUT",
            status_code=502
        ))
    )

    response = client.post("/quiz", json={"topic_or_passage": "General Science", "difficulty": "beginner"})
    assert response.status_code == 502
    data = response.json()
    assert data["success"] is False
    assert "QUIZ" in data["error"]["code"] or "INVALID" in data["error"]["code"]


def test_local_engine_missing_dependencies_error(client: TestClient, monkeypatch):
    """Test actionable error when EXPLANATION_PROVIDER='local' and dependencies are missing."""
    settings.EXPLANATION_PROVIDER = "local"

    from explanation_module import local_engine

    def fake_load_sync():
        raise AIProviderError(
            message="Local inference dependencies (torch, transformers) are not installed.",
            code="LOCAL_DEPENDENCIES_MISSING",
            status_code=503,
            details="Install local dependencies using: pip install -r requirements-local.txt"
        )

    monkeypatch.setattr(local_engine, "_load_model_sync", fake_load_sync)

    response = client.post("/explain", json={"topic": "Quantum physics", "level": "advanced"})
    assert response.status_code == 503
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "LOCAL_DEPENDENCIES_MISSING"
