# Sistem Absensi GPS — ET 3204 Layanan Tersambung & Komputasi Awan (Kelompok 5)

Sistem Absensi Mahasiswa berbasis Geofencing GPS (dan dukungan Mode WFH) untuk mata kuliah **ET3204 Layanan Tersambung dan Komputasi Awan**. Sistem ini memungkinkan dosen membuka sesi perkuliahan dengan koordinat lokasi tertentu, dan mahasiswa melakukan absensi (*check-in* & *check-out*) menggunakan perangkat seluler mereka. Jarak mahasiswa ke lokasi kelas dihitung secara *real-time* di sisi backend menggunakan formula **Haversine**.

---

## 👥 Anggota Kelompok 5
1. **Rafly Nafisena Rahadian (18123003)** — Backend Engineer
2. **Kesha Mufrih Ramadhan (18123003)** — Mobile Developer (Flutter)
3. **Fadhil Agly Hakim (18123005)** — Cloud & Dashboard Developer (React)

---

## 🏛️ Arsitektur & Teknologi

Sistem ini terbagi menjadi tiga komponen utama yang saling terintegrasi:

```
                  ┌────────────────────────────────────────┐
                  │            Database & Auth             │
                  │        (Google Cloud Firestore)        │
                  └───────────────────▲────────────────────┘
                                      │ (Firebase Admin SDK)
                                      │
┌─────────────────────────┐  HTTP/JSON│   ┌─────────────────────────┐
│     Mobile Student      ├───────────┼──►│       Backend API       │
│    (Flutter App/Dart)   │           │   │  (Node/TypeScript/Exp)  │
└─────────────────────────┘           │   └────────────▲────────────┘
                                      │                │
┌─────────────────────────┐           │                │ HTTP/JSON
│     Lecturer Web        ├───────────┘                │
│    (React/JS/Vite)      ├────────────────────────────┘
└─────────────────────────┘
```

| Komponen | Deskripsi | Teknologi / Stack |
|---|---|---|
| **Backend API** | Memproses verifikasi lokasi, otentikasi user, mencatat riwayat kehadiran, dan sinkronisasi data dengan Firestore. | Node.js, Express, TypeScript, Firebase Admin SDK, Railway |
| **Mobile App** | Digunakan oleh mahasiswa untuk melakukan check-in dan check-out. Membaca GPS secara *real-time* dan mencocokkan radius ke kelas. | Flutter, Dart, Geolocator, HTTP client, Shared Preferences |
| **Lecturer Web** | Panel admin bagi dosen untuk mengelola kelas, membuka sesi (mengatur koordinat, radius, dan mode WFH), serta menutup sesi. | React.js, Firebase SDK, React Router |
| **Database** | Menyimpan seluruh dokumen sesi perkuliahan, data pengguna (dosen/mahasiswa), dan catatan kehadiran (*attendances*). | Cloud Firestore |

---

## ✨ Fitur Utama
1. **Geofencing (Validasi Lokasi)**: Perhitungan jarak mahasiswa ke ruang kelas secara akurat di backend menggunakan formula Haversine. Jika mahasiswa berada di luar radius kelas, absensi otomatis ditolak.
2. **Mode WFH (Work From Home)**: Dosen dapat membuat sesi khusus WFH. Pada mode ini, aplikasi mobile secara dinamis mem-bypass verifikasi GPS, menampilkan banner "Mode WFH 🏠", dan mengizinkan absensi tanpa batasan lokasi.
3. **Auto-Refresh & Manual Refresh**: Antarmuka menu absensi pada aplikasi mobile dilengkapi dengan *pull-to-refresh* dan tombol refresh manual (🔄) di bagian header agar status absensi (*check-in* / *check-out*) diperbarui dengan cepat.
4. **Soft Auto-Close Sesi**: Backend mendeteksi keaktifan sesi berdasarkan jam mulai, jam selesai, tanggal, dan status manual ("open").

---

## 📂 Struktur Proyek

```directory
TUBES-LTKA-KELOMPOK5/
├── Backend/api/               # Source code Express.js Backend API
│   ├── src/
│   │   ├── config/            # Inisialisasi Firebase SDK
│   │   ├── routes/            # Routes: sessions, attendances, users, health
│   │   └── utils/             # Helper: formula Haversine & Parser Waktu WIB
│   ├── package.json
│   └── tsconfig.json
├── Mobile/                    # Source code Flutter Mobile Client
│   ├── lib/
│   │   ├── models/            # Model data (Session & Attendance)
│   │   ├── screens/           # Halaman UI (Home, History, Login, Profile)
│   │   ├── widgets/           # Reusable widgets
│   │   └── config/            # Konfigurasi konstanta & API Endpoint
│   └── pubspec.yaml
├── dashboard/                 # Source code React.js Lecturer Panel
│   ├── src/
│   │   ├── pages/             # Halaman Web (Login, Dashboard)
│   │   └── firebase.js        # Konfigurasi Firebase client
│   └── package.json
├── API_CONTRACT.md            # Dokumentasi Endpoint & API contract
└── RINGKASAN_PROYEK.md        # Catatan serah terima (handoff) pengerjaan
```

