"""Personalized Learning Path Recommendation Module."""

from typing import List
from pydantic import BaseModel, Field
from schemas import LearningPathRequest, LearningPathResponse, WeeklyScheduleItem
from ai_client import gemini_client


class _LearningPathStructuredOutput(BaseModel):
    overview: str = Field(..., description="Concise overview of the learning journey tailored to the goal and time budget")
    prerequisites: List[str] = Field(default_factory=list, description="Foundational concepts or tools recommended before starting")
    weekly_schedule: List[WeeklyScheduleItem] = Field(..., description="Ordered week-by-week curriculum matching requested duration")
    final_project: str = Field(..., description="A hands-on capstone project or synthesis exercise to demonstrate mastery")
    suggested_resources: List[str] = Field(
        default_factory=list,
        description="Curated search queries, topic keywords, or open educational resource types (clearly labeled as suggested directions, not verified links)"
    )


def generate_learning_path(request: LearningPathRequest) -> LearningPathResponse:
    """Generate a structured, realistic personalized learning curriculum."""
    system_instruction = (
        "You are EduGenie's curriculum designer. Create structured, highly realistic learning paths for students.\n"
        "Guidelines:\n"
        f"- Target weekly duration: Exactly {request.duration_weeks} week(s).\n"
        f"- Respect daily study budget: {request.daily_study_time}.\n"
        f"- Tailor starting depth to current level: {request.current_level}.\n"
        "- Scope must be achievable within the specified time budget without overloading the student.\n"
        "- Resource recommendations must NOT fabricate unverified URLs or fake author names. Suggest well-known open topic keywords, official documentation subjects, or search terms."
    )

    prompt = (
        f"Topic: {request.topic}\n"
        f"Current Level: {request.current_level}\n"
        f"Learning Goal: {request.goal}\n"
        f"Daily Study Time: {request.daily_study_time}\n"
        f"Target Duration: {request.duration_weeks} week(s)\n\n"
        f"Generate an ordered weekly curriculum from Week 1 to Week {request.duration_weeks} with clear milestones and a final project."
    )

    result = gemini_client.generate_structured(
        prompt=prompt,
        schema=_LearningPathStructuredOutput,
        system_instruction=system_instruction,
        temperature=0.4,
        max_output_tokens=2500,
    )

    return LearningPathResponse(
        topic=request.topic,
        current_level=request.current_level,
        goal=request.goal,
        estimated_duration_weeks=request.duration_weeks,
        overview=result.overview,
        prerequisites=result.prerequisites,
        weekly_schedule=result.weekly_schedule,
        final_project=result.final_project,
        suggested_resources=result.suggested_resources,
    )
