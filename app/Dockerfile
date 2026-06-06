FROM node:24-alpine AS build
WORKDIR /app

ARG EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}
ENV CI=1

COPY package*.json ./
RUN npm ci

COPY app.json tsconfig.json ./
COPY app ./app
COPY assets ./assets
COPY src ./src
RUN npm run build:web

FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
