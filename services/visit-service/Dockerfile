FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN node node_modules/typescript/bin/tsc -p tsconfig.build.json
RUN npm ci --omit=dev --offline --no-audit --no-fund

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8003
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.SERVICE_PORT ?? '8003') + '/health/ready').then(r => { if (!r.ok) process.exitCode = 1; }).catch(() => { process.exitCode = 1; })"]
CMD ["node", "dist/main.js"]
