"""
Shared Anthropic API client for every agent that needs an LLM call
(triage, requirements extraction, pipeline intelligence, digest).
"""
import json
import os
import re
from typing import Optional

try:
    import anthropic
except ImportError:
    anthropic = None

CHEAP_MODEL = "claude-haiku-4-5-20251001"
STRONG_MODEL = "claude-sonnet-4-6"


def _get_client() -> "anthropic.Anthropic":
    if anthropic is None:
        raise ImportError(
            "The 'anthropic' package is not installed. Run: "
            "pip install anthropic --break-system-packages"
        )
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set.")
    return anthropic.Anthropic(api_key=api_key)


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"LLM response was not valid JSON after cleanup: {e}\n"
            f"Raw response (first 500 chars): {text[:500]}"
        )


def call_llm_json(system_prompt: str, user_content: str,
                   model: str = CHEAP_MODEL, max_tokens: int = 1024,
                   temperature: float = 0.0) -> dict:
    client = _get_client()
    response = client.messages.create(
        model=model, max_tokens=max_tokens, temperature=temperature,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    text = "".join(block.text for block in response.content if block.type == "text")
    return _extract_json(text)


def call_llm_text(system_prompt: str, user_content: str,
                   model: str = STRONG_MODEL, max_tokens: int = 4096,
                   temperature: float = 0.3) -> str:
    client = _get_client()
    response = client.messages.create(
        model=model, max_tokens=max_tokens, temperature=temperature,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    return "".join(block.text for block in response.content if block.type == "text")


def load_prompt(prompt_filename: str) -> str:
    path = os.path.join(os.path.dirname(__file__), "..", "prompts", prompt_filename)
    with open(path) as f:
        return f.read()
