FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm test && VITE_DATA_MODE=api VITE_API_BASE_URL=./api npm run build -- --base=./

FROM nginx:stable-alpine
COPY deploy/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
