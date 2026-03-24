# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_URL=https://devel-ai.ub.ac.id/api/asura
ARG VITE_WS_URL=wss://devel-ai.ub.ac.id/api/asura

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Create asuracore assets directory and copy assets there
RUN mkdir -p /usr/share/nginx/html/asuracore && \
    cp /usr/share/nginx/html/index.html /usr/share/nginx/html/asuracore/ && \
    ln -s /usr/share/nginx/html/assets /usr/share/nginx/html/asuracore/assets && \
    ln -s /usr/share/nginx/html/favicon.svg /usr/share/nginx/html/asuracore/favicon.svg

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
