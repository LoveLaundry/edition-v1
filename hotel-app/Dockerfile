# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_USER_API_URL=/api/user
ARG VITE_BILL_API_URL=/api/bills

ENV VITE_USER_API_URL=$VITE_USER_API_URL \
    VITE_BILL_API_URL=$VITE_BILL_API_URL

RUN npm run build

FROM nginx:1.27-alpine AS serve

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
