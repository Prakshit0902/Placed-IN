TOPIC_LEARNING_SEQUENCE = [
    "arrays", "strings", "math",
    "linked-list", "stack", "queue",
    "trees", "graphs", "heaps",
    "hash-table", "dynamic-programming",
    "bit-manipulation", "backtracking", "greedy",
    "design", "database", "system-design",
    "concurrency", "behavioral",
]

TOPIC_TO_TAGS = {
    "arrays": {"array"},
    "strings": {"string"},
    "math": {"math", "geometry"},
    "linked-list": {"linked-list"},
    "stack": {"stack"},
    "queue": {"queue"},
    "trees": {"tree", "binary-tree", "binary-search-tree"},
    "graphs": {"graph", "breadth-first-search", "depth-first-search"},
    "heaps": {"heap", "priority-queue"},
    "hash-table": {"hash-table"},
    "dynamic-programming": {"dynamic-programming", "memoization"},
    "bit-manipulation": {"bit-manipulation"},
    "backtracking": {"backtracking"},
    "greedy": {"greedy"},
    "design": {"design", "trie", "segment-tree"},
    "database": {"database"},
    "system-design": {"system-design"},
    "concurrency": {"concurrency"},
    "behavioral": {"behavioral"},
}

TAG_TO_TOPIC: dict[str, str] = {}
for topic, tags in TOPIC_TO_TAGS.items():
    for tag in tags:
        TAG_TO_TOPIC[tag] = topic

CF_TO_LC_TOPIC_MAP = {
    "dp": "dynamic-programming",
    "graphs": "graphs",
    "shortest paths": "graphs",
    "dfs and similar": "graphs",
    "trees": "trees",
    "binary search": "arrays",
    "data structures": "arrays",
    "two pointers": "arrays",
    "math": "math",
    "number theory": "math",
    "combinatorics": "math",
    "geometry": "math",
    "greedy": "greedy",
    "string suffix structures": "strings",
    "strings": "strings",
    "bitmasks": "bit-manipulation",
}

DURATION_CONFIG = {
    30: {
        "total_weeks": 5,
        "min_questions": 100,
        "max_questions": 120,
        "system_design_start_week": 4,
        "behavioral_start_week": 5,
        "difficulty_progression": [
            (0.85, 0.15, 0.00),
            (0.70, 0.30, 0.00),
            (0.50, 0.45, 0.05),
            (0.30, 0.55, 0.15),
            (0.20, 0.55, 0.25),
        ],
    },
    60: {
        "total_weeks": 9,
        "min_questions": 160,
        "max_questions": 200,
        "system_design_start_week": 6,
        "behavioral_start_week": 7,
        "difficulty_progression": [
            (0.90, 0.10, 0.00),
            (0.75, 0.25, 0.00),
            (0.60, 0.35, 0.05),
            (0.50, 0.45, 0.05),
            (0.35, 0.55, 0.10),
            (0.25, 0.60, 0.15),
            (0.15, 0.60, 0.25),
            (0.10, 0.60, 0.30),
            (0.10, 0.55, 0.35),
        ],
    },
    90: {
        "total_weeks": 13,
        "min_questions": 220,
        "max_questions": 260,
        "system_design_start_week": 8,
        "behavioral_start_week": 10,
        "difficulty_progression": [
            (0.90, 0.10, 0.00),
            (0.85, 0.15, 0.00),
            (0.75, 0.25, 0.00),
            (0.65, 0.30, 0.05),
            (0.55, 0.40, 0.05),
            (0.45, 0.50, 0.05),
            (0.35, 0.55, 0.10),
            (0.25, 0.60, 0.15),
            (0.20, 0.60, 0.20),
            (0.15, 0.60, 0.25),
            (0.10, 0.60, 0.30),
            (0.10, 0.55, 0.35),
            (0.10, 0.50, 0.40),
        ],
    },
}

