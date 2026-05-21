# API Contract — Sistem Absensi GPS

**Project:** Tugas Besar LTKA — Kelompok 5
**Repository:** github.com/keshamr77/TUBES-LTKA-KELOMPOK5
**Backend Branch:** `fly-backend`
**Version:** v0.2 (Phase 2 — Firestore Integration)
**Last Updated:** May 20, 2026
**Maintainer:** Rafly (Backend / Cloud Engineer)

---

## ⚠️ Perubahan dari v0.1 (Penting Dibaca)

1. **Backend pakai Railway + Express.js + Firestore** (bukan Cloud Functions).
2. **Nama field pakai Bahasa Indonesia** sesuai struktur Firestore tim (`jamMulai`, `jamSelesai`, `namaKelas`, `tanggal`, dll) — BUKAN Inggris seperti draft v0.1.
3. **Lokasi & radius ada di dalam dokumen `sessions`** (tiap sesi bawa koordinat sendiri), bukan di collection `courses` terpisah.
4. **Auth masih sementara** pakai header `X-Mock-User-Id` (Phase 2). Verifikasi Firebase Auth token menyusul di Phase 3.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | Express.js |
| Database | Cloud Firestore (Firebase) |
| Auth | Firebase Auth (Phase 3) — sementara `X-Mock-User-Id` |
| Deployment | Railway (auto-deploy dari branch `fly-backend`) |

---

## Base URL

| Environment | URL |
|-------------|-----|
| **Production** | `https://tubes-ltka-kelompok5-production.up.railway.app/api` |
| **Local Dev** | `http://localhost:3000/api` |

> ⚠️ Ganti `[GANTI_DENGAN_URL_RAILWAY]` dengan URL Railway yang sebenarnya
> (cek Railway → Settings → Networking). Contoh: `https://tubes-ltka-production.up.railway.app/api`

---

## Authentication (Phase 2 — Sementara)

> ❌ **Belum ada verifikasi Firebase token.** Sementara pakai header untuk identifikasi user.

Setiap request yang butuh identitas user, kirim header:

```
X-Mock-User-Id: <id_user>
```

Contoh: `X-Mock-User-Id: user_test_001`

> 🔜 **Phase 3:** akan diganti jadi `Authorization: Bearer <firebase_id_token>`.
> Mobile dev: siapkan kode-nya supaya gampang switch nanti (taruh header di satu tempat
> terpusat, jangan hardcode di tiap request).

---

## Standard Response Format

### Success
```json
{
  "success": true,
  "data": { }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Pesan error"
  }
}
```

---

## HTTP Status Codes

| Code | Arti |
|------|------|
| `200` | OK (GET berhasil) |
| `201` | Created (POST berhasil) |
| `400` | Bad Request (payload invalid) |
| `403` | Forbidden (di luar radius) |
| `404` | Not Found (sesi tidak ada) |
| `409` | Conflict (sudah absen) |
| `410` | Gone (sesi closed / belum mulai / waktu habis) |
| `500` | Internal Server Error |

---

## Error Codes

| Code | HTTP | Arti |
|------|------|------|
| `INVALID_PAYLOAD` | 400 | Field invalid/kurang |
| `OUT_OF_RADIUS` | 403 | Lokasi di luar radius sesi |
| `NOT_FOUND` | 404 | Sesi tidak ditemukan |
| `ALREADY_SUBMITTED` | 409 | Sudah absen di sesi ini |
| `SESSION_CLOSED` | 410 | Sesi sudah ditutup / waktu habis |
| `SESSION_NOT_STARTED` | 410 | Sesi belum dimulai |
| `INTERNAL_ERROR` | 500 | Error server |

---

## Endpoints

### Health Check

#### `GET /health`
Cek server hidup. Tidak butuh auth.

**Response 200:**
```json
{
  "success": true,
  "data": { "status": "healthy", "timestamp": "...", "env": "production" }
}
```

---

### Sessions

