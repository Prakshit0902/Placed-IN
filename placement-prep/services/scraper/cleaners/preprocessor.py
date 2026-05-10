import re


class Preprocessor:
    """
    Basic text cleaning before sending to Gemini.
    Goal is to reduce token count and remove noise
    so the LLM cleaning step is cheaper and more accurate.
    """

    def clean(self, raw_text: str) -> str:
        text = raw_text

        # Remove HTML tags if any slipped through
        text = re.sub(r"<[^>]+>", " ", text)

        # Remove URLs
        text = re.sub(r"http[s]?://\S+", " ", text)

        # Remove email addresses
        text = re.sub(r"\S+@\S+\.\S+", " ", text)

        # Remove special characters but keep
        # punctuation useful for sentence structure
        text = re.sub(r"[^\w\s\.\,\?\!\:\;\-\(\)\'\"]", " ", text)

        # Remove repeated whitespace and newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" {2,}", " ", text)

        # Remove lines that are too short to be useful
        # e.g. nav links, breadcrumbs, single word lines
        lines = text.split("\n")
        lines = [line.strip() for line in lines if len(line.strip()) > 20]
        text = "\n".join(lines)

        # Remove common GFG boilerplate patterns
        boilerplate_patterns = [
            r"Attention reader.*?industry\.",
            r"Writing code in comment.*?more\.",
            r"Please write comments.*?below\.",
            r"Last Updated.*?\d{4}",
            r"Difficulty Level.*?\n",
            r"Article Tags.*?\n",
            r"Practice Tags.*?\n",
            r"Improve Article.*?\n",
            r"Save Article.*?\n",
            r"Like Article.*?\n",
            r"Report Issue.*?\n",
            r"Share your thoughts.*?\n",
            r"Vote for difficulty.*?\n",
            r"If you like GeeksforGeeks.*?\n",
        ]
        for pattern in boilerplate_patterns:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.DOTALL)

        # Final strip
        text = text.strip()

        return text

    def is_useful(self, text: str) -> bool:
        """
        Quick check to decide if cleaned text is
        worth sending to Gemini at all.
        Filters out pages that are mostly empty after cleaning.
        """
        if len(text) < 200:
            return False

        # Must mention at least one interview-related keyword
        keywords = [
            "interview",
            "round",
            "question",
            "experience",
            "offer",
            "coding",
            "technical",
            "hr",
            "role",
            "position",
            "selected",
            "rejected",
            "leetcode",
            "dsa",
            "system design",
        ]
        text_lower = text.lower()
        keyword_hits = sum(1 for kw in keywords if kw in text_lower)

        if keyword_hits < 2:
            return False

        return True

    def truncate(self, text: str, max_chars: int = 8000) -> str:
        """
        Truncate text to max_chars to stay within
        Gemini token limits for the cleaning prompt.
        Cuts at the last complete sentence within the limit.
        """
        if len(text) <= max_chars:
            return text

        truncated = text[:max_chars]
        last_period = truncated.rfind(".")
        if last_period > max_chars * 0.8:
            return truncated[: last_period + 1]

        return truncated