# API Contract — Sistem Absensi GPS

**Project:** Tugas Besar LTKA — Kelompok 5
**Repository:** github.com/keshamr77/TUBES-LTKA-KELOMPOK5
**Backend Branch:** `main`
**Version:** v0.3 (Phase 3 — Auth, Check-in/out, WFH, Enrollment)
**Last Updated:** June 20, 2026
**Maintainer:** Rafly (Backend / Cloud Engineer)

---

## ⚠️ Perubahan dari v0.2

1. **Autentikasi Firebase Token aktif.** Mock (`X-Mock-User-Id`) HANYA berlaku di non-production. Di production WAJIB `Authorization: Bearer <firebase_id_token>`.
2. **Check-in & Check-out** — absensi punya `type` (`check_in` | `check_out`), masing-masing window 15 menit.
3. **Mode WFH** — sesi `locationType: wfh`, geofencing di-skip, koordinat tidak disimpan.
4. **Deterministic attendance ID** — dokumen absensi pakai ID `{sessionId}_{userId}_{type}` (anti-duplikat idempotent).
5. **Indexed query** — `GET /me` pakai `orderBy().limit()` (butuh composite index `userId` + `timestamp`).
6. **Auto-close server-side** — sesi lewat waktu otomatis ditutup cron backend.
7. **Endpoint enrollment** — validasi mahasiswa terdaftar di mata kuliah.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | Express.js |
| Database | Cloud Firestore (Firebase) |
| Auth | Firebase Auth ID Token (Bearer) + mock fallback (dev only) |
| Scheduler | node-cron (auto-close sesi) |
| Deployment | Railway (auto-deploy dari branch `main`) |

---

## Base URL

| Environment | URL |
|-------------|-----|
| **Production** | `https://tubes-ltka-kelompok5-production.up.railway.app/api` |
| **Local Dev** | `http://localhost:3000/api` |

---

## Authentication

**Production (wajib):**
```
Authorization: Bearer <firebase_id_token>
```

**Development (boleh salah satu):**
```
Authorization: Bearer <firebase_id_token>
ATAU
X-Mock-User-Id: <uid_user>
```

> ⚠️ `X-Mock-User-Id` HANYA diterima saat `NODE_ENV !== 'production'`. Di production ditolak `401`. Mobile app mengirim Bearer token.

---

## Standard Response

Success: `{ "success": true, "data": { } }`
Error: `{ "success": false, "error": { "code": "...", "message": "..." } }`

---

## HTTP Status Codes

| Code | Arti |
|------|------|
| `200` | OK |
| `201` | Created |
| `400` | Bad Request / check-in belum dilakukan |
| `401` | Unauthorized |
| `403` | Di luar radius / di luar window check-in/out |
| `404` | Sesi / course / mahasiswa tidak ada |
| `409` | Sudah absen |
| `410` | Sesi closed / belum mulai / waktu habis |
| `500` | Internal Server Error |

---

## Error Codes

| Code | HTTP | Arti |
|------|------|------|
| `INVALID_PAYLOAD` | 400 | Field invalid/kurang |
| `CHECK_IN_REQUIRED` | 400 | Harus check-in dulu sebelum check-out |
| `UNAUTHORIZED` | 401 | Auth gagal / token invalid |
| `OUT_OF_RADIUS` | 403 | Lokasi di luar radius sesi |
| `OUTSIDE_CHECKIN_WINDOW` | 403 | Di luar window check-in (15 menit awal) |
| `OUTSIDE_CHECKOUT_WINDOW` | 403 | Di luar window check-out (15 menit akhir) |
| `NOT_FOUND` | 404 | Sesi tidak ditemukan |
| `COURSE_NOT_FOUND` | 404 | Mata kuliah tidak ditemukan |
| `NOT_ENROLLED` | 404 | Mahasiswa tidak terdaftar |
| `ALREADY_SUBMITTED` | 409 | Sudah absen (tipe ini) di sesi ini |
| `SESSION_CLOSED` | 410 | Sesi ditutup / waktu habis |
| `SESSION_NOT_STARTED` | 410 | Sesi belum dimulai |
| `INTERNAL_ERROR` | 500 | Error server |

---

## Endpoints

### Health
`GET /health` — cek server, tanpa auth.

---

### Sessions

#### `GET /api/sessions/active` (mobile)
List sesi aktif. Response item:
```json
{
  "sessionId": "...",
  "namaKelas": "...", "kodeKelas": "...", "dosenEmail": "...",
  "tanggal": "2026-06-20", "jamMulai": "10:00", "jamSelesai": "10:30",
  "status": "open",
  "locationType": "smart_classroom",
  "locationRequired": true,
  "location": { "latitude": -6.89059, "longitude": 107.610692, "radius": 50 },
  "isActive": true, "timeStatus": "active"
}
```
> Untuk WFH: `locationRequired: false`, `location: null`.

#### `GET /api/sessions` / `GET /api/sessions/:sessionId`
List semua / detail satu sesi.

