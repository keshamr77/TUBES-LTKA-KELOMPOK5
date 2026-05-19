# Absensi GPS — Backend API

Backend Express.js untuk sistem absensi GPS. Di-deploy ke Railway dengan auto-deploy dari branch `fly-backend`.

## Phase Status

- [x] **Phase 1**: Express skeleton + endpoint mock (Haversine real, data in-memory)
- [ ] **Phase 2**: Firebase Admin SDK + auth middleware
- [ ] **Phase 3**: Real Firestore integration
- [ ] **Phase 4**: Endpoint sessions, users, courses
- [ ] **Phase 5**: Production hardening (rate limiting, validation lib, monitoring)

## Tech Stack

- Node.js 20+
- TypeScript
- Express.js 4.x
- Firebase Admin SDK (Phase 2+)
- Deployment: **Railway**

## Local Development

```bash
# Install dependencies (sekali aja)
npm install

# Copy env example & isi nilainya
cp .env.example .env

# Run dev server dengan hot reload
npm run dev

# Test endpoint health di browser
# http://localhost:3000/health
```

## Production Build

```bash
npm run build   # Compile TypeScript ke dist/
npm start       # Run compiled JS
```

## Project Structure

```
src/
├── index.ts                # Express server entry point
├── routes/
│   ├── health.ts           # GET /health
│   └── attendances.ts      # POST + GET /api/attendances
└── utils/
    └── haversine.ts        # Geofencing formula
```

## API Documentation

Spesifikasi lengkap endpoint, format request/response, error codes:
**[API_CONTRACT.md](../../API_CONTRACT.md)** di root branch.

## Endpoints Phase 1

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/` | Service info | ✅ |
| GET | `/health` | Health check | ✅ |
| POST | `/api/attendances` | Submit absensi (Haversine real, save in-memory) | ✅ Mock |
| GET | `/api/attendances/me` | Riwayat absensi (in-memory) | ✅ Mock |

## Testing Manual

### Pakai curl (PowerShell / Bash)

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Submit absensi (koordinat DI DALAM radius Telkom Univ)
curl -X POST http://localhost:3000/api/attendances ^
  -H "Content-Type: application/json" ^
  -H "X-Mock-User-Id: user_test_001" ^
  -d "{\"sessionId\":\"sess_001\",\"latitude\":-6.97285,\"longitude\":107.63042,\"selfieUrl\":\"https://example.com/foto.jpg\"}"

# 3. Submit absensi (koordinat DI LUAR radius — harusnya 403)
curl -X POST http://localhost:3000/api/attendances ^
  -H "Content-Type: application/json" ^
  -H "X-Mock-User-Id: user_test_001" ^
  -d "{\"sessionId\":\"sess_001\",\"latitude\":-6.95000,\"longitude\":107.65000,\"selfieUrl\":\"https://example.com/foto.jpg\"}"

# 4. Get riwayat absensi user_test_001
curl http://localhost:3000/api/attendances/me ^
  -H "X-Mock-User-Id: user_test_001"
```

### Pakai Postman / Thunder Client (lebih gampang)

Import endpoint dari API_CONTRACT.md, atau bikin manual:
- Headers: `Content-Type: application/json`, `X-Mock-User-Id: user_test_001`
- Body raw JSON sesuai contract

## Phase 1 Limitations (Penting!)

⚠️ **Mock User ID via header**, bukan dari Firebase Auth token. Pastikan mobile dev tau ini sementara.

⚠️ **Data hilang saat server restart** (in-memory). Buat persistent storage di Phase 2.

⚠️ **Course location hardcoded** ke Telkom University Bandung (`-6.97285, 107.63042`, radius 100m). Sesuaikan di `src/routes/attendances.ts` kalau kampus kalian beda.

⚠️ **Tidak ada validasi sesi** (apakah sesi buka/closed, apakah user enrolled). Phase 2 setelah Firestore connect.

## Deploy ke Railway

1. Push branch `fly-backend` ke GitHub
2. Di Railway: New Project → Deploy from GitHub repo
3. Pilih repo `TUBES-LTKA-KELOMPOK5`, branch `fly-backend`
4. **Root Directory**: `Backend/api`
5. Railway auto-detect: Node.js, run `npm install && npm run build && npm start`
6. Setelah deploy: dapet URL `https://[nama-app].up.railway.app`
7. Update field `Base URL Production` di `API_CONTRACT.md`
