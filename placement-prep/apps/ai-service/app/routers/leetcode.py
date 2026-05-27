from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter()

class ProfileRequest(BaseModel):
    username: str

@router.post("/parse")
async def parse_leetcode_profile(req: ProfileRequest):
    username = req.username
    url = "https://leetcode.com/graphql"
    
    query = """
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal { acSubmissionNum { difficulty count } }
        tagProblemCounts {
          advanced { tagName problemsSolved }
          intermediate { tagName problemsSolved }
          fundamental { tagName problemsSolved }
        }
      }
    }
    """
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={
                "query": query,
                "variables": {"username": username}
            })
            response.raise_for_status()
            data = response.json()
            
            if "errors" in data or not data.get("data", {}).get("matchedUser"):
                raise HTTPException(status_code=404, detail="LeetCode user not found")
                
            matched_user = data["data"]["matchedUser"]
            stats = matched_user.get("submitStatsGlobal", {}).get("acSubmissionNum", [])
            
            by_difficulty = {"Easy": 0, "Medium": 0, "Hard": 0, "All": 0}
            for stat in stats:
                diff = stat.get("difficulty")
                count = stat.get("count", 0)
                if diff in by_difficulty:
                    by_difficulty[diff] = count
                    
            tag_counts = matched_user.get("tagProblemCounts", {})
            by_topic = {}
            
            for level in ["advanced", "intermediate", "fundamental"]:
                tags = tag_counts.get(level, [])
                if tags:
                    for tag in tags:
                        name = tag.get("tagName", "")
                        count = tag.get("problemsSolved", 0)
                        if name:
                            by_topic[name] = by_topic.get(name, 0) + count
                            
            # Compute weak/strong areas very simply
            sorted_topics = sorted(by_topic.items(), key=lambda x: x[1])
            weak_areas = [t[0] for t in sorted_topics[:3]] if sorted_topics else []
            strong_areas = [t[0] for t in sorted_topics[-3:]] if sorted_topics else []
            
            return {
                "username": username,
                "total_solved": by_difficulty.get("All", 0),
                "by_difficulty": {
                    "easy": by_difficulty.get("Easy", 0),
                    "medium": by_difficulty.get("Medium", 0),
                    "hard": by_difficulty.get("Hard", 0)
                },
                "by_topic": by_topic,
                "weak_areas": weak_areas,
                "strong_areas": strong_areas
            }
            
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch from LeetCode: {str(e)}")
