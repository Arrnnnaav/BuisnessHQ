FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Build the dashboard SPA inside the image so the container never depends on a dist/
# directory built on the host. apps/server.mjs falls back to the pre-SPA dashboard if
# this is ever skipped, so a failed build degrades rather than breaking the container.
RUN npm --prefix apps/dashboard install --no-audit --no-fund     && npm --prefix apps/dashboard run build     && rm -rf apps/dashboard/node_modules

RUN mkdir -p /app/data

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    OLLAMA_URL=http://ollama:11434

EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:4173/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/server.mjs"]
