FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund

COPY src ./src

# EXPOSE intentionally omitted — Railway injects PORT dynamically; a hardcoded
# EXPOSE has broken past deployments (see FLORA_DEVELOPMENT_RULES.md).
# HEALTHCHECK intentionally omitted — Railway probes railway.json's healthcheckPath;
# a Dockerfile HEALTHCHECK directive conflicts with it.

CMD ["node", "src/server.js"]
