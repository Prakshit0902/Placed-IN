import json
import time
from typing import Any

from groq import Groq

try:
    from google import genai
except ImportError:  # Gemini is an optional fallback
    genai = None

from cleaners.preprocessor import Preprocessor
from config import config


class LLMCleaner:
    def __init__(self):
        # Primary: Groq client (uses env var GROQ_API_KEY if not provided)
        try:
            self.groq = Groq(api_key=config.GROQ_API_KEY)
        except Exception:
            self.groq = None

        # Optional Gemini fallback
        self.gemini = None
        if genai and getattr(config, "GEMINI_API_KEY", None):
            try:
                self.gemini = genai.Client(api_key=config.GEMINI_API_KEY)
            except Exception:
                self.gemini = None

        self.preprocessor = Preprocessor()
        self.available_model = config.CLEANING_MODEL  # for Gemini fallback
        if self.gemini:
            self._fetch_available_model()

    def _fetch_available_model(self):
        """Try to determine an available Gemini model for content generation."""
        try:
            # List available models and pick the first base model that supports generateContent
            for model in self.gemini.models.list(config={'query_base': True}):
                if 'generate' in model.name.lower() or 'gemini' in model.name.lower():
                    self.available_model = model.name
                    print(f"[LLMCleaner] Using available model: {self.available_model}")
                    return
        except Exception as e:
            print(f"[LLMCleaner] Could not fetch available models: {e}, using configured model")
            self.available_model = config.CLEANING_MODEL

    def clean_batch(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Clean a batch of raw scraped records.
        Returns only the records that were successfully cleaned.
        """
        cleaned = []

        for i, record in enumerate(records):
            print(f"[LLMCleaner] Cleaning record {i + 1}/{len(records)}")
            result = self._clean_single(record)
            if result:
                cleaned.append(result)

            # Avoid hitting Gemini rate limits
            if i < len(records) - 1:
                time.sleep(1.0)

        print(f"[LLMCleaner] {len(cleaned)}/{len(records)} records cleaned successfully")
        return cleaned

    def _clean_single(self, record: dict[str, Any]) -> dict[str, Any] | None:
        """
        Clean a single raw record using Gemini.
        Returns structured dict or None if cleaning failed.
        """
        raw_text = record.get("raw_text", "")

        # Step 1: Basic preprocessing
        cleaned_text = self.preprocessor.clean(raw_text)

        # Step 2: Check if worth sending to Gemini
        if not self.preprocessor.is_useful(cleaned_text):
            print(f"[LLMCleaner] Skipping — not useful enough: {record.get('url')}")
            return None

        # Step 3: Truncate to stay within token limits
        cleaned_text = self.preprocessor.truncate(cleaned_text)

        # Step 4: Send to Groq primary
        prompt = self._build_prompt(cleaned_text, record)

        # Try Groq first
        if self.groq:
            try:
                completion = self.groq.chat.completions.create(
                    model=config.GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                )
                # Extract text from response
                text = None
                try:
                    text = completion.choices[0].message.content
                except Exception:
                    # fallback to raw string if structure differs
                    text = str(completion)

                result = self._parse_response(text)
                if result:
                    result["source"] = record.get("source", "unknown")
                    result["url"] = record.get("url", "")
                    result["company"] = result.get("company") or record.get("company", "Unknown")
                    return result
            except Exception as e:
                print(f"[LLMCleaner] Groq call failed for {record.get('url')}: {e}")

        # Groq failed or not configured — try Gemini fallback if available
        if self.gemini:
            try:
                response = self.gemini.models.generate_content(
                    model=self.available_model,
                    contents=prompt,
                )
                result = self._parse_response(response.text)
                if result:
                    result["source"] = record.get("source", "unknown")
                    result["url"] = record.get("url", "")
                    result["company"] = result.get("company") or record.get("company", "Unknown")
                    return result
            except Exception as e:
                error_msg = str(e)
                # Handle 404 Not Found for model by attempting to discover a different Gemini model
                if "404" in error_msg or "not found" in error_msg.lower():
                    print(f"[LLMCleaner] Model '{self.available_model}' not found, attempting to find available model")
                    self._fetch_available_model()
                    try:
                        response = self.gemini.models.generate_content(
                            model=self.available_model,
                            contents=prompt,
                        )
                        result = self._parse_response(response.text)
                        if result:
                            result["source"] = record.get("source", "unknown")
                            result["url"] = record.get("url", "")
                            result["company"] = result.get("company") or record.get("company", "Unknown")
                            return result
                    except Exception as retry_e:
                        print(f"[LLMCleaner] Gemini retry failed for {record.get('url')}: {retry_e}")
                else:
                    print(f"[LLMCleaner] Gemini call failed for {record.get('url')}: {e}")

        # All attempts failed
        return None

    def _ollama_generate(self, prompt: str, timeout: int = 60) -> str | None:
        """
        Generate text using Ollama. Try HTTP API first if enabled, else use CLI.
        Returns raw text or None.
        """
        model = config.OLLAMA_MODEL
        # If the configured model name may not match installed naming, try to map it
        try:
            ls = subprocess.run(
                ["ollama", "ls"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=10,
            )
            if ls.returncode == 0:
                # Parse first column names from output lines
                available = []
                for line in ls.stdout.splitlines()[2:]:
                    parts = line.split()
                    if parts:
                        available.append(parts[0])
                # Try direct match or substring match
                if model not in available:
                    for a in available:
                        if model in a or a in model or model.replace("-", ":") in a:
                            print(f"[LLMCleaner] Mapping configured Ollama model '{model}' -> '{a}'")
                            model = a
                            break
        except Exception:
            # If listing fails, fall back to configured model name
            pass
        # HTTP path
        if config.OLLAMA_USE_HTTP:
            try:
                http_url = config.OLLAMA_HTTP_URL or f"http://{config.OLLAMA_HOST}/api/generate"
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "max_tokens": config.OLLAMA_MAX_NEW_TOKENS,
                }
                # Use configured HTTP timeout if provided, else fall back to the passed timeout
                http_timeout = getattr(config, "OLLAMA_HTTP_TIMEOUT", timeout) or timeout
                resp = requests.post(http_url, json=payload, timeout=http_timeout)
                if resp.status_code == 200:
                    # Assume the API returns plain text or a JSON with 'text'
                    try:
                        j = resp.json()
                        return j.get("text") or j.get("output") or json.dumps(j)
                    except Exception:
                        return resp.text
                else:
                    print(f"[LLMCleaner] Ollama HTTP responded {resp.status_code}: {resp.text}")
            except Exception as e:
                print(f"[LLMCleaner] Ollama HTTP call failed: {e}")

        # CLI path — try a few common flag variants for different Ollama versions
        try:
            # Try positional prompt usage (supported by current Ollama CLI).
            # Prefer JSON format if available to simplify parsing.
            cmd_variants = [
                ["ollama", "run", model, prompt, "--format", "json"],
                ["ollama", "run", model, prompt],
            ]

            for cmd in cmd_variants:
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=max(timeout, 180),
                )
                if proc.returncode == 0:
                    return proc.stdout.strip()

                # If the CLI complains about an unknown flag, try the next variant
                stderr = (proc.stderr or "").lower()
                if "unknown flag" in stderr or "unknown option" in stderr or "unrecognized" in stderr:
                    # try next variant
                    continue
                else:
                    # non-flag related error — surface and stop trying
                    print(f"[LLMCleaner] Ollama CLI failed ({proc.returncode}): {proc.stderr}")
                    break

        except FileNotFoundError:
            print("[LLMCleaner] Ollama CLI not found on PATH")
        except Exception as e:
            print(f"[LLMCleaner] Ollama CLI call failed: {e}")

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
        """
        Parse Gemini response into a clean dict.
        Handles cases where Gemini wraps JSON in markdown code blocks or truncates JSON.
        """
        text = response_text.strip()

        # Strip markdown code block if present
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first and last lines (``` markers)
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()

        # Try to parse as-is first
        try:
            data = json.loads(text)
            return self._validate_parsed_data(data)
        except json.JSONDecodeError:
            # If standard parse fails, try to recover from truncation
            print(f"[LLMCleaner] JSON parse failed, attempting recovery...")
            data = self._recover_truncated_json(text)
            if data:
                return self._validate_parsed_data(data)
            return None

    def _recover_truncated_json(self, text: str) -> dict[str, Any] | None:
        """
        Attempt to recover from truncated JSON by finding the last complete key-value pair
        and closing the structure properly.
        """
        # Count open and close braces
        open_braces = text.count("{") - text.count("}")
        open_brackets = text.count("[") - text.count("]")

        if open_braces <= 0 and open_brackets <= 0:
            # Not a truncation issue
            return None

        # Try to close the JSON properly
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
            # Last resort: find the last complete JSON object by looking for the last "},"
            # and trying to close from there
            last_close = text.rfind("}")
            if last_close > 0:
                # Try closing from the last object
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
        """Validate and sanitize parsed JSON data."""
        if not isinstance(data, dict):
            return None

        # Validate required fields exist
        required = ["company", "role", "questions", "difficulty", "summary"]
        for field in required:
            if field not in data:
                print(f"[LLMCleaner] Missing required field: {field}")
                return None

        # Sanitize fields
        if not isinstance(data.get("questions"), list):
            data["questions"] = []

        if not isinstance(data.get("topics"), list):
            data["topics"] = []

        if data.get("year") is None:
            data["year"] = 0

        if data.get("outcome") not in ["selected", "rejected", "unknown"]:
            data["outcome"] = "unknown"

        if data.get("difficulty") not in ["easy", "medium", "hard"]:
            data["difficulty"] = "medium"

        if data.get("round") not in [
            "online assessment",
            "technical",
            "system design",
            "hr",
            "managerial",
            "unknown",
        ]:
            data["round"] = "unknown"

        return data