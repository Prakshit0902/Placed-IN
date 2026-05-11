import json
import time
from typing import Any

from groq import Groq, RateLimitError

try:
    from google import genai
except ImportError:  # Gemini is an optional fallback
    genai = None

from cleaners.preprocessor import Preprocessor
from config import config

class LLMCleaner:
    def __init__(self):
        # Groq client
        self.groq_client = None
        if getattr(config, "GROQ_API_KEY", None):
            try:
                self.groq_client = Groq(api_key=config.GROQ_API_KEY)
            except Exception:
                pass

        # Gemini fallback
        self.gemini_client = None
        if genai and getattr(config, "GEMINI_API_KEY", None):
            try:
                self.gemini_client = genai.Client(api_key=config.GEMINI_API_KEY)
            except Exception:
                pass

        self.preprocessor = Preprocessor()
        self.available_model = getattr(config, "CLEANING_MODEL", "gemini-2.5-flash")

    def clean_batch(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Clean a batch of raw scraped records.
        Returns only records that were successfully cleaned.
        """
        cleaned = []

        for i, record in enumerate(records):
            print(f"[LLMCleaner] Cleaning record {i + 1}/{len(records)}")
            result = self._clean_single(record)
            if result:
                cleaned.append(result)
            time.sleep(0.5)

        print(
            f"[LLMCleaner] {len(cleaned)}/{len(records)} records cleaned successfully"
        )
        return cleaned

    def _clean_single(self, record: dict[str, Any]) -> dict[str, Any] | None:
        """
        Clean a single raw record.
        Tries models in this order:
        1. llama-3.3-70b-versatile (Groq) — best quality
        2. llama-3.1-8b-instant (Groq) — high RPD fallback
        3. gemini-2.5-flash — final fallback
        """
        raw_text = record.get("raw_text", "")

        # Basic preprocessing first
        cleaned_text = self.preprocessor.clean(raw_text)

        if not self.preprocessor.is_useful(cleaned_text):
            print(f"[LLMCleaner] Skipping — not useful: {record.get('url')}")
            return None

        cleaned_text = self.preprocessor.truncate(cleaned_text)
        prompt = self._build_prompt(cleaned_text, record)

        # Try each model in order
        result = (
            self._try_groq_primary(prompt)
            or self._try_groq_fallback(prompt)
            or self._try_gemini(prompt)
        )

        if not result:
            print(f"[LLMCleaner] All models failed for {record.get('url')}")
            return None

        # Merge with original metadata
        result["source"] = record.get("source", "unknown")
        result["url"] = record.get("url", "")
        result["company"] = result.get("company") or record.get("company", "Unknown")

        return result

    def _try_groq_primary(self, prompt: str) -> dict[str, Any] | None:
        """
        llama-3.3-70b-versatile — best quality, use first.
        Handles TPM limits with retries, and delegates to fallback on RPD limits.
        """
        if not self.groq_client: return None
        model = "llama-3.3-70b-versatile"
        return self._make_groq_call(model, prompt, is_primary=True)

    def _try_groq_fallback(self, prompt: str) -> dict[str, Any] | None:
        """
        llama-3.1-8b-instant — 14.4K RPD, use when 70B is rate limited.
        """
        if not self.groq_client: return None
        model = "llama-3.1-8b-instant"
        return self._make_groq_call(model, prompt, is_primary=False)

    def _make_groq_call(self, model: str, prompt: str, is_primary: bool) -> dict[str, Any] | None:
        """Helper to invoke Groq with retry logic for TPM limits."""
        for attempt in range(2): # Try up to 2 times to handle TPM wait
            try:
                response = self.groq_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=1024,
                )
                text = response.choices[0].message.content
                result = self._parse_response(text)
                if result:
                    print(f"[LLMCleaner] ✓ {model} {'(primary)' if is_primary else '(fallback)'}")
                return result

            except RateLimitError as e:
                headers = e.response.headers if hasattr(e, 'response') else {}
                
                rem_req = headers.get("x-ratelimit-remaining-requests")
                retry_after = headers.get("retry-after")
                
                print(f"[LLMCleaner] Rate limit hit on {model}.")
                
                # If RPD is exhausted, don't sleep for hours, just fallback
                if rem_req == "0" or rem_req == 0:
                    print(f"[LLMCleaner] {model} daily request limit (RPD) exhausted.")
                    return None # Fallback to next model
                
                # Otherwise, it's likely a TPM limit. We can wait `retry-after` and retry.
                if retry_after and attempt < 1:
                    wait_time = float(retry_after) + 1.0 # Add 1s buffer
                    print(f"[LLMCleaner] {model} limit hit. Waiting {wait_time:.2f}s before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    return None # Exceeded attempts or no retry-after 
                
            except Exception as e:
                print(f"[LLMCleaner] {model} failed: {e}")
                return None
        return None

    def _try_gemini(self, prompt: str) -> dict[str, Any] | None:
        """
        Gemini — final fallback when both Groq models are exhausted.
        """
        if not self.gemini_client: return None
        try:
            response = self.gemini_client.models.generate_content(
                model=self.available_model,
                contents=prompt,
            )
            result = self._parse_response(response.text)
            if result:
                print(f"[LLMCleaner] ✓ {self.available_model} (final fallback)")
            return result

        except Exception as e:
            print(f"[LLMCleaner] Gemini final fallback failed: {e}")
            if "quota" in str(e).lower() or "rate" in str(e).lower() or "429" in str(e):
                print("[LLMCleaner] Gemini rate limit hit as well.")
            return None

    def _build_prompt(self, text: str, record: dict[str, Any]) -> str:
        return f"""
You are a data cleaning assistant for a placement preparation platform.

Extract structured information from the following interview experience text.
Return ONLY a valid, complete JSON object with exactly these fields. No explanation, no markdown, just raw JSON.
IMPORTANT: Ensure all arrays and objects are properly closed. Never truncate or leave incomplete.

Fields to extract:
- company (string): Company name. Use "{record.get('company', 'Unknown')}" if not mentioned.
- role (string): Job role e.g. "SDE1", "SDE2", "Data Analyst". Use "SDE" if unclear.
- round (string): Interview round type. One of: "online assessment", "technical", "system design", "hr", "managerial", "unknown"
- questions (array of strings): List of actual interview questions mentioned (max 10). Keep each under 100 chars.
- difficulty (string): Overall difficulty. One of: "easy", "medium", "hard"
- outcome (string): Final result. One of: "selected", "rejected", "unknown"
- year (number): Year of interview if mentioned. Use 0 if not found.
- summary (string): 1-2 sentence summary (under 150 chars).
- topics (array of strings): DSA or CS topics covered e.g. ["arrays", "dynamic programming", "system design"] (max 5)

Text to extract from:
---
{text}
---

Return ONLY the complete, valid JSON object. Do not truncate. Ensure all brackets and braces are closed.
""".strip()

    def _parse_response(self, response_text: str) -> dict[str, Any] | None:
        if not response_text: return None
        text = response_text.strip()

        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()

        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            text = text[start:end]

        try:
            data = json.loads(text)
            return self._validate_parsed_data(data)
        except json.JSONDecodeError:
            print(f"[LLMCleaner] JSON parse failed, attempting recovery...")
            data = self._recover_truncated_json(text)
            if data:
                return self._validate_parsed_data(data)
            return None

    def _recover_truncated_json(self, text: str) -> dict[str, Any] | None:
        open_braces = text.count("{") - text.count("}")
        open_brackets = text.count("[") - text.count("]")

        if open_braces <= 0 and open_brackets <= 0:
            return None

        recovered = text
        if open_brackets > 0:
            recovered += "]" * open_brackets
        if open_braces > 0:
            recovered += "}" * open_braces

        try:
            data = json.loads(recovered)
            print(f"[LLMCleaner] Successfully recovered truncated JSON")
            return data
        except json.JSONDecodeError:
            last_close = text.rfind("}")
            if last_close > 0:
                recovered = text[:last_close+1]
                if open_brackets > 0:
                    recovered += "]" * open_brackets
                try:
                    data = json.loads(recovered)
                    print(f"[LLMCleaner] Recovered by truncating to last complete object")
                    return data
                except json.JSONDecodeError:
                    pass
            return None

    def _validate_parsed_data(self, data: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(data, dict):
            return None

        required = ["company", "role", "questions", "difficulty", "summary"]
        for field in required:
            if field not in data:
                print(f"[LLMCleaner] Missing required field: {field}")
                return None

        if not isinstance(data.get("questions"), list): data["questions"] = []
        if not isinstance(data.get("topics"), list): data["topics"] = []
        if data.get("year") is None: data["year"] = 0
        if data.get("outcome") not in ["selected", "rejected", "unknown"]: data["outcome"] = "unknown"
        if data.get("difficulty") not in ["easy", "medium", "hard"]: data["difficulty"] = "medium"
        if data.get("round") not in ["online assessment", "technical", "system design", "hr", "managerial", "unknown"]:
            data["round"] = "unknown"

        return data
