# 🏫 Sistem Presensi Digital & Alat Absen IoT (Fingerprint + RFID)

<p align="center">
  <img src="https://img.shields.io/badge/Microcontroller-ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" alt="ESP32">
  <img src="https://img.shields.io/badge/Sensor-R307%20Fingerprint%20%2B%20RC522%20RFID-00599C?style=for-the-badge&logo=arduino&logoColor=white" alt="Sensors">
  <img src="https://img.shields.io/badge/Backend-Google%20Apps%20Script-34A853?style=for-the-badge&logo=google-sheets&logoColor=white" alt="Google Sheets">
  <img src="https://img.shields.io/badge/Frontend-SPA%20Dashboard-006C49?style=for-the-badge&logo=html5&logoColor=white" alt="Frontend">
  <img src="https://img.shields.io/badge/Deployment-Vercel%20Ready-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/Cost-Zero%20Subscription%20Fee-F4B400?style=for-the-badge" alt="Zero Cost">
</p>

---

## 📖 Tentang Proyek

**Sistem Presensi Digital & Alat Absen IoT** adalah ekosistem absensi cerdas terintegrasi yang dirancang untuk institusi pendidikan (seperti SMA Daruttaqwa) maupun perkantoran. Sistem ini menggabungkan **Mesin Absen Fisik Berbasis IoT (ESP32)** dengan **Dashboard Web Pemantau Real-Time** yang terhubung langsung ke **Google Spreadsheet** sebagai basis data cloud tanpa biaya langganan bulanan (*Zero Cloud Subscription Cost*).

Dibandingkan mesin absensi konvensional, sistem ini menawarkan keunggulan mutakhir:
- 🚀 **Pendaftaran Guru via Web**: Tidak perlu lagi membuka alamat IP lokal alat (`192.168.x.x`) yang rumit. Cukup daftarkan lewat Web Dashboard dari HP/Laptop di mana saja, mesin absen di sekolah akan otomatis aktif merekam data.
- 🛡️ **Bebas Bentrok ID (Multi-Machine Support)**: Dilengkapi alokasi prefix ID otomatis (`A_`, `B_`, dst.), sehingga aman digunakan untuk banyak mesin sekaligus tanpa risiko data tertukar atau saling menimpa.
- 📊 **Analitik & Persentase Kehadiran Otomatis**: Bukan sekadar baris data mentah di spreadsheet, web dashboard secara cerdas menghitung persentase kehadiran, akumulasi keterlambatan, dan status bebas tugas secara proporsional.
- ⏱️ **Tap Konfirmasi Pulang**: Mencegah salah pencet saat baru tiba di pagi hari. 1 kali tap untuk masuk, dan 2 kali tap untuk konfirmasi kepulangan.

---

## 🏗️ Arsitektur Sistem

```
 ┌────────────────────────────────────────────────────────┐
 │                   HARDWARE ALAT ABSEN                  │
 │  • ESP32 NodeMCU (WiFi & Web Client)                   │
 │  • R307 Optical Fingerprint Sensor (Serial2)           │
 │  • MFRC522 RFID Reader 13.56 MHz (SPI)                 │
 │  • LCD I2C 16x2 Display + Audio Buzzer Feedback        │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼ HTTP GET/POST (TLS/SSL)
 ┌────────────────────────────────────────────────────────┐
 │              GOOGLE CLOUD BACKEND (SERVERLESS)         │
 │  • Google Apps Script (GAS) Web App Endpoint           │
 │  • Spreadsheet "Database Guru" (ID, Nama, Role)        │
 │  • Spreadsheet "Device_Commands" (Remote Enroll Queue) │
 │  • Daily Sheets "Log_dd-MM-yyyy" (Waktu, Masuk, Keluar)│
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼ Google Visualization API / JSONP
 ┌────────────────────────────────────────────────────────┐
 │                 WEB & MOBILE DASHBOARD                 │
 │  • Real-Time Monitoring & Auto-Sync (20 Detik)         │
 │  • 5 KPI Metric Cards (Hadir, Tepat Waktu, Terlambat)  │
 │  • Manajemen Guru (Custom Nama, Gelar, Status Tugas)   │
 │  • Perhitungan Adil Guru Honorer / Bebas Tugas         │
 │  • 1-Klik Ekspor Microsoft Excel (.XLS) & CSV          │
 │  • Mobile-First Responsive UI (Floating Dock Bar)      │
 └────────────────────────────────────────────────────────┘
```

---

## 🌟 Fitur-Fitur Utama

