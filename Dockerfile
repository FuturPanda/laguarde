FROM oven/bun:1.3.14-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY public ./public
COPY llms.txt ./

ENV PORT=3000
ENV LAGUARDE_HOST=0.0.0.0
ENV LAGUARDE_DB_PATH=/data/laguarde.db
ENV LAGUARDE_EVIDENCE_DIR=/data/decisions

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "src/server.ts"]
