# Web App (`apps/web`)

The Web App is the primary user-facing dashboard for the Placement Prep platform. It allows students to track their progress, view detailed AI-generated insights, and manage their coding interview preparation journey.

## What it does

- **Dashboard:** Visualizes the student's progress using charts (Recharts) and animations (GSAP).
- **Authentication:** Securely handles user sign-up and sign-in via Clerk.
- **Problem Reviews:** Displays the synchronized problems, analogies, code dry-runs, and complexity analyses fetched from the API.
- **Modern UI:** Utilizes Tailwind CSS v4 and React 19 features to deliver a highly responsive and aesthetically pleasing experience.

## Tech Stack

- **Framework:** Next.js (App Router)
- **UI Library:** React 19, Tailwind CSS v4, Lucide React
- **Animations:** GSAP, Lenis (smooth scrolling)
- **Authentication:** Clerk (`@clerk/nextjs`)
- **Syntax Highlighting:** PrismJS
- **Data Visualization:** Recharts

## Development

Navigate to the web app directory:

```bash
cd apps/web
```

Install dependencies (if not done from root):

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

## Environment Variables

Ensure the following variables are present in your `.env` or `.env.local` file:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
```