### 1. 🤖 Mesin Absensi IoT (Hardware)
- **Dual Authentication**: Guru bebas memilih verifikasi sidik jari (optik R307) atau kartu pintar (RFID/NFC/e-KTP).
- **Pencegah Salah Pulang**: Sistem pintar mengenali status kehadiran guru hari itu. Tap pertama dicatat sebagai **Masuk**. Untuk kepulangan, alat meminta 2 kali tap berurutan sebagai konfirmasi sadar.
- **Sistem Perintah Jarak Jauh (*Cloud Command Relay*)**: Alat secara berkala memeriksa antrean perintah di cloud. Saat admin menekan tombol "Daftar Jari" di website, alat otomatis masuk ke mode registrasi.
- **Dukungan Multi-Mesin Tanpa Bentrok**: Dilengkapi konfigurasi nama dan prefix ID (`DEVICE_PREFIX = "A_"`, `DEVICE_PREFIX = "B_"`). ID kartu maupun sidik jari dipetakan unik ke Google Sheets.
- **Proteksi Memori Non-Volatile**: Data sidik jari tersimpan di modul memori internal mesin, tidak akan terhapus meski listrik padam atau WiFi terputus.

### 2. 💻 Web Dashboard & Mobile Portal
- **Tampilan Mewah Berkelas (*Modern Glassmorphism*)**: Palet warna *Deep Forest Pine* (`#004532`) dan *Mint Accent* (`#006c49`) dengan kartu frosted glass yang bersih dan profesional.
- **5 Kartu Indikator Cepat**: Kepala Sekolah dapat mengevaluasi dalam 3 detik: Total Guru Hadir, Tepat Waktu (sebelum 07:15 WIB), Terlambat, Izin/Sakit/Bebas Tugas, dan Status Koneksi Mesin.
- **Manajemen Guru & Kustomisasi Profil**: Bebas mengedit nama lengkap, gelar akademik, NIP, peran (Pengajar/Tata Usaha), dan status tugas (Guru Tetap / Honorer).
- **Perhitungan Adil Guru Paruh Waktu (*Bebas Tugas*)**: Guru yang tidak memiliki jadwal mengajar di hari tertentu tidak dianggap alpa, melainkan berstatus bebas tugas dengan persentase kehadiran yang dihitung adil.
- **Ekspor Laporan Siap Cetak**: Mendukung unduh rekapitulasi kehadiran bulanan ke format Microsoft Excel (`.XLS`) bergaris rapi dan format `.CSV`.
- **Desain Khusus Smartphone**: Dilengkapi navigasi mengambang (*Floating Dock*), splash screen terintegrasi, dan lembar menu bawah (*bottom sheets*) yang nyaman digunakan dengan satu tangan.
- **3 Tingkatan Akses Privasi**:
  1. *Guru Pengajar*: Hanya dapat melihat jadwal kelas dan log absensi pribadinya.
  2. *Kepala Sekolah*: Memantau kedisiplinan guru, grafik persentase, dan mengunduh laporan bulanan.
  3. *Admin Sistem*: Mengelola data guru, mendaftarkan sidik jari jarak jauh, dan memantau status alat.

---

## 📁 Struktur Berkas Repositori

```bash
Alat_Absen/
├── Brosur_Fitur_Presensi_SMA_Daruttaqwa.pdf   # Brosur 2 halaman resmi siap cetak untuk customer
├── Brosur_Fitur_Presensi_SMA_Daruttaqwa.html  # Source HTML brosur klien (Pixel-perfect A4)
├── Code_Google_Sheets.js                      # Backend script untuk Google Apps Script (GAS)
├── Program_ESP.txt                            # Firmware lengkap ESP32 (Arduino C++)
├── README.md                                  # Dokumentasi utama proyek
├── .gitignore                                 # Aturan file yang diabaikan git
└── Dashboard_Absen/                           # Web Application Frontend
    ├── index.html                             # Struktur Single Page Application (SPA)
    ├── style.css                              # Design System, Glassmorphism & Mobile Breakpoints
    ├── app.js                                 # Logika interaktif, filter, simulator & auto-sync
    ├── data.js                                # Google Sheets GViz API connector & kalkulasi %
    ├── vercel.json                            # Konfigurasi zero-config deploy untuk Vercel
    └── Referensi UI.txt                       # Catatan rancangan spesifikasi UI
```

---

## 🔌 Skema & Konfigurasi Pin Hardware (ESP32)

