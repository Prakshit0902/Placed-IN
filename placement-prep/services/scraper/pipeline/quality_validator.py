import re
import hashlib
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Import the allowed sequence to check validity
from pipeline.topic_mapper import TOPIC_LEARNING_SEQUENCE


@dataclass
class QualityResult:
    passed: bool
    score: float          # 0.0 to 1.0
    rejection_reason: Optional[str] = None
    warnings: list[str] = None


class QualityValidator:
    """
    Validates question quality before embedding and Qdrant insertion.
    Minimum score of 0.5 required to pass.
    """
    
    MINIMUM_SCORE = 0.5
    MINIMUM_QUESTION_LENGTH = 10
    MAXIMUM_QUESTION_LENGTH = 700  # Bumped slightly in case GFG strings are longer
    
    VAGUE_PATTERNS = [
        r"^implement\s+a?\s+function$",
        r"^write\s+a?\s+program$",
        r"^solve\s+this$",
        r"^coding\s+question$",
        r"^algorithm\s+question$",
        r"^return\s+the\s+answer$"
    ]
    
    REQUIRED_FIELDS = [
        "company", "question_text", "source"
    ]
    
    def __init__(self):
        # Keeps track of content hashes within the current run to drop exact dupes
        self._seen_hashes = set()

    def validate(self, question: dict) -> QualityResult:
        score = 1.0
        warnings = []

        # Check 1: Required fields present
        for field in self.REQUIRED_FIELDS:
            if not question.get(field):
                return QualityResult(
                    passed=False,
                    score=0.0,
                    rejection_reason=f"Missing required field: {field}",
                    warnings=warnings
                )

        # Check 2: Question text length
        q_text = question["question_text"].strip()
        if len(q_text) < self.MINIMUM_QUESTION_LENGTH:
            return QualityResult(
                passed=False,
                score=0.0,
                rejection_reason=f"Question too short ({len(q_text)} chars)",
                warnings=warnings
            )

        if len(q_text) > self.MAXIMUM_QUESTION_LENGTH:
            score -= 0.1
            warnings.append("Question text is very long")

        # Check 3: Not vague
        for pattern in self.VAGUE_PATTERNS:
            if re.match(pattern, q_text.lower()):
                return QualityResult(
                    passed=False,
                    score=0.0,
                    rejection_reason="Question matches vague pattern",
                    warnings=warnings
                )

        # Check 4: Duplicate detection for the current batch/run
        content_hash = hashlib.md5(
            (q_text.lower() + question["company"].lower()).encode()
        ).hexdigest()

        if content_hash in self._seen_hashes:
            return QualityResult(
                passed=False,
                score=0.0,
                rejection_reason="Duplicate question content identified in this run",
                warnings=warnings
            )
        self._seen_hashes.add(content_hash)

        # Check 5: Difficulty is mostly valid (cap penalty instead of fail to preserve data)
        valid_difficulties = ["easy", "medium", "hard", "basic", "school"]
        diff = question.get("difficulty", "medium").lower()
        if diff not in valid_difficulties:
            score -= 0.1
            warnings.append(f"Invalid or missing difficulty: {diff}")

        # Check 6: Topics are valid
        valid_topics = set(TOPIC_LEARNING_SEQUENCE)
        question_topics = set(question.get("topics", []))
        unknown_topics = question_topics - valid_topics

        if not question_topics:
            score -= 0.2
            warnings.append("No topics tagged")
        elif unknown_topics:
            score -= 0.1
            warnings.append(f"Unknown topics: {unknown_topics}")

        # Check 7: URL presence
        if not question.get("question_url"):
            score -= 0.1
            warnings.append("No question URL")

        final_passed = score >= self.MINIMUM_SCORE

        return QualityResult(
            passed=final_passed,
            score=round(score, 2),
            rejection_reason=(
                f"Quality score too low: {score:.2f}" 
                if not final_passed else None
            ),
            warnings=warnings if warnings else None
        )
