"""Academic Question & Answer Module."""

from typing import List, Optional
from pydantic import BaseModel, Field
from schemas import QARequest, QAResponse
from ai_client import gemini_client


class _QAStructuredOutput(BaseModel):
    answer: str = Field(..., description="Main comprehensive yet clear academic answer")
    key_points: List[str] = Field(default_factory=list, description="3 to 5 key educational takeaways or facts")
    example: Optional[str] = Field(None, description="A practical, real-world example or illustration if helpful")


def answer_question(request: QARequest) -> QAResponse:
    """Generate an academic answer adjusted to the learner's comprehension level."""
    system_instruction = (
        "You are EduGenie, an expert academic tutor. Provide accurate, clear, and educational answers. "
        "Adapt your language, terminology, and depth strictly to the user's requested learning level:\n"
        "- beginner: Simple language, everyday analogies, no heavy jargon.\n"
        "- intermediate: Standard high-school/undergraduate depth, balanced terminology.\n"
        "- advanced: Rigorous, technical, in-depth academic explanation.\n"
        "If factual information is uncertain or unknown, acknowledge it directly rather than inventing details."
    )

    prompt = (
        f"Learning Level: {request.level}\n"
        f"Question: {request.question}\n\n"
        f"Please provide an accurate academic response with key takeaways and an illustrative example if applicable."
    )

    result = gemini_client.generate_structured(
        prompt=prompt,
        schema=_QAStructuredOutput,
        system_instruction=system_instruction,
        temperature=0.4,
        max_output_tokens=1500,
    )

    return QAResponse(
        question=request.question,
        level=request.level,
        answer=result.answer,
        key_points=result.key_points,
        example=result.example,
    )