QUESTIONS_PER_WEEK_TARGET = {30: 22, 60: 20, 90: 19}

OOPS_POOL = [
    {"id": 90001, "title": "Design Parking Lot", "slug": "design-parking-lot", "difficulty": "Medium", "topic_tags": ["oops"]},
    {"id": 90002, "title": "Design Movie Ticket Booking System", "slug": "design-movie-ticket-booking", "difficulty": "Medium", "topic_tags": ["oops"]},
    {"id": 90003, "title": "Design Vending Machine", "slug": "design-vending-machine", "difficulty": "Medium", "topic_tags": ["oops"]},
    {"id": 90004, "title": "Design Chess Game", "slug": "design-chess", "difficulty": "Hard", "topic_tags": ["oops"]},
    {"id": 90005, "title": "Design Library Management System", "slug": "design-library-management", "difficulty": "Easy", "topic_tags": ["oops"]},
    {"id": 90006, "title": "Design Blackjack Card Game", "slug": "design-blackjack", "difficulty": "Medium", "topic_tags": ["oops"]},
    {"id": 90007, "title": "Design Restaurant Management System", "slug": "design-restaurant-management", "difficulty": "Medium", "topic_tags": ["oops"]},
]

SYSTEM_DESIGN_POOL = [
    {"id": 91001, "title": "Design Rate Limiter", "slug": "design-rate-limiter", "difficulty": "Medium", "topic_tags": ["system-design"]},
    {"id": 91002, "title": "Design Key-Value Store", "slug": "design-key-value-store", "difficulty": "Hard", "topic_tags": ["system-design"]},
    {"id": 91003, "title": "Design TinyURL (URL Shortener)", "slug": "design-tinyurl", "difficulty": "Easy", "topic_tags": ["system-design"]},
    {"id": 91004, "title": "Design Web Crawler", "slug": "design-web-crawler", "difficulty": "Medium", "topic_tags": ["system-design"]},
    {"id": 91005, "title": "Design Notification System", "slug": "design-notification-system", "difficulty": "Medium", "topic_tags": ["system-design"]},
    {"id": 91006, "title": "Design Chat System", "slug": "design-chat-system", "difficulty": "Hard", "topic_tags": ["system-design"]},
    {"id": 91007, "title": "Design News Feed System", "slug": "design-news-feed", "difficulty": "Medium", "topic_tags": ["system-design"]},
    {"id": 91008, "title": "Design Search Autocomplete System", "slug": "design-search-autocomplete", "difficulty": "Hard", "topic_tags": ["system-design"]},
]

BEHAVIORAL_POOL = [
    {"id": 92001, "title": "Tell me about a time you had a conflict with a coworker", "slug": "behavioral-conflict", "difficulty": "Easy", "topic_tags": ["behavioral"]},
    {"id": 92002, "title": "Tell me about a challenging project you worked on", "slug": "behavioral-challenging-project", "difficulty": "Medium", "topic_tags": ["behavioral"]},
    {"id": 92003, "title": "Tell me about a time you made a mistake and how you handled it", "slug": "behavioral-mistake", "difficulty": "Easy", "topic_tags": ["behavioral"]},
    {"id": 92004, "title": "Tell me about a time you had to lead a project under tight deadlines", "slug": "behavioral-tight-deadlines", "difficulty": "Medium", "topic_tags": ["behavioral"]},
    {"id": 92005, "title": "Why do you want to join our company?", "slug": "behavioral-why-company", "difficulty": "Easy", "topic_tags": ["behavioral"]},
    {"id": 92006, "title": "Tell me about a time you had to convince others of your technical direction", "slug": "behavioral-persuasion", "difficulty": "Medium", "topic_tags": ["behavioral"]},
    {"id": 92007, "title": "Tell me about a time you went above and beyond for a customer", "slug": "behavioral-above-beyond", "difficulty": "Easy", "topic_tags": ["behavioral"]},
]
