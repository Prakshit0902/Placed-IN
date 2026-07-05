# AI Service (`apps/ai-service`)

The AI Service is a dedicated Python backend designed to handle all heavy-lifting machine learning, LLM inference, and vector search operations for the platform.

## What it does

- **Code Translation & Generation:** Re-writes scraped Codeforces/LeetCode C++ or Python code into optimal, heavily-commented code in the user's preferred language.
- **Deep Explanations:** Given a problem description and a solution, it generates real-world analogies, step-by-step intuitive approaches, and dry-run variable traces.
- **Progressive Hints:** Generates tiered hints (vague, structural, and near-pseudocode) ensuring the user is guided rather than spoon-fed.
- **Complexity Analysis:** Performs line-by-line Big-O time and space complexity audits, suggesting alternative algorithms.
- **Similar Problem Recommendations:** Uses Qdrant and SentenceTransformers to find semantically similar problem representations, ensuring a logical learning progression.
- **Web Scraping:** Uses `curl_cffi` to reliably bypass TLS fingerprinting and scrape raw submissions from competitive programming platforms when needed.

## Tech Stack

- **Framework:** FastAPI / Uvicorn
- **LLM Providers:** Google GenAI (Gemini), Groq
- **Vector Database:** Qdrant
- **Embeddings:** `sentence-transformers`
- **Database Client:** Supabase Python Client
- **Scraping:** `curl_cffi`

## Security

This service is internal and should **not** be exposed directly to the public internet. All endpoints are protected by an `INTERNAL_SERVICE_KEY` guard, which the Node.js API Gateway provides in the `Authorization` header.

## Development

Navigate to the AI service directory:

```bash
cd apps/ai-service
```

Create a virtual environment and install dependencies:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Run the development server:

```bash
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

Ensure the following variables are present in your `.env`:

```env
GEMINI_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...
INTERNAL_SERVICE_KEY=your-secure-internal-key
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_KEY=ey...
QDRANT_HOST=localhost
QDRANT_PORT=6333
```
