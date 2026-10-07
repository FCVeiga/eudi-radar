"""
Shared OpenAI client for every agent that needs an LLM call
(triage, requirements extraction, pipeline intelligence, digest).
"""
import json
import os
import re

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

CHEAP_MODEL = "gpt-6-luna"      # high-volume triage and translation
STRONG_MODEL = "gpt-6.1-sol"    # requirements and longer analysis
WRITER_MODEL = "gpt-6-astra"    # feed copy: quality matters, volume is small


def _get_client() -> "OpenAI":
    if OpenAI is None:
        raise ImportError("The 'openai' package is not installed. Run: pip install openai")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key)


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        start = text.find("{")
        obj, _ = json.JSONDecoder().raw_decode(text[start if start >= 0 else 0:])
        return obj
    except json.JSONDecodeError as e:
        raise ValueError(
            f"LLM response was not valid JSON after cleanup: {e}\n"
            f"Raw response (first 500 chars): {text[:500]}"
        )


def _text(response) -> str:
    for item in getattr(response, "output", None) or []:
        if getattr(item, "type", None) != "message":
            continue
        for part in getattr(item, "content", None) or []:
            if getattr(part, "type", None) == "refusal":
                raise ValueError(f"Model declined the request ({getattr(part, 'refusal', '')})")
    return getattr(response, "output_text", None) or ""


def _complete(system_prompt: str, user_content: str, model: str, max_tokens: int, effort: str) -> str:
    client = _get_client()
    response = client.responses.create(
        model=model,
        instructions=system_prompt,
        input=user_content,
        max_output_tokens=max_tokens,
        reasoning={"effort": effort},
    )
    return _text(response)


def call_llm_json(system_prompt: str, user_content: str,
                   model: str = CHEAP_MODEL, max_tokens: int = 1024) -> dict:
    return _extract_json(_complete(system_prompt, user_content, model, max_tokens, "low"))


def call_llm_json_premium(system_prompt: str, user_content: str,
                          model: str = WRITER_MODEL, max_tokens: int = 4000,
                          effort: str = "low") -> dict:
    """Stronger model for feed copy and tender analysis. `effort` is the
    reasoning dial (low, medium, high)."""
    return _extract_json(_complete(system_prompt, user_content, model, max_tokens, effort))


def call_llm_text(system_prompt: str, user_content: str,
                   model: str = STRONG_MODEL, max_tokens: int = 4096) -> str:
    return _complete(system_prompt, user_content, model, max_tokens, "low")


def load_prompt(prompt_filename: str) -> str:
    """The prompt file, or its fine-tuned version from the Settings page
    (services/agent_settings.py), with the search scope applied."""
    from services.agent_settings import prompt_for
    path = os.path.join(os.path.dirname(__file__), "..", "prompts", prompt_filename)
    with open(path) as f:
        return prompt_for(prompt_filename, f.read())
