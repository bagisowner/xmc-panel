FROM node:20-bookworm-slim

# Install system dependencies required for OpenJDK runtime management
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
    tar \
    gzip \
    procps \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Configure default Java runtimes directory
ENV JAVA_RUNTIME_DIR=/opt/craft-command-center/runtimes/java
RUN mkdir -p /opt/craft-command-center/runtimes/java

# Install npm dependencies
COPY package*.json ./
RUN npm install

# Copy application source files
COPY . .

# Build Vite frontend assets
RUN npm run build

EXPOSE 3000

CMD ["node", "server.ts"]
