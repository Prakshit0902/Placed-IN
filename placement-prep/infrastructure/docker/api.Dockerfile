# Stage 1: Prune
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @placement-prep/api --docker

# Stage 2: Installer
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Build the project
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN npx turbo run build --filter=@placement-prep/api...

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

# Copy built artifacts and node_modules from installer
COPY --from=installer --chown=apiuser:nodejs /app/ .

USER apiuser
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "apps/api/dist/index.js"]
