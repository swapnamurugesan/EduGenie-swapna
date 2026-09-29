"""Educational Content Summarization Module."""

from pydantic import BaseModel, Field
from schemas import SummarizeRequest, SummarizeResponse
from ai_client import gemini_client


class _SummaryStructuredOutput(BaseModel):
    summary: str = Field(..., description="Educational summary faithfully preserving core ideas and facts")


def summarize_content(request: SummarizeRequest) -> SummarizeResponse:
    """Summarize educational text with faithful preservation of facts and word counts."""
    original_words = len(request.passage.split())

    length_guidance = {
        "short": "Keep the summary very concise (around 15-25% of original length). Focus only on the core takeaway.",
        "medium": "Provide a balanced summary (around 30-45% of original length) covering main themes and critical supporting details.",
        "detailed": "Provide a thorough summary (around 50-60% of original length) covering main themes, supporting arguments, and specific evidence or facts."
    }.get(request.length, "Provide a balanced summary.")

    format_guidance = (
        "Output the summary as 1-3 well-structured, cohesive paragraphs."
        if request.format == "paragraph"
        else "Output the summary as a clear, structured list of bullet points with key headings if helpful."
    )

    system_instruction = (
        "You are EduGenie's academic summarization engine. Your role is to condense educational passages "
        "while strictly preserving essential facts, definitions, and arguments.\n"
        "Guidelines:\n"
        "- Do NOT introduce hallucinated facts, personal opinions, or outside information not grounded in the passage.\n"
        f"- Format: {format_guidance}\n"
        f"- Length: {length_guidance}"
    )

    prompt = (
        f"Format Style: {request.format}\n"
        f"Length Target: {request.length}\n\n"
        f"Educational Passage to Summarize:\n\"\"\"\n{request.passage}\n\"\"\"\n\n"
        f"Generate the faithful summary now."
    )

    result = gemini_client.generate_structured(
        prompt=prompt,
        schema=_SummaryStructuredOutput,
        system_instruction=system_instruction,
        temperature=0.3,
        max_output_tokens=1500,
    )

    summary_words = len(result.summary.split())

    return SummarizeResponse(
        summary=result.summary,
        original_word_count=original_words,
        summary_word_count=summary_words,
        length=request.length,
        format=request.format,
    )
