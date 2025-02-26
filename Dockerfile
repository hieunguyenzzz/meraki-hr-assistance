# Use an official Node runtime as the base image
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Define build-time environment variables with default values
ARG NODE_ENV=production
ARG PORT=3000
ARG ZOHO_CLIENT_ID
ARG ZOHO_CLIENT_SECRET
ARG ZOHO_REFRESH_TOKEN
ARG OPENAI_API_KEY
ARG ZOHO_REDIRECT_URI
ARG ZOHO_IMAP_USERNAME
ARG ZOHO_IMAP_APP_PASSWORD
ARG REDIS_URL
ARG R2_ACCESS_KEY_ID
ARG R2_SECRET_ACCESS_KEY
ARG R2_BUCKET_NAME
ARG PDF_PARSER_API_URL

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV PORT=${PORT}
ENV ZOHO_CLIENT_ID=${ZOHO_CLIENT_ID}
ENV ZOHO_CLIENT_SECRET=${ZOHO_CLIENT_SECRET}
ENV ZOHO_REFRESH_TOKEN=${ZOHO_REFRESH_TOKEN}
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV ZOHO_REDIRECT_URI=${ZOHO_REDIRECT_URI}
ENV ZOHO_IMAP_USERNAME=${ZOHO_IMAP_USERNAME}
ENV ZOHO_IMAP_APP_PASSWORD=${ZOHO_IMAP_APP_PASSWORD}
ENV REDIS_URL=${REDIS_URL}
ENV R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
ENV R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
ENV R2_BUCKET_NAME=${R2_BUCKET_NAME}
ENV PDF_PARSER_API_URL=${PDF_PARSER_API_URL}

# Build the application
RUN npm run build

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S remix -u 1001

# Copy built artifacts and production dependencies
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Set correct permissions
RUN chown -R remix:nodejs /app

# Switch to non-root user
USER remix

# Expose the port the app runs on (default to 3000 if not set)
EXPOSE ${PORT:-80}

# Command to run the application
CMD ["npm", "start"] 