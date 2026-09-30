"""Pydantic schemas for EduGenie request and response models."""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


# Common Types
LevelType = Literal["beginner", "intermediate", "advanced"]
SummaryLengthType = Literal["short", "medium", "detailed"]
SummaryFormatType = Literal["paragraph", "bullet_points"]


# ==========================================
# 1. Ask a Question (Q&A)
# ==========================================
class QARequest(BaseModel):
    question: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="The academic question to be answered",
        examples=["Which is the largest ocean?"]
    )
    level: LevelType = Field(
        default="intermediate",
        description="Target educational comprehension level"
    )

    @field_validator("question")
    @classmethod
    def validate_question_not_whitespace(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Question cannot be empty or whitespace only.")
        return v


class QAResponse(BaseModel):
    question: str
    level: str
    answer: str
    key_points: List[str] = Field(default_factory=list)
    example: Optional[str] = None


# ==========================================
# 2. Explain a Concept
# ==========================================
class ExplainRequest(BaseModel):
    topic: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="The concept or topic to explain",
        examples=["Pythagorean theorem"]
    )
    level: LevelType = Field(
        default="beginner",
        description="Target educational comprehension level"
    )

    @field_validator("topic")
    @classmethod
    def validate_topic_not_whitespace(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Topic cannot be empty or whitespace only.")
        return v


class ExplainResponse(BaseModel):
    topic: str
    level: str
    explanation: str
    analogy_or_example: str
    takeaway: str
    provider: str = Field(description="AI provider that generated this explanation ('gemini' or 'local')")


# ==========================================
# 3. Quiz Generation
# ==========================================
class QuizQuestion(BaseModel):
    question: str = Field(..., min_length=5, description="Question text")
    options: List[str] = Field(..., min_length=4, max_length=4, description="List of 4 distinct choices")
    correct_option_index: int = Field(..., ge=0, le=3, description="0-indexed index of correct choice")
    explanation: str = Field(..., min_length=3, description="Brief rationale for the correct answer")

    @field_validator("options")
    @classmethod
    def validate_options_distinct_and_nonempty(cls, opts: List[str]) -> List[str]:
        cleaned = [opt.strip() for opt in opts]
        if len(cleaned) != 4:
            raise ValueError("Each quiz question must have exactly 4 options.")
        if any(not opt for opt in cleaned):
            raise ValueError("Quiz options cannot be empty strings.")
        if len(set(cleaned)) != 4:
            raise ValueError("Quiz options must all be distinct from one another.")
        return cleaned

    @field_validator("question", "explanation")
    @classmethod
    def validate_text_nonempty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty or whitespace only.")
        return v


class QuizRequest(BaseModel):
    topic_or_passage: str = Field(
        ...,
        min_length=3,
        max_length=3000,
        description="Topic or educational text to generate quiz from",
        examples=["Photosynthesis and cellular respiration"]
    )
    difficulty: LevelType = Field(
        default="intermediate",
        description="Quiz difficulty level"
    )
    num_questions: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Configurable number of questions to generate (1 to 10)",
        examples=[3, 5, 10]
    )

    @field_validator("topic_or_passage")
    @classmethod
    def validate_input_not_whitespace(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Topic or passage cannot be empty or whitespace only.")
        return v


class QuizResponse(BaseModel):
    topic_or_passage: str
    difficulty: str
    num_questions: int = Field(default=3, description="Total number of questions in this quiz set")
    questions: List[QuizQuestion] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="Validated multiple choice questions"
    )

    @field_validator("questions")
    @classmethod
    def validate_questions_list(cls, v: List[QuizQuestion]) -> List[QuizQuestion]:
        if not v:
            raise ValueError("Quiz must contain at least 1 question.")
        return v


# ==========================================
# 4. Summarize Content
# ==========================================
class SummarizeRequest(BaseModel):
    passage: str = Field(
        ...,
        min_length=20,
        max_length=30000,
        description="Educational passage to summarize"
    )
    length: SummaryLengthType = Field(
        default="medium",
        description="Desired summary length: short, medium, or detailed"
    )
    format: SummaryFormatType = Field(
        default="paragraph",
        description="Output format: paragraph or bullet_points"
    )

    @field_validator("passage")
    @classmethod
    def validate_passage(cls, v: str) -> str:
        v = v.strip()
        words = v.split()
        if len(words) < 5:
            raise ValueError("Passage must contain at least 5 words to summarize.")
        if len(words) > 2500:
            raise ValueError(f"Passage exceeds maximum allowed length of 2500 words (provided: {len(words)}).")
        return v


class SummarizeResponse(BaseModel):
    summary: str
    original_word_count: int
    summary_word_count: int
    length: str
    format: str


# ==========================================
# 5. Personalized Learning Path
# ==========================================
class WeeklyScheduleItem(BaseModel):
    week_number: int = Field(..., ge=1)
    title: str = Field(..., min_length=2)
    focus_concepts: List[str] = Field(default_factory=list)
    practice_activities: List[str] = Field(default_factory=list)
    milestone_question: str = Field(default="")


class LearningPathRequest(BaseModel):
    topic: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Subject or skill to learn",
        examples=["Python for Data Science"]
    )
    current_level: LevelType = Field(
        default="beginner",
        description="Learner's current proficiency level"
    )
    goal: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="What the learner aims to accomplish",
        examples=["Build basic data visualization dashboards"]
    )
    daily_study_time: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Available daily study time (e.g., '30 mins/day', '1 hour')",
        examples=["45 minutes daily"]
    )
    duration_weeks: int = Field(
        default=4,
        ge=1,
        le=12,
        description="Estimated duration in weeks (1-12)"
    )

    @field_validator("topic", "goal", "daily_study_time")
    @classmethod
    def validate_nonempty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty or whitespace only.")
        return v


class LearningPathResponse(BaseModel):
    topic: str
    current_level: str
    goal: str
    estimated_duration_weeks: int
    overview: str
    prerequisites: List[str] = Field(default_factory=list)
    weekly_schedule: List[WeeklyScheduleItem] = Field(default_factory=list)
    final_project: str
    suggested_resources: List[str] = Field(
        default_factory=list,
        description="Curated search suggestions or topic references clearly labeled as estimates"
    )


# ==========================================
# Health & Error Models
# ==========================================
class HealthResponse(BaseModel):
    status: str
    api_key_configured: bool
    gemini_model: str
    explanation_provider: str
    local_model_loaded: bool
    timestamp: str


class ErrorDetails(BaseModel):
    code: str
    message: str
    details: Optional[str] = None


class StandardErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetails
