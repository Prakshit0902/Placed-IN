# API Gateway (`apps/api`)

The API Gateway is the central nervous system of the Placement Prep platform. It serves requests from the Web Dashboard and the Chrome Extension, manages the PostgreSQL database via Supabase, and orchestrates calls to the Python AI Service.

## What it does

- **Routing & Validation:** Uses Hono running on Node.js to provide incredibly fast routing and request validation.
- **Quota Management:** Tracks the daily free quota for users, logging AI usage and restricting access to premium features (like Level 3 hints).
- **Service Orchestration:** Proxies heavy LLM and vector search requests to the `ai-service`, authenticating internally via an `INTERNAL_SERVICE_KEY`.
- **Database Operations:** Interacts with Supabase (PostgreSQL) for user data, usage logs, and problem metadata.
- **Payments:** Integrates with Razorpay for handling premium subscription upgrades.

## Tech Stack

- **Framework:** Hono (with `@hono/node-server`)
- **Language:** TypeScript
- **Database Client:** Supabase JS Client
- **Payments:** Razorpay
- **Auth Webhooks:** Svix (for processing Clerk webhooks)
- **Vector DB Client:** `@qdrant/js-client-rest`

## Development

Navigate to the API directory:

```bash
cd apps/api
```

Run the development server (uses `tsx` for fast TypeScript execution):

```bash
npm run dev
```

The API will be accessible at [http://localhost:3001](http://localhost:3001).

## Environment Variables

Ensure the following variables are present in your `.env`:

```env
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
AI_SERVICE_URL=http://127.0.0.1:8000
INTERNAL_SERVICE_KEY=your-secure-internal-key
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```