#### `GET /api/sessions/active` ⭐ (dipakai mobile)
List sesi yang sedang aktif. Sesi dianggap aktif kalau `status == "open"` DAN waktu sekarang masih di antara `jamMulai`–`jamSelesai` pada `tanggal` tersebut (zona waktu WIB).

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "2Pd0FUVs8VclkUCQCWKy",
      "namaKelas": "Layanan Tersambung & Komputasi Awan",
      "kodeKelas": "ET 3204",
      "dosenEmail": "dosen@itb.ac.id",
      "tanggal": "2026-05-20",
      "jamMulai": "00:01",
      "jamSelesai": "23:59",
      "status": "open",
      "location": {
        "latitude": -6.89059,
        "longitude": 107.610692,
        "radius": 50
      },
      "isActive": true,
      "timeStatus": "active"
    }
  ]
}
```

> Kalau tidak ada sesi aktif, `data` berupa array kosong `[]`. Itu normal.

---

#### `GET /api/sessions`
List semua sesi (buat dashboard / debugging). Response sama seperti di atas tapi semua sesi (termasuk yang closed).

---

#### `GET /api/sessions/:sessionId`
Detail satu sesi. Response: satu objek session (bukan array).
Error `404 NOT_FOUND` kalau sesi tidak ada.

---

#### `POST /api/sessions` (dipakai dashboard dosen)
Bikin sesi baru.

**Body:**
| Field | Type | Wajib | Catatan |
|-------|------|-------|---------|
| `namaKelas` | string | Yes | Nama mata kuliah |
| `kodeKelas` | string | Yes | Kode kelas |
| `dosenEmail` | string | No | Email dosen |
| `tanggal` | string | Yes | Format `YYYY-MM-DD` |
| `jamMulai` | string | Yes | Format `HH:mm` (WIB) |
| `jamSelesai` | string | Yes | Format `HH:mm` (WIB) |
| `latitude` | number | Yes | Koordinat kampus |
| `longitude` | number | Yes | Koordinat kampus |
| `radius` | number | Yes | Radius dalam meter |

**Request Example:**
```json
{
  "namaKelas": "Layanan Tersambung & Komputasi Awan",
  "kodeKelas": "ET 3204",
  "dosenEmail": "dosen@itb.ac.id",
  "tanggal": "2026-05-20",
  "jamMulai": "10:00",
  "jamSelesai": "10:30",
  "latitude": -6.89059,
  "longitude": 107.610692,
  "radius": 50
}
```

**Response 201:** objek session yang baru dibuat (dengan `sessionId`, `status: "open"`, `isActive`).

---

#### `PATCH /api/sessions/:sessionId/close`
Tutup sesi manual (set `status` jadi `closed`).

**Response 200:** objek session dengan `status: "closed"`.

---

### Attendances

#### `POST /api/attendances` ⭐ CORE (dipakai mobile)
Submit absensi dengan validasi: sesi ada → status open → dalam rentang waktu → dalam radius (Haversine) → belum absen sebelumnya.

**Headers:** `X-Mock-User-Id: <id_user>`, `Content-Type: application/json`

**Body:**
| Field | Type | Wajib |
|-------|------|-------|
| `sessionId` | string | Yes |
| `latitude` | number | Yes |
| `longitude` | number | Yes |
| `selfieUrl` | string | Yes |

**Request Example:**
```json
{
  "sessionId": "2Pd0FUVs8VclkUCQCWKy",
  "latitude": -6.89059,
  "longitude": 107.610692,
  "selfieUrl": "https://firebasestorage.googleapis.com/.../selfie.jpg"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "attendanceId": "...",
    "sessionId": "2Pd0FUVs8VclkUCQCWKy",
    "distanceMeters": 0,
    "status": "present",
    "timestamp": "2026-05-20T03:05:23.000Z"
  }
}
```

**Error 403 OUT_OF_RADIUS:**
```json
{
  "success": false,
  "error": {
    "code": "OUT_OF_RADIUS",
    "message": "Anda berada di luar radius kampus",
    "details": { "distanceMeters": 245.7, "allowedRadiusMeters": 50 }
  }
}
```

Error lain: `404 NOT_FOUND` (sesi gak ada), `410 SESSION_CLOSED` / `SESSION_NOT_STARTED`, `409 ALREADY_SUBMITTED`.

---

#### `GET /api/attendances/me` (dipakai mobile)
Riwayat absensi user.

**Headers:** `X-Mock-User-Id: <id_user>`
**Query (opsional):** `?limit=20` (max 50)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "attendanceId": "...",
      "session": { "id": "2Pd0FUVs8VclkUCQCWKy", "courseName": "Layanan Tersambung & Komputasi Awan" },
      "timestamp": "2026-05-20T03:05:23.000Z",
      "status": "present",
      "distanceMeters": 0
    }
  ]
}
```

