import os
import json
import math
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv("../../apps/api/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials. Make sure ../../apps/api/.env is set correctly.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print("Supabase Client initialized successfully.")

TOPIC_LEARNING_SEQUENCE = [
    "arrays", "strings", "math",
    "linked-list", "stack", "queue",
    "trees", "graphs", "heaps",
    "hash-table", "dynamic-programming",
    "bit-manipulation", "backtracking", "greedy",
    "design", "database", "system-design",
    "concurrency", "behavioral"
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
    "behavioral": {"behavioral"}
}

TAG_TO_TOPIC = {}
for topic, tags in TOPIC_TO_TAGS.items():
    for tag in tags:
        TAG_TO_TOPIC[tag] = topic

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
        ]
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
        ]
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
        ]
    }
}

QUESTIONS_PER_WEEK_TARGET = {
    30: 22,
    60: 20,
    90: 19,
}

class TopicAvailability:
    def __init__(self, topic: str):
        self.topic = topic
        self.total = 0
        self.easy = 0
        self.medium = 0
        self.hard = 0

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

class TemplateGenerator:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.all_problems = {}
        self.company_questions = defaultdict(list)
        self.company_counts = defaultdict(int)

    def fetch_data(self):
        print("Fetching problems and company mappings...")
        limit = 1000
        offset = 0
        
        while True:
            res = self.supabase.table('lc_problems').select('id, title, slug, difficulty, topic_tags').range(offset, offset + limit - 1).execute()
            if not res.data:
                break
            for p in res.data:
                self.all_problems[p['id']] = p
            
            offset += limit
            if len(res.data) < limit:
                break
                
        print(f"Fetched {len(self.all_problems)} problems.")
        
        offset = 0
        while True:
            res = self.supabase.table('lc_company_questions').select('problem_id, company, frequency').range(offset, offset + limit - 1).execute()
            if not res.data:
                break
            for cq in res.data:
                company = cq['company'].lower().strip()
                pid = cq['problem_id']
                if pid in self.all_problems:
                    self.company_questions[company].append({
                        "problem": self.all_problems[pid],
                        "frequency": cq['frequency']
                    })
                    self.company_counts[company] += 1
                    
            offset += limit
            print(f"Fetched {offset} company mappings...", end='\r')
            if len(res.data) < limit:
                break
                
        print(f"\nFetched mappings for {len(self.company_questions)} companies.")

    def get_top_companies(self, limit=25):
        return sorted(self.company_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

    def _get_topic_availability(self, company: str) -> dict[str, TopicAvailability]:
        result = {}
        pool = self.company_questions[company]
        
        for cq in pool:
            p = cq['problem']
            difficulty = p['difficulty'].lower()
            tags = p.get('topic_tags') or []
            
            mapped_topics = set()
            for tag in tags:
                if tag in TAG_TO_TOPIC:
                    mapped_topics.add(TAG_TO_TOPIC[tag])
                    
            for topic in mapped_topics:
                if topic not in result:
                    result[topic] = TopicAvailability(topic)
                
                result[topic].total += 1
                if difficulty == 'easy':
                    result[topic].easy += 1
                elif difficulty == 'medium':
                    result[topic].medium += 1
                elif difficulty == 'hard':
                    result[topic].hard += 1
                    
        return {t: avail for t, avail in result.items() if avail.total > 0}

    def _select_questions_for_week(self, company: str, assigned_topics: list, dsa_breakdown: dict, selected_ids: set) -> list:
        selected_for_week = []
        pool = self.company_questions.get(company, [])
        
        candidates = []
        for cq in pool:
            p = cq['problem']
            if p['id'] in selected_ids:
                continue
                
            tags = p.get('topic_tags') or []
            matches_topic = False
            for tag in tags:
                if tag in TAG_TO_TOPIC and TAG_TO_TOPIC[tag] in assigned_topics:
                    matches_topic = True
                    break
            
            if matches_topic:
                candidates.append(cq)
        
        # Sort candidates by frequency descending
        candidates.sort(key=lambda x: x.get('frequency', 0), reverse=True)
        
        # Select questions by difficulty
        for diff in ['easy', 'medium', 'hard']:
            target_count = dsa_breakdown.get(diff, 0)
            if target_count <= 0:
                continue
                
            diff_candidates = [c for c in candidates if c['problem']['difficulty'].lower() == diff]
            selected_cq = diff_candidates[:target_count]
            
            for cq in selected_cq:
                p = cq['problem']
                selected_for_week.append({
                    "id": p['id'],
                    "title": p['title'],
                    "slug": p['slug'],
                    "difficulty": p['difficulty'],
                    "frequency": cq.get('frequency', 0),
                    "topic_tags": p.get('topic_tags', [])
                })
                selected_ids.add(p['id'])
                
        return selected_for_week

    def generate_templates(self):
        top_companies = self.get_top_companies()
        templates_to_insert = []
        
        for company, count in top_companies:
            for duration in [30, 60, 90]:
                print(f"Building template for {company.upper()} - SDE - {duration} days...")
                template = self._generate_single(company, "SDE", duration, count)
                if template:
                    templates_to_insert.append(template)
                    
        print(f"Generated {len(templates_to_insert)} total templates.")
        
        print(f"Upserting {len(templates_to_insert)} templates to Supabase...")
        batch_size = 50
        for i in range(0, len(templates_to_insert), batch_size):
            batch = templates_to_insert[i:i+batch_size]
            res = self.supabase.table('prep_templates').upsert(batch).execute()
            print(f"Upserted batch {i // batch_size + 1} of {math.ceil(len(templates_to_insert)/batch_size)}")
            
        print("Done! All templates generated and saved successfully.")

    def _generate_single(self, company: str, role: str, duration_days: int, total_company_qs: int):
        config = DURATION_CONFIG[duration_days]
        availability = self._get_topic_availability(company)

        if not availability:
            print(f"  No questions found for {company}/{role}")
            return None

        total_available = sum(t.total for t in availability.values())
        
        week_topic_assignments = self._assign_topics_to_weeks(
            availability=availability,
            total_weeks=config["total_weeks"],
            system_design_start=config["system_design_start_week"],
            behavioral_start=config["behavioral_start_week"]
        )

        weeks = []
        total_questions = 0
        selected_ids = set()

        for week_num, assigned_topics in enumerate(week_topic_assignments, start=1):
            easy_pct, med_pct, hard_pct = config["difficulty_progression"][week_num - 1]
            target_q = QUESTIONS_PER_WEEK_TARGET[duration_days]

            week_availability = self._compute_week_availability(availability, assigned_topics)

            dsa_breakdown = self._compute_dsa_breakdown(
                week_availability, target_q, easy_pct, med_pct, hard_pct
            )

            sd_count = 2 if week_num >= config["system_design_start_week"] else 0
            behavioral_count = 2 if week_num >= config["behavioral_start_week"] else 0
            oops_count = 3 if week_num in [2, 3] else 0

            # Select actual questions for this week
            week_questions = self._select_questions_for_week(
                company=company,
                assigned_topics=assigned_topics,
                dsa_breakdown=dsa_breakdown,
                selected_ids=selected_ids
            )
            
            # Select OOP questions
            if oops_count > 0:
                oops_start_idx = (week_num - 2) * oops_count
                selected_oops = OOPS_POOL[oops_start_idx : oops_start_idx + oops_count]
                week_questions.extend(selected_oops)
                
            # Select System Design questions
            if sd_count > 0:
                sd_start_idx = (week_num - config["system_design_start_week"]) * sd_count
                selected_sd = SYSTEM_DESIGN_POOL[sd_start_idx : sd_start_idx + sd_count]
                week_questions.extend(selected_sd)
                
            # Select Behavioral questions
            if behavioral_count > 0:
                beh_start_idx = (week_num - config["behavioral_start_week"]) * behavioral_count
                selected_beh = BEHAVIORAL_POOL[beh_start_idx : beh_start_idx + behavioral_count]
                week_questions.extend(selected_beh)

            week_total = len(week_questions)
            total_questions += week_total

            weeks.append({
                "week_number": week_num,
                "theme": self._generate_theme(assigned_topics, week_num),
                "focus_areas": assigned_topics,
                "breakdown": {
                    "dsa": dsa_breakdown,
                    "system_design": sd_count,
                    "oops": oops_count,
                    "behavioral": behavioral_count
                },
                "total_questions": week_total,
                "estimated_hours": self._estimate_hours(dsa_breakdown, sd_count, oops_count, behavioral_count),
                "notes": self._generate_notes(assigned_topics, week_num),
                "questions": week_questions
            })

        template_id = f"{company.lower().replace(' ', '_')}_{role.lower().replace('-', '').replace(' ', '_')}_{duration_days}day"

        return {
            "id": template_id,
            "company": company,
            "role": role,
            "duration_days": duration_days,
            "total_weeks": config["total_weeks"],
            "total_questions": total_questions,
            "template_data": {"weeks": weeks},
            "generated_from_question_count": total_company_qs
        }

    def _assign_topics_to_weeks(self, availability, total_weeks, system_design_start, behavioral_start):
        available_topics = [
            t for t in TOPIC_LEARNING_SEQUENCE
            if t in availability and t not in ["system-design", "database", "behavioral"]
        ]
        
        if not available_topics:
            available_topics = ["arrays"]

        topics_per_week = max(1, len(available_topics) // total_weeks)
        assignments = []

        topic_idx = 0
        for week in range(1, total_weeks + 1):
            week_topics = []

            for _ in range(topics_per_week):
                if topic_idx < len(available_topics):
                    week_topics.append(available_topics[topic_idx])
                    topic_idx += 1

            if week >= system_design_start:
                week_topics.append("system-design")
                
            if week >= behavioral_start:
                week_topics.append("behavioral")

            assignments.append(week_topics)

        while topic_idx < len(available_topics):
            assignments[-1].append(available_topics[topic_idx])
            topic_idx += 1

        return assignments

    def _compute_week_availability(self, availability, topics):
        easy = sum(availability[t].easy for t in topics if t in availability)
        medium = sum(availability[t].medium for t in topics if t in availability)
        hard = sum(availability[t].hard for t in topics if t in availability)
        return {"easy": easy, "medium": medium, "hard": hard}

    def _compute_dsa_breakdown(self, week_avail, target_q, easy_pct, med_pct, hard_pct):
        target_easy = int(target_q * easy_pct)
        target_med = int(target_q * med_pct)
        target_hard = int(target_q * hard_pct)

        avail_easy = week_avail.get("easy", 0)
        avail_med = week_avail.get("medium", 0)
        avail_hard = week_avail.get("hard", 0)

        actual_easy = min(target_easy, avail_easy)
        actual_med = min(target_med, avail_med)
        actual_hard = min(target_hard, avail_hard)

        if actual_hard < target_hard:
            actual_med = min(avail_med, actual_med + (target_hard - actual_hard))

        if actual_med < target_med:
            actual_easy = min(avail_easy, actual_easy + (target_med - actual_med))

        return {"easy": actual_easy, "medium": actual_med, "hard": actual_hard}

    def _estimate_hours(self, dsa, sd, oops, behavioral):
        return round(
            dsa.get("easy", 0) * (20/60)
            + dsa.get("medium", 0) * (45/60)
            + dsa.get("hard", 0) * (90/60)
            + sd * 1.0
            + oops * 0.5
            + behavioral * (20/60),
            1
        )

    def _generate_theme(self, topics, week_num):
        if not topics:
            return "Mixed Practice"
        clean = [t.replace("-", " ").title() for t in topics[:2]]
        return " & ".join(clean)

    def _generate_notes(self, topics, week_num):
        notes = {
            1: "Focus on pattern recognition. Solve easy variants first.",
            2: "Start recognizing two-pointer and sliding window patterns.",
            3: "Recursion is the foundation for trees and graphs.",
        }
        return notes.get(week_num, "Focus on understanding patterns and edge cases.")

if __name__ == "__main__":
    generator = TemplateGenerator(supabase)
    generator.fetch_data()
    generator.generate_templates()
