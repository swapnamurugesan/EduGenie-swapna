"""Tests for Academic Question & Answer module."""

from unittest.mock import MagicMock
from starlette.testclient import TestClient
from ai_client import gemini_client
from qna import _QAStructuredOutput


def test_qa_successful_response(client: TestClient, monkeypatch):
    """Test successful Q&A response generation with mocked Gemini client."""
    mock_result = _QAStructuredOutput(
        answer="The Pacific Ocean is the largest ocean on Earth, covering more than 30% of the planet's surface.",
        key_points=[
            "Covers over 63 million square miles.",
            "Contains the Mariana Trench, the deepest point on Earth.",
            "Drives major global climate patterns like El Niño."
        ],
        example="Think of the Pacific as a gigantic thermal battery that stores and redistributes solar heat."
    )

    monkeypatch.setattr(gemini_client, "generate_structured", MagicMock(return_value=mock_result))

    response = client.post(
        "/qa",
        json={"question": "Which is the largest ocean?", "level": "intermediate"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["question"] == "Which is the largest ocean?"
    assert data["level"] == "intermediate"
    assert "Pacific Ocean" in data["answer"]
    assert len(data["key_points"]) == 3
    assert data["example"] is not None


def test_qa_empty_question_rejected(client: TestClient):
    """Test that empty or whitespace questions are rejected with 422."""
    response = client.post("/qa", json={"question": "   ", "level": "beginner"})
    assert response.status_code == 422
    assert response.json()["success"] is False
