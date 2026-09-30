"""Configuration settings for EduGenie."""

import os
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Gemini Cloud Settings
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key")
    GEMINI_MODEL: str = Field(default="gemini-3.1-flash-lite", description="Gemini model identifier")
    REQUEST_TIMEOUT_SECONDS: float = Field(default=30.0, description="Timeout for API requests")

    # Explanation Provider Settings
    EXPLANATION_PROVIDER: Literal["gemini", "local"] = Field(
        default="gemini",
        description="Provider for the /explain endpoint ('gemini' or 'local')"
    )
    LOCAL_MODEL_ID: str = Field(
        default="MBZUAI/LaMini-Flan-T5-783M",
        description="Hugging Face model ID for local explanations"
    )
    MAX_CONCURRENT_LOCAL_INFERENCE: int = Field(
        default=1,
        description="Max concurrent local inference tasks to prevent OOM"
    )

    # Content Limits
    MAX_QUESTION_LENGTH: int = Field(default=1000, description="Max characters for question")
    MAX_EXPLAIN_TOPIC_LENGTH: int = Field(default=500, description="Max characters for explain topic")
    MAX_SUMMARY_INPUT_WORDS: int = Field(default=2500, description="Max word count for summarizer")
    MAX_LEARNING_PATH_TOPIC_LENGTH: int = Field(default=500, description="Max characters for learning path topic")
    MAX_QUIZ_INPUT_LENGTH: int = Field(default=3000, description="Max characters for quiz topic or passage")

    # Rate limiting / demonstration settings
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, description="Simple in-memory rate limit per client")


settings = Settings()
