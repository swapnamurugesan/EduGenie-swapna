"""Tests for Interactive Quiz Generation and Validation module."""

from unittest.mock import MagicMock
from starlette.testclient import TestClient
from ai_client import gemini_client
from quiz_module import _RawQuizOutput
from schemas import QuizQuestion


def test_quiz_generation_successful_3_questions(client: TestClient, monkeypatch):
    """Test generating exactly 3 valid multiple choice questions with distinct options."""
    mock_questions = [
        QuizQuestion(
            question="What is the primary light-absorbing pigment in plant leaves?",
            options=["Chlorophyll a", "Carotenoid", "Anthocyanin", "Hemoglobin"],
            correct_option_index=0,
            explanation="Chlorophyll a is the primary pigment responsible for absorbing light energy during photosynthesis."
        ),
        QuizQuestion(
            question="In which cellular organelle does cellular respiration take place in eukaryotes?",
            options=["Nucleus", "Mitochondria", "Ribosome", "Endoplasmic reticulum"],
            correct_option_index=1,
            explanation="Mitochondria are known as the powerhouses of the cell where ATP is generated via respiration."
        ),
        QuizQuestion(
            question="What gas is released as a byproduct during photosynthesis?",
            options=["Carbon dioxide", "Nitrogen", "Oxygen", "Methane"],
            correct_option_index=2,
            explanation="Water molecules are split during light reactions, releasing oxygen gas."
        ),
    ]
    mock_output = _RawQuizOutput(questions=mock_questions)
    monkeypatch.setattr(gemini_client, "generate_structured", MagicMock(return_value=mock_output))

    response = client.post(
        "/quiz",
        json={"topic_or_passage": "Photosynthesis and cellular respiration", "difficulty": "intermediate"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["questions"]) == 3
    for q in data["questions"]:
        assert len(q["options"]) == 4
        assert len(set(q["options"])) == 4  # All distinct
        assert 0 <= q["correct_option_index"] <= 3
        assert len(q["explanation"]) > 5


def test_quiz_repair_retry_on_invalid_initial_output(client: TestClient, monkeypatch):
    """Test that if the first attempt produces invalid options, repair retry recovers with valid questions."""
    # First attempt: only 2 questions (invalid)
    invalid_output = _RawQuizOutput(questions=[
        QuizQuestion(
            question="Sample Q1?",
            options=["A", "B", "C", "D"],
            correct_option_index=0,
            explanation="Exp 1"
        ),
        QuizQuestion(
            question="Sample Q2?",
            options=["A", "B", "C", "D"],
            correct_option_index=1,
            explanation="Exp 2"
        ),
    ])

    # Second attempt (after repair feedback): exactly 3 valid questions
    valid_output = _RawQuizOutput(questions=[
        QuizQuestion(
            question="Sample Q1?",
            options=["A1", "B1", "C1", "D1"],
            correct_option_index=0,
            explanation="Exp 1"
        ),
        QuizQuestion(
            question="Sample Q2?",
            options=["A2", "B2", "C2", "D2"],
            correct_option_index=1,
            explanation="Exp 2"
        ),
        QuizQuestion(
            question="Sample Q3?",
            options=["A3", "B3", "C3", "D3"],
            correct_option_index=2,
            explanation="Exp 3"
        ),
    ])

    # Mock sequence of returns
    mock_generate = MagicMock(side_effect=[invalid_output, valid_output])
    monkeypatch.setattr(gemini_client, "generate_structured", mock_generate)

    response = client.post(
        "/quiz",
        json={"topic_or_passage": "Quantum mechanics basics", "difficulty": "advanced"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["questions"]) == 3
    assert mock_generate.call_count == 2


def test_quiz_generation_configurable_question_count(client: TestClient, monkeypatch):
    """Test generating a user-configured number of questions (e.g. 5 questions)."""
    mock_questions = [
        QuizQuestion(
            question=f"Sample Question {i}?",
            options=[f"Option {i}-A", f"Option {i}-B", f"Option {i}-C", f"Option {i}-D"],
            correct_option_index=i % 4,
            explanation=f"Explanation for question {i}"
        )
        for i in range(1, 6)
    ]
    mock_output = _RawQuizOutput(questions=mock_questions)
    monkeypatch.setattr(gemini_client, "generate_structured", MagicMock(return_value=mock_output))

    response = client.post(
        "/quiz",
        json={
            "topic_or_passage": "Computer Science Algorithms",
            "difficulty": "advanced",
            "num_questions": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["num_questions"] == 5
    assert len(data["questions"]) == 5
    for q in data["questions"]:
        assert len(q["options"]) == 4
        assert len(set(q["options"])) == 4

