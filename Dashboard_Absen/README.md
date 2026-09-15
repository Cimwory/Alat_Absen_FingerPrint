# Portal Presensi SMA Daruttaqwa (Alat Absen & Google Sheets)

Web Dashboard modern dan responsif untuk monitoring kehadiran guru dan pengurus sekolah berbasis Alat Absen (Fingerprint / RFID) yang tersinkronisasi langsung (*live & real-time*) dengan Google Spreadsheet.

Repository: [https://github.com/Cimwory/Alat_Absen_FingerPrint](https://github.com/Cimwory/Alat_Absen_FingerPrint)

---

## 🌟 Fitur Utama

1. **Sinkronisasi Langsung ke Google Spreadsheet**:
   - Terhubung langsung dengan dokumen spreadsheet *"Rekap Absensi SMA Daruttaqwa"*.
   - Mengambil data 31 guru/pengurus dari sheet `Database Guru` dan seluruh log kehadiran harian (`Log_dd-MM-yyyy`).
   - Fitur **Auto-Sync** berkala setiap 20 detik untuk memastikan data di layar selalu mutakhir tanpa perlu menekan tombol refresh.

2. **Daftar Guru & Pengurus (Kode Unik Asli)**:
   - Menampilkan profil lengkap 31 tenaga pendidik dan kependidikan beserta gelar dan jabatan asli.
   - Menampilkan **Kode Unik Presensi** (`Kode: 1` s.d. `Kode: 31`).
   - Pemisahan otomatis antara unit **Pengajar** (*Guru Mapel*) dan **Pengurus** (*Pengelola, Kepala Sekolah, dan Teknisi*).

3. **Perhitungan Persentase Kehadiran yang Adil**:
   - Persentase kehadiran dihitung secara adil berdasarkan jadwal kerja aktif.
   - Guru yang tidak memiliki jadwal di hari tertentu berstatus **Bebas Tugas** (bukan Alpha).

4. **Jadwal Mengajar & Tugas Mingguan**:
   - Filter cepat berdasarkan hari (`Semua Hari`, `Senin`, `Selasa`, `Rabu`, `Kamis`, `Jumat`).
   - Menampilkan jam mengajar, kelas, dan ruangan yang terstruktur.

5. **Rekapitulasi & Riwayat Presensi Lengkap**:
   - Tabel riwayat absensi dengan pencarian nama guru dan filter tanggal/status.
   - Ekspor data langsung ke format **CSV** (siap dibuka di Microsoft Excel).

6. **Desain Mobile-First & Responsif**:
   - Tampilan bersih (*Glassmorphism Design System*) dengan font *Plus Jakarta Sans*.
   - Dioptimalkan khusus untuk layar *smartphone* (header bertingkat rapi, tanpa bilah scrollbar abu-abu yang mengganggu, tombol ramah sentuhan jari).

---

## 🏗️ Arsitektur Sistem

```
[ Sensor Sidik Jari / RFID ] 
           │
           ▼ (HTTP GET via WiFi)
[ Unit Alat Absen IoT ]
           │
           ▼ (Google Apps Script Web App)
[ Google Spreadsheet ("Rekap Absensi SMA Daruttaqwa") ]
           │
           ▼ (Google Visualization API / Real-Time JSON)
[ Web Dashboard (Vercel / GitHub Pages) ]
```

---

## 📁 Struktur Berkas

```
dashboard_absen/
├── index.html       # Struktur antarmuka Single Page Application (SPA)
├── style.css        # Desain Glassmorphism, CSS Custom Properties & Mobile Breakpoints
├── data.js          # Koneksi live API Google Spreadsheet & formula persentase
├── app.js           # Logika interaktif dashboard, filter hari, pencarian, & auto-sync
├── vercel.json      # Konfigurasi zero-config deployment untuk Vercel
└── README.md        # Dokumentasi proyek
```

---

## 🚀 Cara Menjalankan Secara Lokal

1. Buka folder `Dashboard_Absen` di komputer Anda.
2. Jalankan server lokal sederhana:
   ```bash
   # Menggunakan Python
   python -m http.server 8765

   # Atau menggunakan Node.js (npx serve)
   npx serve .
   ```
3. Buka browser di `http://localhost:8765`.

---

## ☁️ Panduan Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) dan masuk menggunakan akun GitHub Anda.
2. Klik **"Add New Project"**.
3. Import repositori: `Cimwory/Alat_Absen_FingerPrint`.
4. Pilih folder root: `Dashboard_Absen`.
5. Klik **"Deploy"**. Website Anda akan aktif secara publik dengan domain gratis HTTPS (contoh: `https://dashboardabsensmadta.vercel.app`).

---

Dibuat dengan ❤️ untuk kemudahan monitoring kehadiran SMA Daruttaqwa.
