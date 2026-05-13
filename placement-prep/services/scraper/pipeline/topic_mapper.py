import re
from typing import List

# The source of truth for allowed topics
TOPIC_LEARNING_SEQUENCE = [
    "arrays", "strings", "math",
    "linked-list", "stack", "queue",
    "trees", "graphs", "heaps",
    "hash-table", "dynamic-programming",
    "bit-manipulation", "backtracking", "greedy",
    "design", "database", "system-design",
    "concurrency", "behavioral"
]

# Aliases used by GFG, LeetCode, etc. to map directly to our sequence
TOPIC_ALIASES = {
    "array": "arrays",
    "1d-array": "arrays",
    "2d-array": "arrays",
    "matrix": "arrays",
    "string": "strings",
    "maths": "math",
    "number-theory": "math",
    "linkedlist": "linked-list",
    "linked lists": "linked-list",
    "queues": "queue",
    "stacks": "stack",
    "tree": "trees",
    "binary-tree": "trees",
    "bst": "trees",
    "binary-search-tree": "trees",
    "graph": "graphs",
    "heap": "heaps",
    "priority-queue": "heaps",
    "hashmap": "hash-table",
    "hash-set": "hash-table",
    "hashing": "hash-table",
    "map": "hash-table",
    "dp": "dynamic-programming",
    "dynamic programming": "dynamic-programming",
    "bit-magic": "bit-manipulation",
    "recursion": "backtracking", # Approximation
    "design-pattern": "design",
    "oops": "design",
    "sql": "database",
    "system design": "system-design",
    "threads": "concurrency"
}

def normalize_topics(raw_topics: List[str]) -> List[str]:
    """
    Given a list of raw topic strings from a scraper,
    returns a deduplicated list of recognized, normalized topics.
    """
    normalized = set()
    
    for raw in raw_topics:
        # Lowercase, clean up whitespaces and basic punctuation
        clean = raw.lower().strip()
        clean = re.sub(r'[^a-z0-9\-]', '-', clean)
        clean = re.sub(r'-+', '-', clean).strip('-')
        
        # Check direct mapping
        if clean in TOPIC_LEARNING_SEQUENCE:
            normalized.add(clean)
            continue
            
        # Check aliases
        if clean in TOPIC_ALIASES:
            normalized.add(TOPIC_ALIASES[clean])
            continue
            
        # If it contains core keywords, do a fuzzy map
        for valid_topic in TOPIC_LEARNING_SEQUENCE:
            if valid_topic in clean:
                normalized.add(valid_topic)
                break
                
    return list(normalized)
