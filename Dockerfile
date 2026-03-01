FROM oven/bun:1 AS base
WORKDIR /app

# Install Playwright system dependencies (Chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json ./
RUN bun install

# Install Playwright browsers
RUN bunx playwright install chromium

# Copy source + config
COPY src/ src/
COPY config/ config/
COPY astro.config.mjs tsconfig.json ./

# Data + images directories will be mounted/created
RUN mkdir -p /app/data /app/public/images

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

# Run Astro dev server (includes scraper integration in-process)
# For production, replace with a built SSR server once an adapter is configured
CMD ["bunx", "--bun", "astro", "dev", "--host", "0.0.0.0", "--port", "4321"]
