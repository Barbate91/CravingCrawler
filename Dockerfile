FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN bun install

# Install Chromium browser + system deps using project's playwright version
RUN apt-get update && bunx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

# Copy source + config
COPY src/ src/
COPY config/ config/
COPY astro.config.mjs tsconfig.json ./

# Build the Astro SSR site
RUN bunx --bun astro build

# Data directory will be mounted/created; images dir is created at runtime by images.ts
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV IMAGE_DIR=/app/dist/client/images
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

CMD ["bun", "src/prod-server.ts"]
