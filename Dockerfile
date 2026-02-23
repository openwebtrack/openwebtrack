ARG NODE_IMAGE=node:24.11.1-alpine3.22

# --- Build stage ---
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

COPY .npmrc package.json package-lock.json drizzle.config.ts .

RUN npm ci

COPY . .

RUN node --run db:generate && \
    node --run build && \
    find build -name "*.map" -delete

# --- Runtime stage ---
FROM ${NODE_IMAGE} AS runner

WORKDIR /app

COPY --chown=node:node .npmrc package.json package-lock.json drizzle.config.ts .

RUN apk add --no-cache netcat-openbsd && \
    npm ci --omit=dev && \
    npm install drizzle-kit && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/cache/apk/* /root/.npm

COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/src/lib/server/db ./src/lib/server/db
COPY --chmod=755 docker-entrypoint.sh .

RUN find build -name "*.map" -delete

USER node

ENV NODE_ENV=production
ENV PORT=8424

EXPOSE 8424

CMD ["./docker-entrypoint.sh"]