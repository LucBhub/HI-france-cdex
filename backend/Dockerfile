# Use an official Node.js runtime as a parent image.
# Using 'slim' is a good compromise between size and compatibility.
FROM node:20-slim

# Install postgresql-client for Zero-Touch Restore
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container.
WORKDIR /app

# Copy package.json and package-lock.json (if available).
# This is done first to leverage Docker's layer caching.
# Copy package.json only
COPY package.json ./

# Clean npm cache, remove any existing node_modules, and reinstall dependencies cleanly
ENV CACHE_BUST=2025-11-24-1
RUN npm cache clean --force && rm -rf node_modules && npm install --legacy-peer-deps --force

# Copy local code to the container image.
COPY . .

# Make the port available to the world outside this container.
EXPOSE 3001

# The command to run is specified in docker-compose.yml
CMD ["npm", "start"]
