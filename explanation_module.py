"""Concept Explanation Module supporting both Google Gemini and Local Transformer Inference."""

import asyncio
import logging
import threading
from typing import Optional
from pydantic import BaseModel, Field
from config import settings
from schemas import ExplainRequest, ExplainResponse
from ai_client import AIProviderError, gemini_client

logger = logging.getLogger("edugenie.explanation")


class _ExplainStructuredOutput(BaseModel):
    explanation: str = Field(..., description="Clear explanation of the concept in plain language")
    analogy_or_example: str = Field(..., description="An intuitive analogy or relatable real-world example")
    takeaway: str = Field(..., description="A short, memorable takeaway or summary rule")


class LocalExplanationEngine:
    """Manages lazy-loading and inference for MBZUAI/LaMini-Flan-T5-783M."""

    def __init__(self):
        self._model = None
        self._tokenizer = None
        self._load_lock = threading.Lock()
        self._inference_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_LOCAL_INFERENCE)

    def is_loaded(self) -> bool:
        return self._model is not None and self._tokenizer is not None

    def _load_model_sync(self):
        if self._model is not None and self._tokenizer is not None:
            return

        with self._load_lock:
            if self._model is not None and self._tokenizer is not None:
                return

            try:
                import torch
                from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            except ImportError as e:
                raise AIProviderError(
                    message="Local inference dependencies (torch, transformers) are not installed.",
                    code="LOCAL_DEPENDENCIES_MISSING",
                    status_code=503,
                    details="Install local dependencies using: pip install -r requirements-local.txt or switch EXPLANATION_PROVIDER=gemini in .env."
                )

            logger.info("Loading local model '%s'... This may take a moment on first download.", settings.LOCAL_MODEL_ID)
            try:
                self._tokenizer = AutoTokenizer.from_pretrained(settings.LOCAL_MODEL_ID)
                self._model = AutoModelForSeq2SeqLM.from_pretrained(
                    settings.LOCAL_MODEL_ID,
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=True
                )
                self._model.eval()
                logger.info("Local model '%s' successfully loaded and ready for inference.", settings.LOCAL_MODEL_ID)
            except Exception as e:
                logger.error("Failed to load local model: %s", str(e))
                raise AIProviderError(
                    message=f"Failed to load local model '{settings.LOCAL_MODEL_ID}'.",
                    code="LOCAL_MODEL_LOAD_FAILED",
                    status_code=500,
                    details=f"Ensure sufficient RAM and network connectivity for the initial download: {str(e)}"
                )

    def _run_inference_sync(self, prompt: str) -> str:
        self._load_model_sync()
        import torch

        inputs = self._tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
        with torch.no_grad():
            outputs = self._model.generate(
                **inputs,
                max_length=256,
                min_length=30,
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
                repetition_penalty=1.2,
            )
        output_text = self._tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
        return output_text

    async def explain(self, request: ExplainRequest) -> ExplainResponse:
        """Run bounded, non-blocking local model inference."""
        async with self._inference_semaphore:
            prompt = (
                f"Explain the concept of '{request.topic}' for a {request.level} student in simple terms, "
                f"providing an example and a key takeaway."
            )
            # Run in separate thread pool to prevent blocking asyncio event loop
            raw_result = await asyncio.to_thread(self._run_inference_sync, prompt)

            # Format the output into structured components
            return ExplainResponse(
                topic=request.topic,
                level=request.level,
                explanation=raw_result,
                analogy_or_example=f"Example context for {request.topic} at {request.level} level.",
                takeaway=f"Core concept: Master the fundamentals of {request.topic}.",
                provider="local"
            )


local_engine = LocalExplanationEngine()


def _explain_with_gemini(request: ExplainRequest) -> ExplainResponse:
    """Generate structured concept explanation via Google Gemini."""
    system_instruction = (
        "You are EduGenie's concept clarification tutor. Explain academic topics with crystal clarity.\n"
        "Always structure your output with:\n"
        "1. explanation: Plain-language, intuitive explanation matched to the learner level.\n"
        "2. analogy_or_example: An unforgettable everyday analogy or practical demonstration.\n"
        "3. takeaway: A crisp 1-sentence mental hook or summary principle."
    )

    prompt = (
        f"Concept/Topic: {request.topic}\n"
        f"Learner Level: {request.level}\n\n"
        f"Provide a clear, engaging explanation, an intuitive analogy or example, and a concise takeaway."
    )

    result = gemini_client.generate_structured(
        prompt=prompt,
        schema=_ExplainStructuredOutput,
        system_instruction=system_instruction,
        temperature=0.4,
        max_output_tokens=1500,
    )

    return ExplainResponse(
        topic=request.topic,
        level=request.level,
        explanation=result.explanation,
        analogy_or_example=result.analogy_or_example,
        takeaway=result.takeaway,
        provider="gemini"
    )


async def explain_concept(request: ExplainRequest) -> ExplainResponse:
    """Entrypoint to explain concept using configured provider."""
    provider = settings.EXPLANATION_PROVIDER.lower().strip()

    if provider == "local":
        return await local_engine.explain(request)
    elif provider == "gemini":
        return _explain_with_gemini(request)
    else:
        raise AIProviderError(
            message=f"Invalid EXPLANATION_PROVIDER '{provider}'. Must be 'gemini' or 'local'.",
            code="INVALID_PROVIDER_CONFIG",
            status_code=500
        )
