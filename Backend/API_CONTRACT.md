# API Contract — Sistem Absensi GPS

**Project:** Tugas Besar LTKA — Kelompok 5
**Repository:** github.com/keshamr77/TUBES-LTKA-KELOMPOK5
**Backend Branch:** `fly-backend`
**Version:** v0.1 (Draft)
**Last Updated:** May 17, 2026
**Maintainer:** Rafly (Backend / Cloud Engineer)

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Base URL](#base-url)
4. [Authentication](#authentication)
5. [Standard Response Format](#standard-response-format)
6. [HTTP Status Codes](#http-status-codes)
7. [Error Codes](#error-codes)
8. [Endpoints](#endpoints)
   - [Users](#1-users)
   - [Courses](#2-courses)
   - [Sessions](#3-sessions)
   - [Attendances](#4-attendances)
9. [Firestore Data Structure](#firestore-data-structure)
10. [Notes for Mobile Developer](#notes-for-mobile-developer)
11. [Changelog](#changelog)
12. [TODOs & Open Questions](#todos--open-questions)

---

## Overview

Dokumen ini berisi spesifikasi REST API backend untuk sistem absensi berbasis GPS. API ini dikonsumsi oleh:

- **Mobile App (Flutter)** — untuk mahasiswa absen & dosen kelola sesi
- **Dashboard Web** (jika ada) — untuk dosen monitoring real-time

**Core feature:** validasi geofencing menggunakan **Haversine formula** — memastikan mahasiswa absen dari dalam radius kampus.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | Express.js |
| Database | Cloud Firestore (Firebase) |
| Auth | Firebase Auth (Firebase Admin SDK untuk verify) |
| File Storage | Cloud Storage (Firebase) |
| Deployment | Railway (auto-deploy dari GitHub) |

---

## Base URL

| Environment | URL |
|-------------|-----|
| **Production** | `https://[TBD].up.railway.app/api` *(update setelah deploy)* |
| **Local Dev** | `http://localhost:3000/api` |

> ⚠️ URL Production akan di-update di dokumen ini begitu Railway deploy berhasil.

---

## Authentication

Backend menggunakan **Firebase Auth ID Token** untuk autentikasi.

> ❌ **Tidak ada endpoint `/auth/login` atau `/auth/register` di backend.**
> Login & register di-handle 100% client-side oleh Firebase Auth SDK.

### 1. Login / Register (di Flutter)

```dart
// Register
final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
  email: email,
  password: password,
);

// Login
final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
  email: email,
  password: password,
);

// Get ID Token
final idToken = await cred.user!.getIdToken();
```

Setelah register, kirim user data tambahan (nama, role, NIM) ke backend via `POST /api/users` (lihat endpoint di bawah).

### 2. Attach Token ke Setiap Request

Setiap request ke backend (kecuali `POST /api/users` saat register pertama) wajib pakai header:

```
Authorization: Bearer <ID_TOKEN>
```

Contoh di Flutter:

```dart
final response = await http.post(
  Uri.parse('$baseUrl/attendances'),
  headers: {
    'Authorization': 'Bearer $idToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({...}),
);
```

### 3. Token Lifecycle

- ID Token valid selama **1 jam**
- Firebase SDK otomatis refresh token di background
- Kalau dapet response `401 TOKEN_EXPIRED` → call `user.getIdToken(true)` untuk force refresh

---

## Standard Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // payload spesifik per endpoint
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

## HTTP Status Codes

| Code | Meaning | Kapan |
|------|---------|-------|
| `200` | OK | GET success |
| `201` | Created | POST success (resource baru dibuat) |
| `400` | Bad Request | Payload invalid / field missing |
| `401` | Unauthorized | Token gak ada / invalid / expired |
| `403` | Forbidden | Token valid tapi user gak punya akses |
| `404` | Not Found | Resource gak ada |
| `409` | Conflict | Duplikat (misal: sudah absen di sesi yang sama) |
| `410` | Gone | Resource sudah gak valid (misal: sesi udah closed) |
| `500` | Internal Server Error | Bug di backend |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PAYLOAD` | 400 | Field di body invalid atau missing |
| `UNAUTHORIZED` | 401 | Token gak ada |
| `TOKEN_INVALID` | 401 | Token format salah |
| `TOKEN_EXPIRED` | 401 | Token expired, perlu refresh |
| `FORBIDDEN_ROLE` | 403 | Role user gak boleh akses endpoint ini |
| `NOT_ENROLLED` | 403 | Student gak enroll di course |
| `OUT_OF_RADIUS` | 403 | Lokasi user di luar radius kampus |
| `NOT_FOUND` | 404 | Resource gak ada |
| `ALREADY_SUBMITTED` | 409 | Sudah absen di sesi ini |
| `SESSION_CLOSED` | 410 | Sesi sudah ditutup |
| `SESSION_NOT_STARTED` | 410 | Sesi belum dimulai |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Endpoints

### 1. Users

#### `POST /api/users`

Dipanggil **sekali** setelah register Firebase Auth, untuk simpan data tambahan (nama, role, NIM/NIP) ke Firestore.

**Auth:** Required (token dari user yang baru register)

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Nama lengkap |
| `role` | string | Yes | `"student"` atau `"lecturer"` |
| `nim` | string | conditional | Wajib kalau role = student |
| `nip` | string | conditional | Wajib kalau role = lecturer |

**Request Example:**

```json
POST /api/users
Authorization: Bearer <id_token>
Content-Type: application/json

{
  "name": "Rafly Nafisen",
  "role": "student",
  "nim": "1301220001"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "userId": "abc123xyz",
    "email": "rafly@students.telkomuniversity.ac.id",
    "name": "Rafly Nafisen",
    "role": "student",
    "nim": "1301220001",
    "createdAt": "2026-05-17T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 INVALID_PAYLOAD` — Field invalid atau missing
- `401 UNAUTHORIZED` — Token gak valid
- `409 ALREADY_SUBMITTED` — User udah pernah seed data

---

#### `GET /api/users/me`

Ambil data user yang lagi login.

**Auth:** Required

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "userId": "abc123xyz",
    "email": "rafly@students.telkomuniversity.ac.id",
    "name": "Rafly Nafisen",
    "role": "student",
    "nim": "1301220001"
  }
}
```

---

### 2. Courses

#### `GET /api/courses`

List semua course user.
- Kalau **student** → course yang dia enrolled
- Kalau **lecturer** → course yang dia ajar

**Auth:** Required

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "courseId": "course_001",
      "name": "Layanan Tersambung dan Komputasi Awan",
      "code": "LTKA-CCH3D3",
      "lecturer": {
        "id": "lec_001",
        "name": "Dr. ABC"
      },
      "location": {
        "latitude": -6.9728,
        "longitude": 107.6304,
        "radiusMeters": 100
      }
    }
  ]
}
```

---

### 3. Sessions

#### `POST /api/sessions`

Dosen buka sesi absensi baru.

**Auth:** Required (Role: `lecturer`)

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `courseId` | string | Yes | ID course |
| `durationMinutes` | number | Yes | Berapa lama sesi buka (misal: 15 menit) |

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "courseId": "course_001",
    "startTime": "2026-05-17T10:00:00Z",
    "endTime": "2026-05-17T10:15:00Z",
    "status": "open"
  }
}
```

**Error Responses:**
- `403 FORBIDDEN_ROLE` — User bukan dosen
- `404 NOT_FOUND` — Course gak ada

---

#### `GET /api/sessions/active`

List sesi yang **sedang buka** untuk user.

**Auth:** Required

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "sessionId": "sess_001",
      "course": {
        "id": "course_001",
        "name": "Layanan Tersambung dan Komputasi Awan"
      },
      "startTime": "2026-05-17T10:00:00Z",
      "endTime": "2026-05-17T10:15:00Z",
      "location": {
        "latitude": -6.9728,
        "longitude": 107.6304,
        "radiusMeters": 100
      }
    }
  ]
}
```

---

#### `PATCH /api/sessions/:sessionId/close`

Dosen tutup sesi.

**Auth:** Required (Role: `lecturer`, harus dosen pengampu)

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "status": "closed",
    "closedAt": "2026-05-17T10:14:32Z",
    "totalAttendances": 28
  }
}
```

---

### 4. Attendances

#### `POST /api/attendances` ⭐ CORE ENDPOINT

Submit absensi dengan validasi geofencing (Haversine formula).

**Auth:** Required (Role: `student`)

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | ID sesi absensi |
| `latitude` | number | Yes | Lokasi GPS user |
| `longitude` | number | Yes | Lokasi GPS user |
| `selfieUrl` | string | Yes | URL foto selfie (sudah di-upload ke Cloud Storage) |

**Request Example:**

```json
POST /api/attendances
Authorization: Bearer <id_token>
Content-Type: application/json

{
  "sessionId": "sess_001",
  "latitude": -6.97285,
  "longitude": 107.63042,
  "selfieUrl": "https://firebasestorage.googleapis.com/.../selfie_abc.jpg"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "attendanceId": "att_001",
    "sessionId": "sess_001",
    "distanceMeters": 45.2,
    "status": "present",
    "timestamp": "2026-05-17T10:05:23Z"
  }
}
```

**Error Responses:**
- `400 INVALID_PAYLOAD` — Field invalid
- `401 UNAUTHORIZED` — Token gak valid
- `403 NOT_ENROLLED` — User gak enroll di course
- `403 OUT_OF_RADIUS` — Lokasi di luar radius (response dengan detail):
  ```json
  {
    "success": false,
    "error": {
      "code": "OUT_OF_RADIUS",
      "message": "Anda berada di luar radius kampus",
      "details": {
        "distanceMeters": 245.7,
        "allowedRadiusMeters": 100
      }
    }
  }
  ```
- `409 ALREADY_SUBMITTED` — Sudah absen di sesi ini
- `410 SESSION_CLOSED` — Sesi udah ditutup
- `410 SESSION_NOT_STARTED` — Sesi belum dimulai

---

#### `GET /api/attendances/me`

Riwayat absensi user yang lagi login.

**Auth:** Required (Role: `student`)

**Query Params (optional):**

| Param | Type | Description |
|-------|------|-------------|
| `courseId` | string | Filter berdasarkan course |
| `limit` | number | Max 50 (default: 20) |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "attendanceId": "att_001",
      "session": {
        "id": "sess_001",
        "courseName": "Layanan Tersambung dan Komputasi Awan"
      },
      "timestamp": "2026-05-17T10:05:23Z",
      "status": "present",
      "distanceMeters": 45.2
    }
  ]
}
```

---

#### `GET /api/sessions/:sessionId/attendances`

List absensi di sebuah sesi (untuk dosen monitor).

**Auth:** Required (Role: `lecturer`, harus dosen pengampu)

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "sess_001",
      "courseName": "Layanan Tersambung dan Komputasi Awan",
      "startTime": "2026-05-17T10:00:00Z"
    },
    "totalEnrolled": 30,
    "totalPresent": 28,
    "attendances": [
      {
        "userId": "user_001",
        "name": "Rafly Nafisen",
        "nim": "1301220001",
        "timestamp": "2026-05-17T10:05:23Z",
        "status": "present",
        "distanceMeters": 45.2,
        "selfieUrl": "https://..."
      }
    ]
  }
}
```

---

## Firestore Data Structure

> Mobile app bisa langsung **baca** beberapa data dari Firestore tanpa lewat backend (read-only, security rules diatur backend). Backend hanya untuk **write** operations yang butuh validasi.

### Collection: `users/{userId}`

```json
{
  "email": "rafly@students.telkomuniversity.ac.id",
  "name": "Rafly Nafisen",
  "role": "student",
  "nim": "1301220001",
  "createdAt": Timestamp
}
```

### Collection: `courses/{courseId}`

```json
{
  "name": "Layanan Tersambung dan Komputasi Awan",
  "code": "LTKA-CCH3D3",
  "lecturerId": "user_xyz",
  "enrolledStudents": ["user_001", "user_002"],
  "location": {
    "latitude": -6.9728,
    "longitude": 107.6304,
    "radiusMeters": 100
  },
  "createdAt": Timestamp
}
```

### Collection: `sessions/{sessionId}`

```json
{
  "courseId": "course_001",
  "lecturerId": "user_xyz",
  "startTime": Timestamp,
  "endTime": Timestamp,
  "status": "open" | "closed",
  "createdAt": Timestamp
}
```

### Collection: `attendances/{attendanceId}`

```json
{
  "sessionId": "sess_001",
  "userId": "user_001",
  "courseId": "course_001",
  "timestamp": Timestamp,
  "location": {
    "latitude": -6.97285,
    "longitude": 107.63042
  },
  "distanceMeters": 45.2,
  "selfieUrl": "https://...",
  "status": "present" | "late" | "invalid"
}
```

---

## Notes for Mobile Developer

### Upload Selfie Flow

1. User foto selfie di Flutter
2. **Upload langsung ke Cloud Storage dari Flutter** (pakai package `firebase_storage`)
3. Dapet URL setelah upload sukses
4. Kirim URL itu di body `POST /api/attendances`

```dart
final ref = FirebaseStorage.instance
  .ref('selfies/$userId/$timestamp.jpg');
await ref.putFile(File(imagePath));
final selfieUrl = await ref.getDownloadURL();

// Lalu kirim ke backend
await http.post(...);
```

### GPS Best Practices

- Cek permission GPS dulu sebelum buka halaman absensi
- Gunakan `LocationAccuracy.high` di Geolocator
- Cache lokasi terakhir untuk fallback (max 30 detik)
- Tampilkan loading saat ambil GPS

### Common Error Handling

| Backend Error | UI Action |
|---------------|-----------|
| `OUT_OF_RADIUS` | Tampilin dialog: "Anda di luar radius kampus" + jarak |
| `SESSION_CLOSED` | Disable tombol absen, tampilin pesan |
| `ALREADY_SUBMITTED` | Tampilin status "Sudah Absen" |
| `TOKEN_EXPIRED` | Force refresh token, retry sekali |
| `NOT_ENROLLED` | Tampilin pesan "Anda tidak terdaftar di mata kuliah ini" |

### Realtime Updates (Optional)

Untuk fitur "dosen lihat absensi real-time", subscribe langsung ke Firestore tanpa polling backend:

```dart
FirebaseFirestore.instance
  .collection('attendances')
  .where('sessionId', isEqualTo: currentSessionId)
  .snapshots()
  .listen((snapshot) {
    // Update UI tiap ada absensi baru
  });
```

---

## Changelog

### v0.1 — May 17, 2026 (Draft)
- Initial draft
- Setup auth flow via Firebase Auth
- Define core endpoints: users, courses, sessions, attendances
- Define error codes & response formats

---

## TODOs & Open Questions

- [ ] URL production Railway belum di-set (update setelah deploy pertama)
- [ ] Endpoint export attendance ke CSV (kalau di-scope)
- [ ] Endpoint untuk enroll student ke course (manual oleh dosen atau auto?)
- [ ] Rate limiting strategy (mencegah spam absen)
- [ ] Validasi waktu absen: boleh absen 5 menit sebelum sesi buka? Atau strict at start time?
- [ ] Apakah dosen perlu approve absensi manual untuk kasus edge (misal: mahasiswa gak bisa selfie)?

---

**Maintained by:** Rafly (Backend Engineer)
**For questions:** Comment di branch `fly-backend` di GitHub atau chat grup tim.
