"""Tests for Content Summarization module."""

from unittest.mock import MagicMock
from starlette.testclient import TestClient
from ai_client import gemini_client
from summary_module import _SummaryStructuredOutput


def test_summarize_content_success(client: TestClient, monkeypatch):
    """Test successful passage summarization with word count tracking."""
    passage = "Earth is the third planet from the Sun and the only astronomical object known to harbor life. This is enabled by Earth being a water world, the only one in the Solar System sustaining liquid surface water."
    
    mock_output = _SummaryStructuredOutput(
        summary="Earth is the third planet from the Sun and the only known world sustaining liquid surface water and life."
    )
    monkeypatch.setattr(gemini_client, "generate_structured", MagicMock(return_value=mock_output))

    response = client.post(
        "/summarize",
        json={"passage": passage, "length": "short", "format": "paragraph"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["original_word_count"] > 25
    assert data["summary_word_count"] > 10
    assert data["length"] == "short"
    assert data["format"] == "paragraph"
    assert "Earth" in data["summary"]


def test_summarize_under_length_rejected(client: TestClient):
    """Test that passages with fewer than 5 words are rejected with 422."""
    response = client.post(
        "/summarize",
        json={"passage": "Too short text.", "length": "medium", "format": "paragraph"}
    )
    assert response.status_code == 422
    assert response.json()["success"] is False


def test_summarize_oversized_passage_rejected(client: TestClient):
    """Test that passages exceeding 2500 words are rejected with 422."""
    long_passage = " ".join(["knowledge"] * 2550)
    response = client.post(
        "/summarize",
        json={"passage": long_passage, "length": "medium", "format": "paragraph"}
    )
    assert response.status_code == 422
    assert "2500 words" in response.json()["error"]["message"]
