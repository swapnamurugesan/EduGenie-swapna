"""Educational Quiz Generation and Validation Module."""

import logging
from typing import List
from pydantic import BaseModel, Field, ValidationError
from schemas import QuizQuestion, QuizRequest, QuizResponse
from ai_client import AIProviderError, gemini_client

logger = logging.getLogger("edugenie.quiz")


class _RawQuizOutput(BaseModel):
    questions: List[QuizQuestion] = Field(
        ...,
        description="Multiple choice questions with 4 distinct options each, 0-indexed correct answer, and explanation."
    )


def generate_quiz(request: QuizRequest) -> QuizResponse:
    """Generate requested number of validated multiple-choice questions with bounded repair."""
    count = request.num_questions
    system_instruction = (
        "You are EduGenie's quiz generation engine. Generate high-quality multiple choice quizzes for students.\n"
        "Strict Requirements:\n"
        f"1. Produce EXACTLY {count} questions.\n"
        "2. Each question MUST have EXACTLY 4 distinct, plausible options (options array of length 4).\n"
        "3. correct_option_index MUST be an integer between 0 and 3 referring to the 0-based index of the correct option.\n"
        "4. Include a clear, informative explanation for why the chosen option is correct.\n"
        "5. Calibrate difficulty strictly to the requested level (beginner, intermediate, advanced)."
    )

    base_prompt = (
        f"Difficulty: {request.difficulty}\n"
        f"Topic / Passage: {request.topic_or_passage}\n\n"
        f"Generate exactly {count} multiple choice questions following all schema requirements."
    )

    # Attempt 1: Standard structured generation
    max_attempts = 2
    last_error: str = ""

    for attempt in range(1, max_attempts + 1):
        prompt = base_prompt
        if attempt > 1:
            prompt += (
                f"\n\nCRITICAL FIX NEEDED: The previous attempt failed validation with error: {last_error}. "
                f"Ensure exactly {count} questions, exactly 4 unique options per question, and correct_option_index in [0, 1, 2, 3]."
            )

        try:
            raw_output = gemini_client.generate_structured(
                prompt=prompt,
                schema=_RawQuizOutput,
                system_instruction=system_instruction,
                temperature=0.3 if attempt == 1 else 0.1,
                max_output_tokens=max(2000, count * 500),
            )

            # Strict validation
            if len(raw_output.questions) != count:
                raise ValueError(f"Expected exactly {count} questions, got {len(raw_output.questions)}.")

            for i, q in enumerate(raw_output.questions):
                if len(q.options) != 4:
                    raise ValueError(f"Question {i+1} has {len(q.options)} options instead of 4.")
                if len(set(q.options)) != 4:
                    raise ValueError(f"Question {i+1} has duplicate options: {q.options}")
                if q.correct_option_index < 0 or q.correct_option_index > 3:
                    raise ValueError(f"Question {i+1} correct_option_index {q.correct_option_index} is out of bounds [0-3].")

            return QuizResponse(
                topic_or_passage=request.topic_or_passage,
                difficulty=request.difficulty,
                num_questions=count,
                questions=raw_output.questions,
            )

        except (ValueError, ValidationError, AIProviderError) as err:
            last_error = str(err)
            logger.warning("Quiz generation attempt %d failed: %s", attempt, last_error)
            if attempt == max_attempts:
                # If error was an AIProviderError (e.g. auth/quota), bubble it up
                if isinstance(err, AIProviderError):
                    raise
                raise AIProviderError(
                    message=f"Failed to generate a valid {count}-question quiz after repair attempt.",
                    code="QUIZ_VALIDATION_FAILED",
                    status_code=502,
                    details=last_error
                )

    raise AIProviderError(
        message="Unable to generate quiz at this time.",
        code="QUIZ_GENERATION_FAILED",
        status_code=502
    )
