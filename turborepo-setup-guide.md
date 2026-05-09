# Turborepo Setup Guide - Placement Prep Assistant

## Initial Project Setup

### Step 1: Create Turborepo Project
```bash
# Create new turborepo with npm
npx create-turbo@latest placement-prep --package-manager=npm
cd placement-prep
```

### Step 2: Clean Up Default Structure
The default structure comes with `apps/web` and `apps/docs`. We'll customize it.

```bash
# Remove default docs app (optional, we don't need it)
rm -rf apps/docs
```

## Building Your Folder Structure

### Step 3: Create All Directories

```bash
# Create apps
mkdir -p apps/web apps/api apps/ai-service

# Create services
mkdir -p services/scraper

# Create packages
mkdir -p packages/types packages/config

# Create infrastructure and docs
mkdir -p infrastructure/docker .github/workflows docs
```

### Step 4: Initialize Each App/Service

#### 4.1: Web App (Next.js)
```bash
cd apps/web

# Remove existing if it exists
rm -rf * .next .env* .gitignore

# Create fresh Next.js app with TypeScript
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-git --import-alias '@/*' --src-dir=false

cd ../..
```

#### 4.2: Node API (Hono)
```bash
# From root
mkdir -p apps/api/src

cd apps/api

# Create package.json
cat > package.json << 'EOF'
{
  "name": "@placement-prep/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --loader tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@supabase/supabase-js": "^2.38.0",
    "@clerk/backend": "^1.0.0",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "tsx": "^4.0.0",
    "eslint": "^8.50.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
EOF

# Create tsconfig
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
EOF

# Create src directory structure
mkdir -p src/{routes,middleware,db,lib}

cd ../..
```

#### 4.3: FastAPI AI Service
```bash
# From root
mkdir -p apps/ai-service/app/{routers,core,models}

cd apps/ai-service

# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-dotenv==1.0.0
qdrant-client==2.7.0
openai==1.3.0
requests==2.31.0
httpx==0.25.0
gunicorn==21.2.0
EOF

# Create main.py
cat > app/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import query, interview, ingest
from app.config import settings

app = FastAPI(title="Placement Prep AI Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(query.router, prefix="/api/query", tags=["query"])
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF

# Create config.py
cat > app/config.py << 'EOF'
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str | None = None
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"

settings = Settings()
EOF

# Create empty router files
touch app/routers/__init__.py
touch app/routers/query.py
touch app/routers/interview.py
touch app/routers/ingest.py

touch app/core/__init__.py
touch app/core/rag.py
touch app/core/embeddings.py
touch app/core/qdrant.py
touch app/core/llm.py

touch app/models/__init__.py
touch app/models/query.py
touch app/models/interview.py

cd ../..
```

#### 4.4: Scraper Service
```bash
# From root
mkdir -p services/scraper/scrapers services/scraper/cleaners services/scraper/{pipeline,storage}

cd services/scraper

# Create requirements.txt
cat > requirements.txt << 'EOF'
crawl4ai==0.1.0
beautifulsoup4==4.12.0
playwright==1.40.0
requests==2.31.0
python-dotenv==1.0.0
apscheduler==3.10.4
qdrant-client==2.7.0
openai==1.3.0
pydantic==2.5.0
pydantic-settings==2.1.0
EOF

# Create config
cat > config.py << 'EOF'
from pydantic_settings import BaseSettings

class ScraperConfig(BaseSettings):
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    OPENAI_API_KEY: str
    STAGING_DIR: str = "./staging"
    CHECKPOINT_DIR: str = "./checkpoints"
    
    class Config:
        env_file = ".env"

config = ScraperConfig()
EOF

# Create main entry point
cat > main.py << 'EOF'
from pipeline.orchestrator import ScrapingOrchestrator
from pipeline.scheduler import setup_scheduler
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    scheduler = setup_scheduler()
    scheduler.start()
    logger.info("Scraper scheduler started")
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        scheduler.shutdown()
EOF

# Create empty module files
touch scrapers/__init__.py
touch scrapers/base.py
touch scrapers/leetcode.py
touch scrapers/gfg.py
touch scrapers/ambitionbox.py

touch cleaners/__init__.py
touch cleaners/llm_cleaner.py
touch cleaners/preprocessor.py

touch pipeline/__init__.py
touch pipeline/orchestrator.py
touch pipeline/scheduler.py
touch pipeline/embedder.py

touch storage/__init__.py
touch storage/staging.py
touch storage/checkpoint.py

cd ../..
```

#### 4.5: Shared Packages