---

## 🚀 Panduan Menjalankan Lokal

### 1. Prasyarat (Prerequisites)
- [Node.js](https://nodejs.org/) (Versi 18 atau lebih baru)
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (Versi 3.1.0 atau lebih baru)
- Akun Firebase dengan project Firestore dan Firebase Auth yang sudah siap.

### 2. Konfigurasi Database (Firebase)
1. Buat project baru di [Firebase Console](https://console.firebase.google.com/).
2. Aktifkan **Cloud Firestore** dan **Authentication** (Metode Email/Password).
3. Buatlah collection berikut pada Firestore:
   - `users`: Simpan dokumen user dengan ID dokumen = UID Auth user. Field: `nama` (string), `email` (string), `role` ("dosen" | "mahasiswa"), dan `nim` (string - opsional).
   - `sessions`: Menyimpan sesi perkuliahan.
   - `attendances`: Menyimpan log kehadiran mahasiswa.
4. Generate file Service Account JSON baru dari menu *Project Settings > Service Accounts*, kemudian unduh filenya.

---

### 3. Setup Backend API
1. Buka terminal pada folder `Backend/api`:
   ```bash
   cd Backend/api
   npm install
   ```
2. Buat file `.env` di dalam folder `Backend/api` berdasarkan contoh `.env.example`:
   ```env
   PORT=3000
   FIREBASE_PROJECT_ID=tugas-besar-ltka-xxxx
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@tugas-besar-ltka-xxxx.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...\n-----END PRIVATE KEY-----\n"
   ```
   *Catatan: Pastikan `FIREBASE_PRIVATE_KEY` menyertakan karakter `\n` secara literal.*
3. Jalankan server lokal:
   ```bash
   npm run dev
   ```
   Server akan berjalan di `http://localhost:3000`. Cek dengan membuka `http://localhost:3000/health`.

---

### 4. Setup Dashboard Dosen (Web)
1. Masuk ke folder `dashboard`:
   ```bash
   cd dashboard
   npm install
   ```
2. Hubungkan React dengan Firebase Client. Buat file konfigurasi Firebase atau edit `src/firebase.js` dengan mem-paste Firebase Config web app Anda dari Firebase Console.
3. Jalankan dashboard React:
   ```bash
   npm start
   ```
   Aplikasi akan terbuka otomatis di browser pada alamat `http://localhost:3000` (atau port alternatif).

---

### 5. Setup Mobile App (Flutter)
1. Buka folder `Mobile`:
   ```bash
   cd Mobile
   flutter pub get
   ```
2. Sesuaikan alamat IP API Backend pada file `Mobile/lib/config/constants.dart`. Ubah `baseUrl` ke IP komputer lokal Anda (misal `http://192.168.x.x:3000`) agar device fisik / emulator dapat mengakses API.
3. Jalankan aplikasi Flutter:
   ```bash
   flutter run
   ```

---

## ☁️ Panduan Deployment (Production)

### A. Deploy Backend ke Railway
Sistem backend dirancang agar mudah dideploy menggunakan platform cloud **Railway**:

1. Pastikan seluruh code backend berada pada branch target (misalnya branch `main` atau branch default repository Anda).
2. Buat proyek baru di [Railway](https://railway.app/).
3. Pilih **Deploy from GitHub repo**, lalu hubungkan dengan repository `TUBES-LTKA-KELOMPOK5`.
4. Atur konfigurasi build pada Railway dashboard:
   - **Root Directory**: `Backend/api`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Tambahkan **Environment Variables** berikut pada tab *Variables* di Railway:
   - `PORT` = `3000`
   - `FIREBASE_PROJECT_ID` = `tugas-besar-ltka-a29d4`
   - `FIREBASE_CLIENT_EMAIL` = `firebase-adminsdk-xxxx...`
   - `FIREBASE_PRIVATE_KEY` = `-----BEGIN PRIVATE KEY-----\nMIIEv...` (Paste langsung **TANPA tanda kutip** di Railway dashboard).
6. Setelah deployment selesai, Railway akan menyediakan URL publik (misal: `https://tubes-ltka-kelompok5-production.up.railway.app`).
7. Update variabel endpoint pada aplikasi Flutter (`baseUrl` pada `Mobile/lib/config/constants.dart`) untuk mengarah ke URL produksi Railway tersebut.

### B. Deploy Dashboard ke GitHub Pages (Opsional)
Untuk kemudahan akses, dashboard dosen dapat dideploy langsung ke GitHub Pages:
1. Install package `gh-pages` di folder `dashboard`:
   ```bash
   npm install gh-pages --save-dev
   ```
2. Tambahkan property `"homepage"` di file `dashboard/package.json`:
   ```json
   "homepage": "https://keshamr77.github.io/TUBES-LTKA-KELOMPOK5"
   ```
3. Tambahkan script deploy di `dashboard/package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```
4. Jalankan perintah deploy:
   ```bash
   npm run deploy
   ```
