"""Tests for Concept Explanation module (Gemini and Local provider modes)."""

from unittest.mock import AsyncMock, MagicMock
from starlette.testclient import TestClient
from config import settings
from ai_client import gemini_client
from explanation_module import _ExplainStructuredOutput, local_engine
from schemas import ExplainResponse


def test_explain_gemini_provider(client: TestClient, monkeypatch):
    """Test /explain with EXPLANATION_PROVIDER='gemini'."""
    settings.EXPLANATION_PROVIDER = "gemini"

    mock_result = _ExplainStructuredOutput(
        explanation="The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.",
        analogy_or_example="If you walk 3 blocks east and 4 blocks north, the straight-line shortcut is exactly 5 blocks.",
        takeaway="a² + b² = c² for all right-angled triangles."
    )
    monkeypatch.setattr(gemini_client, "generate_structured", MagicMock(return_value=mock_result))

    response = client.post(
        "/explain",
        json={"topic": "Pythagorean theorem", "level": "beginner"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["topic"] == "Pythagorean theorem"
    assert data["provider"] == "gemini"
    assert "Pythagorean theorem" in data["explanation"]
    assert "shortcut" in data["analogy_or_example"]


def test_explain_local_provider_mocked(client: TestClient, monkeypatch):
    """Test /explain with EXPLANATION_PROVIDER='local' and mocked local engine."""
    settings.EXPLANATION_PROVIDER = "local"

    mock_local_response = ExplainResponse(
        topic="Gravity",
        level="intermediate",
        explanation="Gravity is an attractive force between objects with mass.",
        analogy_or_example="An apple falling from a tree.",
        takeaway="Mass attracts mass.",
        provider="local"
    )
    monkeypatch.setattr(local_engine, "explain", AsyncMock(return_value=mock_local_response))

    response = client.post(
        "/explain",
        json={"topic": "Gravity", "level": "intermediate"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "local"
    assert data["topic"] == "Gravity"


def test_explain_empty_topic_rejected(client: TestClient):
    """Test that empty topic is rejected with 422."""
    response = client.post("/explain", json={"topic": "", "level": "beginner"})
    assert response.status_code == 422
    assert response.json()["success"] is False