| Komponen | Pin Modul | Pin ESP32 | Keterangan |
| :--- | :--- | :--- | :--- |
| **Sensor Sidik Jari R307** | TX | GPIO 16 (RX2) | Serial Hardware 2 |
| | RX | GPIO 17 (TX2) | Serial Hardware 2 |
| | VCC / GND | 5V / GND | Daya 5 Volt stabil |
| **RFID Reader MFRC522** | SDA / SS | GPIO 5 | SPI Slave Select |
| | SCK | GPIO 18 | SPI Clock |
| | MOSI | GPIO 23 | SPI MOSI |
| | MISO | GPIO 19 | SPI MISO |
| | RST | GPIO 4 | Reset Pin |
| | 3.3V / GND | 3.3V / GND | **Wajib 3.3V** |
| **LCD Display 16x2 I2C** | SDA | GPIO 21 | I2C Data |
| | SCL | GPIO 22 | I2C Clock |
| | VCC / GND | 5V / GND | Alamat I2C umum `0x27` |
| **Buzzer Audio** | Positive (+) | GPIO 15 | Active Buzzer |
| | Negative (-) | GND | Ground |

---

## 🚀 Panduan Instalasi & Penggunaan

### Langkah 1: Pasang Google Apps Script
1. Buat **Google Spreadsheet** baru di Google Drive Anda.
2. Buka menu **Extensions > Apps Script**.
3. Salin seluruh isi berkas [`Code_Google_Sheets.js`](Code_Google_Sheets.js) ke dalam editor script.
4. Klik **Deploy > New Deployment**.
5. Pilih jenis **Web App**:
   - *Execute as*: **Me (akun Anda)**
   - *Who has access*: **Anyone** (agar ESP32 dan Dashboard Web dapat mengirim/menerima data).
6. Salin **Web App URL** yang dihasilkan.

### Langkah 2: Flash Program ke ESP32
1. Buka Arduino IDE dan pastikan board **ESP32 Dev Module** sudah terinstal.
2. Instal pustaka (library) yang dibutuhkan:
   - `Adafruit Fingerprint Sensor Library`
   - `MFRC522` by GithubCommunity
   - `LiquidCrystal_I2C`
   - `WiFiManager`
3. Salin isi [`Program_ESP.txt`](Program_ESP.txt) ke dalam sketch Arduino IDE (`.ino`).
4. Sesuaikan konstanta berikut:
   ```cpp
   const String DEVICE_NAME   = "A";   // Mesin A, B, dst.
   const String DEVICE_PREFIX = "A_";  // Prefix ID unik
   String GOOGLE_SCRIPT_URL   = "URL_WEB_APP_ANDA_DISINI";
   ```
5. Hubungkan ESP32 via kabel Micro-USB dan klik **Upload**.
6. Saat pertama kali menyala, ESP32 akan memancarkan WiFi Access Point untuk konfigurasi WiFi sekolah tanpa perlu hardcode SSID/Password.

### Langkah 3: Menjalankan Web Dashboard
Web Dashboard adalah aplikasi Single Page Application (SPA) murni tanpa build tool yang rumit:

#### A. Menjalankan di Komputer Lokal:
```bash
# Masuk ke folder dashboard
cd Dashboard_Absen

# Jalankan dengan Python
python -m http.server 8765

# Atau jalankan dengan Node.js
npx serve .
```
Buka browser di `http://localhost:8765`.

#### B. Deploy Gratis ke Vercel:
1. Hubungkan akun GitHub Anda ke [Vercel](https://vercel.com).
2. Import repositori ini (`Alat_Absen_FingerPrint`).
3. Set *Root Directory* ke: `Dashboard_Absen`.
4. Klik **Deploy**. Web portal langsung aktif dengan HTTPS gratis!

---

## 📑 Brosur & Panduan Pelanggan
Tersedia brosur cetak 2 halaman A4 siap presentasi untuk kepala sekolah, dinas, maupun yayasan:
- **Dokumen PDF**: [`Brosur_Fitur_Presensi_SMA_Daruttaqwa.pdf`](Brosur_Fitur_Presensi_SMA_Daruttaqwa.pdf)
- **Source HTML**: [`Brosur_Fitur_Presensi_SMA_Daruttaqwa.html`](Brosur_Fitur_Presensi_SMA_Daruttaqwa.html)

---

## 📄 Lisensi & Kontribusi

Proyek ini dikembangkan dengan dedikasi penuh untuk modernisasi sistem presensi pendidikan yang transparan, hemat biaya, dan mudah dioperasikan. Silakan gunakan dan kembangkan lebih lanjut!
