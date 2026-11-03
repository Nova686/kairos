FROM node:22-bookworm-slim AS build
WORKDIR /build
COPY . .
RUN npm ci
RUN npm run build
RUN node_modules/.bin/esbuild scripts/create-admin.ts \
    --bundle --platform=node --format=esm --packages=external \
    --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
    --outfile=.output/server/create-admin.mjs

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /build/.output ./.output
COPY --from=build --chown=node:node /build/server/database/migrations ./server/database/migrations
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
VOLUME /app/.data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(response => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
