"""Tests for Personalized Learning Path module."""

from unittest.mock import MagicMock
from starlette.testclient import TestClient
from ai_client import gemini_client
from learning_path import _LearningPathStructuredOutput
from schemas import WeeklyScheduleItem


def test_learning_path_generation_success(client: TestClient, monkeypatch):
    """Test generating a structured weekly learning path with realistic scope."""
    mock_output = _LearningPathStructuredOutput(
        overview="A 4-week fast-track curriculum to master Python fundamentals and data analysis.",
        prerequisites=["Basic computer literacy", "Problem-solving mindset"],
        weekly_schedule=[
            WeeklyScheduleItem(
                week_number=1,
                title="Python Syntax & Control Flow",
                focus_concepts=["Variables", "Loops", "Functions"],
                practice_activities=["Write 5 interactive CLI scripts"],
                milestone_question="Can you implement a function to parse CSV rows without external libraries?"
            ),
            WeeklyScheduleItem(
                week_number=2,
                title="Data Structures & File I/O",
                focus_concepts=["Lists", "Dictionaries", "File handling"],
                practice_activities=["Build a student grade management script"],
                milestone_question="How do you handle JSON data ingestion?"
            ),
        ],
        final_project="Develop an automated CSV data cleaner and visualization generator.",
        suggested_resources=[
            "Official Python 3 Documentation Tutorial",
            "Open source Pandas cheatsheet",
            "Data analysis practice notebooks on Kaggle"
        ]
    )
    monkeypatch.setattr(gemini_client, "generate_structured", MagicMock(return_value=mock_output))

    response = client.post(
        "/learn/recommendations",
        json={
            "topic": "Python for Data Science",
            "current_level": "beginner",
            "goal": "Build data analysis pipelines",
            "daily_study_time": "45 minutes / day",
            "duration_weeks": 4
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["topic"] == "Python for Data Science"
    assert data["estimated_duration_weeks"] == 4
    assert len(data["weekly_schedule"]) == 2
    assert "prerequisites" in data
    assert "final_project" in data
    assert len(data["suggested_resources"]) == 3


def test_learning_path_duration_bounds_validation(client: TestClient):
    """Test that duration_weeks must be between 1 and 12."""
    # 0 weeks should be rejected
    r1 = client.post(
        "/learn/recommendations",
        json={
            "topic": "Math",
            "current_level": "beginner",
            "goal": "Calculus",
            "daily_study_time": "30 mins",
            "duration_weeks": 0
        }
    )
    assert r1.status_code == 422

    # 15 weeks (> 12) should be rejected
    r2 = client.post(
        "/learn/recommendations",
        json={
            "topic": "Math",
            "current_level": "beginner",
            "goal": "Calculus",
            "daily_study_time": "30 mins",
            "duration_weeks": 15
        }
    )
    assert r2.status_code == 422