---

## Firestore Data Structure

### Collection: `sessions/{sessionId}`
```
namaKelas:   string   "Layanan Tersambung & Komputasi Awan"
kodeKelas:   string   "ET 3204"
dosenEmail:  string   "dosen@itb.ac.id"
tanggal:     string   "2026-05-20"   (YYYY-MM-DD)
jamMulai:    string   "10:00"        (HH:mm, WIB)
jamSelesai:  string   "10:30"        (HH:mm, WIB)
latitude:    number   -6.89059
longitude:   number   107.610692
radius:      number   50             (meter)
status:      string   "open" | "closed"
createdAt:   timestamp
closedAt:    timestamp  (opsional, ada kalau di-close manual)
```

### Collection: `attendances/{attendanceId}`
```
sessionId:      string
userId:         string   (sementara dari X-Mock-User-Id)
namaKelas:      string
kodeKelas:      string
latitude:       number   (lokasi user saat absen)
longitude:      number
distanceMeters: number   (jarak user ke titik sesi)
selfieUrl:      string
status:         string   "present"
timestamp:      timestamp
```

---

## Notes for Mobile Developer

### Flow Absensi
1. `GET /api/sessions/active` → tampilkan daftar sesi aktif
2. User pilih sesi → ambil `sessionId` + `location` (buat tampilkan info radius)
3. Ambil GPS user + upload selfie ke Cloud Storage → dapat `selfieUrl`
4. `POST /api/attendances` dengan `sessionId`, koordinat user, `selfieUrl`
5. Handle response: sukses (201) atau error (403 out of radius, 409 sudah absen, dll)

### Error Handling UI
| Error | Aksi UI |
|-------|---------|
| `OUT_OF_RADIUS` | Dialog "Di luar radius kampus" + tampilkan jarak |
| `SESSION_CLOSED` | Disable tombol absen |
| `ALREADY_SUBMITTED` | Tampilkan status "Sudah Absen" |
| `SESSION_NOT_STARTED` | Tampilkan "Sesi belum dimulai" |

---

## Changelog

### v0.2 — May 20, 2026 (Phase 2)
- Migrasi ke Firestore (sessions + attendances jadi data nyata)
- Field disamakan dengan struktur Firestore tim (Bahasa Indonesia)
- Lokasi & radius diambil dari dokumen sesi
- Logic soft auto-close berbasis waktu WIB
- Endpoint sessions: GET active, GET all, GET by id, POST, PATCH close

### v0.1 — May 17, 2026 (Draft)
- Initial draft (asумsi Cloud Functions, field Inggris) — sudah di-revisi di v0.2

---

## TODO (Phase 3+)
- [ ] Ganti `X-Mock-User-Id` → verifikasi Firebase Auth token (middleware)
- [ ] Validasi role (student/lecturer) untuk endpoint tertentu
- [ ] Endpoint enroll mahasiswa ke kelas
- [ ] Rate limiting
- [ ] Restrict CORS ke domain mobile & dashboard (sekarang masih allow all)
