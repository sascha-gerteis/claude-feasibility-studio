# Feasibility Studio dashboard — production image.
# Build from the repository root so agent definitions are available:
#   docker build -f dashboard/Dockerfile -t feasibility-studio-dashboard .
FROM node:22.20-bookworm-slim AS build
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22.20-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4317 STUDIO_AUTH=required STUDIO_DB=/data/studio.db \
    STUDIO_REPO_DIR=/app STUDIO_SECURE_COOKIES=true
WORKDIR /app/dashboard
COPY --from=build /app/dashboard/node_modules ./node_modules
COPY --from=build /app/dashboard/dist ./dist
COPY --from=build /app/dashboard/server/dist ./server/dist
COPY dashboard/package.json dashboard/vite.config.ts ./
COPY .claude/agents /app/.claude/agents
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4317
# Requires STUDIO_INGEST_TOKEN (>=32 chars) and at least one user (see README). Refuses to start otherwise.
CMD ["node", "--disable-warning=ExperimentalWarning", "server/dist/server/src/index.js"]
