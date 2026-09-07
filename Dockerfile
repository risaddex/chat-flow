FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG SUPABASE_PROJECT_URL=https://lorwmxxrxodonkxgmvzm.supabase.co
ARG SUPABASE_PUBLIC=sb_publishable_3G-rt4v1ztnjv2wbGQdIgg_VTb6OY9P
ARG API_BASE_URL=
RUN VITE_SUPABASE_URL="$SUPABASE_PROJECT_URL" \
    VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLIC" \
    VITE_API_URL="$API_BASE_URL" npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