#### `POST /api/sessions` (dashboard)
| Field | Type | Wajib | Catatan |
|-------|------|-------|---------|
| `namaKelas`, `kodeKelas` | string | Yes | |
| `dosenEmail` | string | No | |
| `tanggal` | string | Yes | `YYYY-MM-DD` |
| `jamMulai`, `jamSelesai` | string | Yes | `HH:mm` WIB |
| `locationType` | string | No | `smart_classroom` (default) \| `lab` \| `wfh` |
| `latitude`, `longitude`, `radius` | number | Yes* | *wajib kecuali `wfh` |

> `locationRequired` otomatis: `false` untuk `wfh`, `true` selainnya.

#### `PATCH /api/sessions/:sessionId/close`
Tutup sesi manual. Auto-close: sesi lewat `jamSelesai` ditutup cron (`closedBy: "auto_cron"`).

---

### Attendances

#### `POST /api/attendances` CORE (mobile)
| Field | Type | Wajib | Catatan |
|-------|------|-------|---------|
| `sessionId` | string | Yes | |
| `type` | string | No | `check_in` (default) \| `check_out` |
| `latitude`, `longitude` | number | Yes* | *wajib kecuali WFH |
| `selfieUrl` | string | Yes | |

Window: `check_in` 15 menit awal, `check_out` 15 menit akhir (harus check-in dulu).

**Response 201:**
```json
{
  "success": true,
  "data": {
    "attendanceId": "{sessionId}_{userId}_check_in",
    "sessionId": "...", "type": "check_in",
    "nama": "Danish Fayyadh Altamis", "nim": "18123044",
    "distanceMeters": 12.5, "locationType": "smart_classroom",
    "status": "present", "timestamp": "2026-06-20T03:05:23.000Z"
  }
}
```
> Deterministic ID `{sessionId}_{userId}_{type}`. WFH: `distanceMeters: null`, koordinat tidak disimpan.

#### `GET /api/attendances/me` (mobile)
Riwayat user. `?limit=20` (max 50). Terbaru dulu (indexed).

#### `GET /api/attendances/me/status?sessionId=xxx` (mobile)
Status check-in/out + window:
```json
{
  "success": true,
  "data": {
    "sessionId": "...", "hasCheckedIn": true, "hasCheckedOut": false,
    "checkInTime": "...", "checkOutTime": null,
    "window": { "allowCheckIn": false, "allowCheckOut": false, "reason": "between_windows" }
  }
}
```

---

### Users
`GET /api/users/me` — profil user login.
`POST /api/users` — simpan profil. Body: `{ name, nim, email }`.

---

### Courses (Enrollment)

#### `GET /api/courses/:courseId/students/:nim` (validasi enrollment)
**200 (terdaftar):**
```json
{ "success": true, "data": { "enrolled": true, "nim": "18123044", "nama": "Danish Fayyadh Altamis", "courseId": "...", "courseName": "..." } }
```
**404:** `NOT_ENROLLED`

#### `GET /api/courses/:courseId/students`
List mahasiswa terdaftar.

---

## Firestore Data Structure

### `sessions/{sessionId}`
```
namaKelas, kodeKelas, dosenEmail:  string
tanggal: "YYYY-MM-DD"   jamMulai, jamSelesai: "HH:mm" (WIB)
locationType: "smart_classroom" | "lab" | "wfh"
locationRequired: boolean
latitude, longitude, radius: number  (null untuk WFH)
status: "open" | "closed"
createdAt: timestamp   closedAt, closedBy: opsional
```

### `attendances/{sessionId}_{userId}_{type}`
```
sessionId, userId: string   type: "check_in" | "check_out"
nama, nim: string (lookup dari users)
namaKelas, kodeKelas, locationType: string
latitude, longitude, distanceMeters: number (null untuk WFH)
selfieUrl, status: string   timestamp: timestamp   waktu: string (WIB)
```

### `users/{uid}`
```
nama, email: string   role: "dosen" | "mahasiswa"   nim: string (mahasiswa)
```

### `courses/{courseId}`
```
nama, kode, dosenEmail: string   jumlahMahasiswa: number   createdAt: timestamp
```
Sub-collection `courses/{courseId}/students/{randomId}`: `{ nama, nim }`

---

## Composite Index (Firestore)
Query `GET /me` butuh: collection `attendances`, fields `userId` (Asc) + `timestamp` (Desc).

---

## Changelog

### v0.3 — June 20, 2026 (Phase 3)
- Auth Firebase token aktif, mock dev-only (R3)
- Indexed query GET /me (R1)
- Deterministic attendance ID (R2)
- Server-side auto-close cron (R4)
- Endpoint enrollment validation (R6)
- Check-in/out + window 15 menit, Mode WFH

### v0.2 — May 20, 2026 (Phase 2)
- Migrasi Firestore, field Bahasa Indonesia, soft auto-close

### v0.1 — May 17, 2026 (Draft)
- Initial draft