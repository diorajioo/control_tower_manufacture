# Control Tower Manufacturing — production image for the internal Kubernetes cluster.
# One container: Next.js standalone serves the pages, the API routes and Microsoft SSO.
#   docker build --build-arg NEXT_PUBLIC_BASE_PATH=/ct-manuf -t control-tower:local .
# Images that reach the cluster are built by CI (.gitlab-ci.yml), never pushed from a laptop.
FROM node:24.22.1-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24.22.1-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
ENV NEXT_TELEMETRY_DISABLED=1
# The path the app is served under on the shared host ("/ct-manuf" in the cluster, passed by CI).
# Baked into the build: routes, asset URLs and the SSO callback all carry it. Empty = root.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
# OpenPanel client ID of this environment's project (public by design, browser SDK). Baked in
# like the base path; empty = tracking off, the app is unaffected.
ARG NEXT_PUBLIC_OPENPANEL_CLIENT_ID=""
ENV NEXT_PUBLIC_OPENPANEL_CLIENT_ID=$NEXT_PUBLIC_OPENPANEL_CLIENT_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24.22.1-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Risk Score model, read at runtime from models/risk-score/model.json
COPY --from=build --chown=node:node /app/models/risk-score/model.json ./models/risk-score/model.json
# The base image's unprivileged user `node`, by uid so policies can check it is not root.
USER 1000:1000
EXPOSE 3000
# Kubernetes sets HOSTNAME to the pod name, overriding the ENV above, and server.js binds to
# HOSTNAME. Re-set it at start so the server always listens on 0.0.0.0; exec hands PID 1 (and
# SIGTERM) to node.
CMD ["sh", "-c", "export HOSTNAME=0.0.0.0 && exec node server.js"]
