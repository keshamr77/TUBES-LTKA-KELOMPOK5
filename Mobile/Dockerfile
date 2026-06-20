# ===================================================================
# Dockerfile — Flutter Web App (Absensi GPS)
# Multi-stage build: Flutter SDK → build web → serve via Nginx
# Deploy target: Railway (auto-detect Dockerfile)
# ===================================================================

# ---- Stage 1: Build Flutter Web ----
FROM debian:bookworm-slim AS build

# Install dependencies untuk Flutter
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Flutter SDK (stable channel)
ENV FLUTTER_HOME=/usr/local/flutter
ENV PATH="${FLUTTER_HOME}/bin:${PATH}"

RUN git clone --depth 1 --branch stable https://github.com/flutter/flutter.git ${FLUTTER_HOME} \
    && flutter precache --web \
    && flutter doctor -v

# Copy source code
WORKDIR /app
COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get

COPY . .

# Build Flutter Web (release mode)
RUN flutter build web --release

# ---- Stage 2: Serve dengan Nginx ----
FROM nginx:alpine

# Hapus default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy Flutter build output ke Nginx html dir
COPY --from=build /app/build/web /usr/share/nginx/html

# Railway inject PORT sebagai env var (default 8080)
ENV PORT=8080
EXPOSE ${PORT}

# Nginx di Alpine sudah support envsubst via docker-entrypoint
# yang akan mengganti $PORT di template secara otomatis
CMD ["nginx", "-g", "daemon off;"]
