# ============================================================
#  Frontend (PWA Vite/React) - build + nginx estático
# ============================================================

# ---- build ----
FROM node:20-slim AS build
WORKDIR /app

# Variables de Vite: se "hornean" en build time (van al bundle del cliente).
ARG VITE_API_URL=http://localhost:3000/api/v1
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