**Types Package:**
```bash
mkdir -p packages/types/src

cd packages/types

cat > package.json << 'EOF'
{
  "name": "@placement-prep/types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
EOF

# Create index.ts
cat > src/index.ts << 'EOF'
// User types
export interface User {
  id: string;
  email: string;
  name: string;
  college_id?: string;
  role: "student" | "admin" | "superadmin";
}

// Search types
export interface SearchQuery {
  query: string;
  company?: string;
  role?: string;
  difficulty?: "easy" | "medium" | "hard";
  limit?: number;
}

export interface SearchResult {
  id: string;
  company: string;
  role: string;
  question: string;
  difficulty: string;
  round: string;
  year: number;
  similarity_score: number;
}

// College types
export interface College {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  student_count: number;
}
EOF

cd ../..
```

**Config Package:**
```bash
mkdir -p packages/config

cd packages/config

cat > eslint.js << 'EOF'
module.exports = {
  extends: ["next/core-web-vitals", "turbo"],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
};
EOF

cat > tsconfig-base.json << 'EOF'
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
    },
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
EOF

cd ../..
```

## Step 5: Update Root Files

### Update Root package.json
```bash
cat > package.json << 'EOF'
{
  "name": "placement-prep",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "clean": "turbo clean && rm -rf node_modules",
    "format": "turbo run format",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "typescript": "^5.3.0",
    "eslint": "^8.50.0"
  }
}
EOF
```

### Create turbo.json
```bash
cat > turbo.json << 'EOF'
{
  "version": "1",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", ".next/**"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": true
    },
    "format": {
      "outputs": [],
      "cache": false
    }
  },
  "globalEnv": ["NODE_ENV"]
}
EOF
```

### Create Root .env.example
```bash
cat > .env.example << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret

# APIs
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Services URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000

# Node Config
NODE_ENV=development
EOF
```

## Step 6: Install Dependencies

```bash
# From root directory
npm install

# Install all workspace dependencies
npm install --workspaces
```

## Step 7: Docker Setup

### Create docker-compose.yml
```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: placement_prep
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  web:
    build:
      context: .
      dockerfile: infrastructure/docker/web.Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    depends_on:
      - api
    volumes:
      - ./apps/web:/app/apps/web

  api:
    build:
      context: .
      dockerfile: infrastructure/docker/api.Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
    depends_on:
      - postgres
    volumes:
      - ./apps/api:/app/apps/api

  ai-service:
    build:
      context: .
      dockerfile: infrastructure/docker/ai-service.Dockerfile
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
    depends_on:
      - qdrant
    volumes:
      - ./apps/ai-service:/app/apps/ai-service

volumes:
  postgres_data:
  qdrant_data:
EOF
```

### Create infrastructure/docker/web.Dockerfile
```bash
mkdir -p infrastructure/docker

cat > infrastructure/docker/web.Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages packages
COPY apps/web apps/web

RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev", "--workspace=web"]
EOF
```

### Create infrastructure/docker/api.Dockerfile
```bash
cat > infrastructure/docker/api.Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages packages
COPY apps/api apps/api

RUN npm install

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace=api"]
EOF
```

### Create infrastructure/docker/ai-service.Dockerfile
```bash
cat > infrastructure/docker/ai-service.Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

COPY apps/ai-service/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai-service app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
EOF
```

## Step 8: Development Commands

### Run everything locally
```bash
# Using docker-compose (easiest)
docker-compose up

# OR without docker (terminal split):
# Terminal 1
npm run dev

# This starts:
# - web (Next.js) on port 3000
# - api (Hono) on port 3001
# - ai-service (FastAPI) on port 8000
# - scraper (if configured)
```

### Build for production
```bash
npm run build
```

### Lint all apps
```bash
npm run lint
```

### Clean everything
```bash
npm run clean
```

### Work on specific app
```bash
# Only web
npm run dev --workspace=web

# Only api
npm run dev --workspace=api

# Only ai-service (from services/scraper directory)
cd apps/ai-service && python -m uvicorn app.main:app --reload
```

## Step 9: Initial Git Setup

```bash
git init
cp .env.example .env

# Add to .gitignore
cat >> .gitignore << 'EOF'
.env
.env.local
node_modules/
dist/
build/
.next/
__pycache__/
*.pyc
.venv/
.vscode/
.idea/
staging/
checkpoints/
EOF

git add .
git commit -m "Initial monorepo setup with Turborepo"
```

## Summary of Key Commands

| Command | Purpose |
|---------|---------|
| `npm install --workspaces` | Install all dependencies |
| `npm run dev` | Start all apps in parallel |
| `npm run build` | Build everything for production |
| `npm run lint` | Lint all apps |
| `npm run clean` | Remove all dist/build files and node_modules |
| `docker-compose up` | Spin up all services locally |
| `npm run dev --workspace=web` | Dev only the web app |
| `turbo run dev --filter=web` | Alternative syntax for single app |

## Next Steps After Setup

1. Run `npm install --workspaces`
2. Copy `.env.example` to `.env` and fill in your API keys
3. Run `docker-compose up` to start Qdrant and PostgreSQL
4. Run `npm run dev` to start all services
5. Visit `http://localhost:3000` for the web app

That's it! Your monorepo is ready to go.
