"""Tests for general application endpoints, health checks, and error middleware."""

from starlette.testclient import TestClient
from config import settings
from ai_client import AIProviderError


def test_home_page_renders_html(client: TestClient):
    """Test that GET / returns the HTML index page with status 200."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "EduGenie" in response.text
    assert "Ask Question" in response.text
    assert "Practice Quiz" in response.text


def test_health_check_endpoint(client: TestClient):
    """Test GET /health returns proper diagnostic payload."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "api_key_configured" in data
    assert "gemini_model" in data
    assert "explanation_provider" in data
    assert "local_model_loaded" in data
    assert "timestamp" in data


def test_missing_api_key_error_handling(client: TestClient, monkeypatch):
    """Test that invoking Gemini with an empty API key produces an informative 503 response."""
    settings.GEMINI_API_KEY = ""

    response = client.post(
        "/qa",
        json={"question": "What is photosynthesis?", "level": "beginner"}
    )
    assert response.status_code == 503
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "API_KEY_MISSING"
    assert "Gemini API Key is not configured" in data["error"]["message"]


def test_validation_error_format(client: TestClient):
    """Test that invalid request payloads return 422 with structured errors."""
    response = client.post(
        "/qa",
        json={"question": "ab", "level": "invalid_level"}
    )
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
