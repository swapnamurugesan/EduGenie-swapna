"""Centralized Google Gemini Client Integration and Error Handling."""

import json
import logging
from typing import Any, Dict, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError
from config import settings

# Setup lightweight logger
logger = logging.getLogger("edugenie.ai_client")

T = TypeVar("T", bound=BaseModel)


class AIProviderError(Exception):
    """Custom exception wrapper for AI provider errors."""
    def __init__(self, message: str, code: str = "AI_PROVIDER_ERROR", status_code: int = 502, details: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class GeminiClient:
    """Manager for Google Gemini API interactions using google-genai SDK."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
            raise AIProviderError(
                message="Gemini API Key is not configured. Please set GEMINI_API_KEY in your .env file.",
                code="API_KEY_MISSING",
                status_code=503,
                details="Add your Gemini API key to the .env file as GEMINI_API_KEY=your_key_here."
            )
        
        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
            except Exception as e:
                logger.error("Failed to initialize Google GenAI client: %s", str(e))
                raise AIProviderError(
                    message="Failed to initialize Gemini AI client.",
                    code="INITIALIZATION_ERROR",
                    status_code=500,
                    details=str(e)
                )
        return self._client

    def is_api_key_configured(self) -> bool:
        """Check if GEMINI_API_KEY is non-empty."""
        return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.5,
        max_output_tokens: int = 1500,
    ) -> str:
        """Generate text from Gemini with error mapping."""
        client = self._get_client()
        from google.genai import types

        try:
            config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                system_instruction=system_instruction,
            )

            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=config,
            )

            if not response or not response.text:
                raise AIProviderError(
                    message="Gemini returned an empty response. The content may have been filtered or blocked.",
                    code="EMPTY_OR_BLOCKED_RESPONSE",
                    status_code=502
                )
            return response.text.strip()

        except AIProviderError:
            raise
        except Exception as e:
            self._handle_gemini_exception(e)

    def generate_structured(
        self,
        prompt: str,
        schema: Type[T],
        system_instruction: Optional[str] = None,
        temperature: float = 0.3,
        max_output_tokens: int = 2000,
    ) -> T:
        """Generate structured output validated against a Pydantic model."""
        client = self._get_client()
        from google.genai import types

        try:
            config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=schema,
            )

            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=config,
            )

            if not response or not response.text:
                raise AIProviderError(
                    message="Gemini returned an empty structured response.",
                    code="EMPTY_STRUCTURED_RESPONSE",
                    status_code=502
                )

            raw_text = response.text.strip()
            
            # Parse JSON and validate with schema
            try:
                data = json.loads(raw_text)
                return schema.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as parse_err:
                logger.warning("Structured output validation failed: %s. Raw text: %s", str(parse_err), raw_text[:200])
                # Attempt fallback parsing if markdown fences exist
                cleaned_text = raw_text.replace("```json", "").replace("```", "").strip()
                try:
                    data = json.loads(cleaned_text)
                    return schema.model_validate(data)
                except Exception:
                    raise AIProviderError(
                        message="Failed to validate structured AI output.",
                        code="INVALID_STRUCTURED_OUTPUT",
                        status_code=502,
                        details=f"Model output did not match expected schema: {str(parse_err)}"
                    )

        except AIProviderError:
            raise
        except Exception as e:
            self._handle_gemini_exception(e)

    def _handle_gemini_exception(self, e: Exception) -> None:
        """Centralized mapping of Google Gemini exceptions to AIProviderError."""
        err_str = str(e)
        logger.error("Gemini API error encountered: %s", err_str)

        # Check for common error types / messages
        if "API_KEY_INVALID" in err_str or "invalid api key" in err_str.lower() or "unauthenticated" in err_str.lower():
            raise AIProviderError(
                message="Invalid Gemini API key. Please verify your GEMINI_API_KEY in the .env file.",
                code="AUTHENTICATION_FAILED",
                status_code=401,
                details="Ensure your Gemini API key from Google AI Studio is active and correctly pasted."
            )
        elif "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower() or "429" in err_str:
            raise AIProviderError(
                message="Gemini API rate limit or quota exceeded. Please wait a moment and try again.",
                code="QUOTA_EXHAUSTED",
                status_code=429,
                details="Your Google Gemini API quota or rate limit has been reached for this model."
            )
        elif "NOT_FOUND" in err_str or "model" in err_str.lower() and "not found" in err_str.lower():
            raise AIProviderError(
                message=f"Configured Gemini model '{settings.GEMINI_MODEL}' was not found or is unavailable.",
                code="MODEL_UNAVAILABLE",
                status_code=404,
                details="Check GEMINI_MODEL in your .env file (e.g., gemini-2.5-flash or gemini-2.0-flash)."
            )
        elif "DEADLINE_EXCEEDED" in err_str or "timeout" in err_str.lower():
            raise AIProviderError(
                message="Gemini API request timed out. Please try again.",
                code="REQUEST_TIMEOUT",
                status_code=504,
                details="The request took longer than expected to complete."
            )
        elif "SAFETY" in err_str or "blocked" in err_str.lower():
            raise AIProviderError(
                message="The response was blocked by safety filters.",
                code="CONTENT_BLOCKED",
                status_code=400,
                details="The prompt or generated content triggered educational safety standards."
            )
        else:
            raise AIProviderError(
                message="An unexpected error occurred while communicating with Google Gemini.",
                code="UPSTREAM_SERVICE_ERROR",
                status_code=502,
                details=err_str
            )


# Singleton instance
gemini_client = GeminiClient()
