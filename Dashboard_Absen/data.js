/**
 * DATA MODEL & LIVE SINKRONISASI GOOGLE SPREADSHEET
 * Menghubungkan langsung ke spreadsheet "Rekap Absensi SMA Daruttaqwa"
 * Spreadsheet ID: 1yYgUqCSTyE6f4AWcKM_6aR9zFL6TzDpzZh7LLf7wR58
 */

const CONFIG = {
  USE_LIVE_SHEETS: true,
  SPREADSHEET_ID: "1yYgUqCSTyE6f4AWcKM_6aR9zFL6TzDpzZh7LLf7wR58",
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyffhQr8cHdbZg-P9ToWxnNja3ltyDh1W5ZOdbUSQ1NKwNBIbcD1XUN3l6Dg6j1VR5XIQ/exec",
  JAM_MASUK_STANDAR: "07:00:00",
  JAM_PULANG_STANDAR: "15:30:00"
};

// Daftar Tab Sheet Log Riwayat Absensi yang ada di Spreadsheet (Diperbarui s/d 19 September 2026)
const KNOWN_LOG_SHEETS = [
  'Log_19-09-2026', 'Log_18-09-2026', 'Log_17-09-2026', 'Log_16-09-2026',
  'Log_09-09-2026', 'Log_08-09-2026', 'Log_07-09-2026', 'Log_05-09-2026',
  'Log_04-09-2026', 'Log_03-09-2026', 'Log_27-08-2026', 'Log_24-08-2026',
  'Log_22-08-2026', 'Log_21-08-2026', 'Log_20-08-2026', 'Log_19-08-2026',
  'Log_18-08-2026', 'Log_17-08-2026', 'Log_15-08-2026', 'Log_14-08-2026',
  'Log_13-08-2026', 'Log_10-08-2026', 'Log_08-08-2026', 'Log_07-08-2026',
  'Log_06-08-2026', 'Log_05-08-2026', 'Log_04-08-2026', 'Log_03-08-2026',
  'Log_01-08-2026', 'Log_31-07-2026', 'Log_30-07-2026', 'Log_29-07-2026',
  'Log_28-07-2026', 'Log_27-07-2026', 'Log_25-07-2026', 'Log_24-07-2026',
  'Log_23-07-2026', 'Log_20-07-2026'
];

/**
 * Mendapatkan daftar tab log absensi secara dinamis dan real-time.
 * Menggabungkan tab riwayat yang diketahui + otomatis meng-generate nama tab hari ini,
 * hari esok, dan 4 hari ke belakang agar absensi hari baru selalu langsung terdeteksi
 * tanpa membombardir Google API secara berlebihan.
 */
function getActiveLogSheetsList() {
  // Hanya query sheet yang relevan (4 sheet log September terbaru yang pasti ada + hari ini & 3 hari terakhir)
  // Tidak memanggil tab tanggal lama yang sudah tersimpan di cache lokal
  const recentKnown = [
    'Log_19-09-2026', 'Log_18-09-2026', 'Log_17-09-2026', 'Log_16-09-2026'
  ];
  const sheetSet = new Set(recentKnown);
  const now = new Date();
  for (let offset = -1; offset <= 3; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    sheetSet.add(`Log_${dd}-${mm}-${yyyy}`);
  }
  return Array.from(sheetSet);
}

// Master Guru & Log Riwayat Aktif
let masterGuru = [];
let attendanceLogs = [];
let isLiveLoading = false;

// Inisialisasi dari cache lokal untuk responsivitas seketika
try {
  const cachedGuru = localStorage.getItem('cache_master_guru');
  if (cachedGuru) masterGuru = JSON.parse(cachedGuru);
  const cachedLogs = localStorage.getItem('cache_attendance_logs');
  if (cachedLogs) attendanceLogs = JSON.parse(cachedLogs);
} catch (e) {}

// Helper Nama Hari
const HARI_MAP = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
function getIndonesianDayName(date = new Date()) {
  return HARI_MAP[date.getDay()];
}

// Parse timestamp untuk pengurutan tanggal yang presisi (dd-MM-yyyy)
function parseDateTs(dStr) {
  if (!dStr) return 0;
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }
  return 0;
}

// Parse GViz JSON Response (Aman dari respons error non-JSON)
function parseGvizResponse(rawText) {
  try {
    if (!rawText) return null;
    const startIdx = rawText.indexOf('{');
    const endIdx = rawText.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) return null;
    const jsonStr = rawText.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

/**
 * Cek apakah sesi saat ini sedang dalam Mode Tamu / Portofolio
 */
function isCurrentGuestUser() {
  try {
    const raw = localStorage.getItem('auth_active_user');
    const u = raw ? JSON.parse(raw) : null;
    return Boolean(u && u.isGuest);
  } catch (e) {
    return false;
  }
}

/**
 * Panggilan API ke Google Apps Script via JSONP (Bebas CORS di semua browser & mobile)
 */
function callGasApi(params) {
  // PENGAMAN DATABASE ADMIN: Jika pengguna adalah Tamu Portofolio, cegah perubahan ke Google Apps Script!
  if (isCurrentGuestUser() && params.action !== 'checkEnrollStatus') {
    console.warn(`[Mode Portofolio Sandbox] Memblokir aksi mutasi '${params.action}' agar tidak merusak database admin.`);
    return Promise.resolve({
      success: true,
      simulated: true,
      message: "[Mode Portofolio] Aksi disimulasikan di browser Anda. Database Google Sheets asli admin aman terlindungi!"
    });
  }

  return new Promise((resolve, reject) => {
    const callbackName = 'gasCb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const script = document.createElement('script');

    const query = new URLSearchParams(params);
    query.set('callback', callbackName);
    script.src = `${CONFIG.GOOGLE_SCRIPT_URL}?${query.toString()}`;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Waktu koneksi ke Google Cloud habis (Timeout)"));
    }, 25000);

    function cleanup() {
      clearTimeout(timeout);
      if (window[callbackName]) delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };

    script.onerror = function() {
      cleanup();
      reject(new Error("Gagal menghubungi server Google Apps Script"));
    };

    document.head.appendChild(script);
  });
}

// API Tambah Guru Baru
async function apiAddTeacher(data) {
  return await callGasApi({
    action: 'addTeacher',
    id: data.id,
    name: data.name,
    role: data.role,
    type: data.type || 'FINGER'
  });
}

// API Update Data Guru
async function apiUpdateTeacher(data) {
  return await callGasApi({
    action: 'updateTeacher',
    id: data.id,
    name: data.name,
    role: data.role,
    type: data.type || ''
  });
}

// API Hapus Guru
async function apiDeleteTeacher(id) {
  return await callGasApi({
    action: 'deleteTeacher',
    id: id
  });
}

// API Antrean Cloud: Trigger Pendaftaran Sidik Jari / RFID di Alat Absen
async function apiQueueEnroll({ device, command, name, role, type }) {
  return await callGasApi({
    action: 'queueEnroll',
    device: device || 'A',
    command: command || 'ENROLL_FINGER',
    name: name,
    role: role || 'Guru Mapel',
    type: type || 'FINGER'
  });
}

// API Antrean Cloud: Cek Status Pendaftaran Real-Time
async function apiCheckEnrollStatus(commandId) {
  return await callGasApi({
    action: 'checkEnrollStatus',
    commandId: commandId
  });
}

/**
 * Tarik Data Langsung dari Google Spreadsheet
 */
async function loadLiveGoogleSheetData() {
  if (isLiveLoading) return;
  isLiveLoading = true;

  try {
    // 1. Tarik Data Master Guru dari sheet "Database Guru" (dengan anti-cache & timeout aman)
    const dbController = new AbortController();
    const dbTimeout = setTimeout(() => dbController.abort(), 4000);
    const dbUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Database%20Guru&tq=select%20*&_=${Date.now()}`;
    const dbRes = await fetch(dbUrl, { signal: dbController.signal });
    clearTimeout(dbTimeout);
    const dbText = await dbRes.text();
    const dbJson = parseGvizResponse(dbText);

    if (dbJson && dbJson.table && dbJson.table.rows) {
      const parsedTeachers = [];

      dbJson.table.rows.forEach(r => {
        if (!r || !r.c) return;
        const idVal = r.c[0] ? (r.c[0].f || String(r.c[0].v)) : "";
        const typeVal = r.c[1] ? (r.c[1].v || "FINGER") : "FINGER";
        const nameVal = r.c[2] ? (r.c[2].v || "") : "";
        const roleVal = r.c[3] ? (r.c[3].v || "Guru Mapel") : "Guru Mapel";

        if (!nameVal || !idVal) return;

        // Tentukan Unit (Pengajar / Pengurus)
        const isPengurus = roleVal.includes("Pengelola") || 
                           roleVal.includes("Kepala Sekolah") || 
                           roleVal.includes("TEKNISI") || 
                           roleVal.includes("Tata Usaha");

        const category = isPengurus ? "PENGURUS" : "PENGAJAR";

        // Avatar Generator Berdasarkan Nama
        const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameVal)}&background=${isPengurus ? '4f46e5' : '059669'}&color=fff&size=150&bold=true`;

        // Jadwal Hari Wajib Standar
        const scheduleDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

        // Ekstrak angka untuk NIP format yang aman (mendukung prefix A_1, B_2, dll)
        const nipNum = parseInt(String(idVal).replace(/\D/g, '')) || 1;

        parsedTeachers.push({
          id: idVal,
          nip: `1980${String(nipNum).padStart(4, '0')} 200${nipNum % 10} 1 001`,
          name: nameVal,
          role: roleVal,
          subject: roleVal,
          category: category,
          sensorType: typeVal,
          photo: photoUrl,
          scheduleDays: scheduleDays,
          scheduleDetails: [
            { day: "Senin", time: "07:00 - 12:30", subject: roleVal, class: "SMA Daruttaqwa", room: "Ruang Kelas" },
            { day: "Rabu", time: "07:00 - 12:30", subject: roleVal, class: "SMA Daruttaqwa", room: "Ruang Kelas" },
            { day: "Jumat", time: "07:00 - 11:30", subject: roleVal, class: "SMA Daruttaqwa", room: "Ruang Kelas" }
          ]
        });
      });

      if (parsedTeachers.length > 0) {
        if (isCurrentGuestUser() && masterGuru && masterGuru.length > 0) {
          // Dalam mode tamu, pertahankan data lokal yang telah ditambah/diubah oleh pengunjung
          console.log("[Mode Portofolio] Data guru Google Sheets diperbarui di latar belakang tanpa menimpa sesi demo.");
        } else {
          masterGuru = parsedTeachers;
          try { localStorage.setItem('cache_master_guru', JSON.stringify(masterGuru)); } catch (e) {}
        }
      }
    }

    // 2. Tarik Data Log Absensi dari Sheet Log Riwayat (Dinamis & Terjadwal)
    const logsToFetch = getActiveLogSheetsList();
    const allFetchedLogs = [];

    // Gunakan batching ramah (4 request sekaligus) agar tidak terkena rate limiting Google GViz
    const BATCH_SIZE = 4;
    for (let bIdx = 0; bIdx < logsToFetch.length; bIdx += BATCH_SIZE) {
      const currentBatch = logsToFetch.slice(bIdx, bIdx + BATCH_SIZE);
      await Promise.all(currentBatch.map(async (sheetName) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const logUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=select%20*&_=${Date.now()}`;
          const logRes = await fetch(logUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          const logText = await logRes.text();
          const logJson = parseGvizResponse(logText);

          if (!logJson || !logJson.table || !logJson.table.rows) return;

          // PENTING: Validasi bahwa sheet ini adalah sheet Log Presensi asli, bukan fallback ke "Database Guru"
          // Jika nama tab tidak ada di spreadsheet, Google Sheets GViz otomatis mengembalikan sheet pertama ("Database Guru").
          const colLabels = logJson.table.cols.map(c => (c?.label || '').toLowerCase().trim());
          const isDatabaseGuruFallback = colLabels.some(l => l.includes('(kartu/jari)')) || 
                                         (colLabels.includes('nama guru') && !colLabels.some(l => l.includes('tanggal') || l.includes('masuk') || l.includes('waktu')));
          if (isDatabaseGuruFallback) {
            // Tab log ini tidak ada di spreadsheet, jangan diproses agar tidak merusak data
            return;
          }

          // Ambil nama sheet untuk tanggal cadangan (misal: Log_09-09-2026 -> 09-09-2026)
          const tglFallback = sheetName.replace("Log_", "");

          // Deteksi indeks kolom berdasarkan label header sheet secara dinamis
          let hasWaktuMasukCol = false;
          let colTanggal = -1, colId = -1, colNama = -1, colJabatan = -1, colTipe = -1;
          let colMasuk = -1, colKeluar = -1, colWaktu = -1, colTipeAbsen = -1, colStatus = -1;

          logJson.table.cols.forEach((col, idx) => {
            if (!col || !col.label) return;
            const lbl = col.label.toLowerCase().trim();
            if (lbl.includes('tanggal')) colTanggal = idx;
            else if (lbl === 'id' || lbl === '# id' || lbl.includes('(kartu/jari)')) colId = idx;
            else if (lbl.includes('nama')) colNama = idx;
            else if (lbl.includes('jabatan')) colJabatan = idx;
            else if (lbl.includes('masuk')) { colMasuk = idx; hasWaktuMasukCol = true; }
            else if (lbl.includes('keluar')) colKeluar = idx;
            else if (lbl.includes('status')) colStatus = idx;
            else if (lbl.includes('tipe absen')) colTipeAbsen = idx;
            else if (lbl.includes('tipe') || lbl.includes('metode')) colTipe = idx;
            else if (lbl.includes('waktu') && colMasuk === -1) colWaktu = idx;
          });

          const hasLogCols = colTanggal >= 0 || colMasuk >= 0 || colWaktu >= 0 || colTipeAbsen >= 0;
          if (!hasLogCols) return;

          const isOlderFormat = !hasWaktuMasukCol;

          if (isOlderFormat) {
            // FORMAT LAMA (Juli - sebagian Agustus): Baris MASUK dan PULANG tercatat terpisah
            // Konsolidasikan data masuk & pulang per guru untuk tanggal yang sama
            const dayTeacherMap = new Map();

            logJson.table.rows.forEach(r => {
              if (!r || !r.c) return;
              const getVal = (idx) => {
                if (idx < 0 || !r.c[idx]) return "";
                return r.c[idx].f || (r.c[idx].v !== null && r.c[idx].v !== undefined ? String(r.c[idx].v) : "");
              };

              let tglRaw = getVal(colTanggal >= 0 ? colTanggal : 0);
              let tgl = (tglRaw && (tglRaw.includes('-') || tglRaw.includes('/')) && tglRaw.length >= 8) ? tglRaw : tglFallback;
              let waktu = formatGvizDateString(getVal(colWaktu >= 0 ? colWaktu : 1));
              let tipeAbsen = (getVal(colTipeAbsen >= 0 ? colTipeAbsen : 2) || "").toUpperCase().trim();
              let nama = getVal(colNama >= 0 ? colNama : 3).trim();
              let jabatan = getVal(colJabatan >= 0 ? colJabatan : 4).trim();
              let sensor = getVal(colTipe >= 0 ? colTipe : 7) || "FINGER";
              let idVal = getVal(colId >= 0 ? colId : 8);

              // Lewati baris header atau kosong
              if (!nama || nama.toLowerCase().includes("nama") || nama === "MASUK" || nama === "PULANG") return;
              if (waktu === "FINGER" || waktu === "RFID") return;
              if (!tipeAbsen) {
                tipeAbsen = waktu ? "MASUK" : "";
              }

              // Cocokkan dengan Master Guru jika ID belum ada
              if (!idVal && nama) {
                const foundG = masterGuru.find(g => g.name.toLowerCase() === nama.toLowerCase());
                if (foundG) idVal = foundG.id;
              }

              const teacherKey = (idVal ? `ID_${idVal}` : `NAME_${nama.toLowerCase()}`);

              if (!dayTeacherMap.has(teacherKey)) {
                dayTeacherMap.set(teacherKey, {
                  tanggal: tgl,
                  id: idVal,
                  nama: nama,
                  jabatan: jabatan,
                  tipe: sensor,
                  waktuMasuk: "-",
                  waktuKeluar: "-"
                });
              }

              const item = dayTeacherMap.get(teacherKey);
              if (idVal && !item.id) item.id = idVal;
              if (jabatan && !item.jabatan) item.jabatan = jabatan;
              if (sensor && item.tipe === "FINGER") item.tipe = sensor;

              // Catat Waktu Masuk dan Waktu Keluar (Pulang)
              if (tipeAbsen.includes("MASUK")) {
                if (item.waktuMasuk === "-" || waktu < item.waktuMasuk) {
                  item.waktuMasuk = waktu;
                }
              } else if (tipeAbsen.includes("PULANG") || tipeAbsen.includes("KELUAR")) {
                if (item.waktuKeluar === "-" || waktu > item.waktuKeluar) {
                  item.waktuKeluar = waktu;
                }
              } else {
                if (item.waktuMasuk === "-") item.waktuMasuk = waktu;
              }
            });

            // Masukkan hasil konsolidasi format lama ke allFetchedLogs
            for (const item of dayTeacherMap.values()) {
              if (!item.tanggal || (!item.tanggal.includes('-') && !item.tanggal.includes('/')) || item.tanggal.length < 8) continue;
              if (item.waktuMasuk === 'FINGER' || item.waktuMasuk === 'RFID') continue;
              if (item.waktuMasuk === '-' && item.waktuKeluar === '-') continue;

              const guruObj = masterGuru.find(g => String(g.id) === String(item.id) || g.name.toLowerCase() === item.nama.toLowerCase());
              const status = item.waktuKeluar !== "-" ? "TAP OUT" : "TAP IN";

              allFetchedLogs.push({
                id: `LOG_${item.tanggal}_${item.id || Math.random().toString(36).substring(7)}`,
                tanggal: item.tanggal,
                hari: getDayFromDateString(item.tanggal),
                guruId: item.id || (guruObj ? guruObj.id : "-"),
                nama: item.nama,
                jabatan: item.jabatan || (guruObj ? guruObj.role : "Guru Mapel"),
                kategori: guruObj ? guruObj.category : "PENGAJAR",
                tipe: item.tipe || (guruObj ? guruObj.sensorType : "FINGER"),
                waktuMasuk: item.waktuMasuk,
                waktuKeluar: item.waktuKeluar,
                status: status
              });
            }

          } else {
            // FORMAT BARU (Akhir Agustus - September): Kolom Waktu Masuk & Waktu Keluar sudah tersedia
            logJson.table.rows.forEach(r => {
              if (!r || !r.c) return;
              const getVal = (idx) => {
                if (idx < 0 || !r.c[idx]) return "";
                return r.c[idx].f || (r.c[idx].v !== null && r.c[idx].v !== undefined ? String(r.c[idx].v) : "");
              };

              let tglRaw = getVal(colTanggal >= 0 ? colTanggal : 0);
              let tgl = (tglRaw && (tglRaw.includes('-') || tglRaw.includes('/')) && tglRaw.length >= 8) ? tglRaw : tglFallback;
              let idVal = getVal(colId >= 0 ? colId : 1);
              let nama = getVal(colNama >= 0 ? colNama : 2).trim();
              let jabatan = getVal(colJabatan >= 0 ? colJabatan : 3).trim();
              let sensor = getVal(colTipe >= 0 ? colTipe : 4) || "FINGER";
              let masuk = formatGvizDateString(getVal(colMasuk >= 0 ? colMasuk : 5)) || "-";
              let keluar = formatGvizDateString(getVal(colKeluar >= 0 ? colKeluar : 6)) || "-";
              let status = getVal(colStatus >= 0 ? colStatus : 7);

              if (!nama || nama.toLowerCase().includes("nama")) return;
              if (!tgl || (!tgl.includes('-') && !tgl.includes('/')) || tgl.length < 8) return;
              if (masuk === 'FINGER' || masuk === 'RFID') return;
              if (masuk === '-' && keluar === '-') return;

              // Jika ID kosong tapi nama ada, cocokkan dengan Database Guru
              if (!idVal && nama) {
                const foundG = masterGuru.find(g => g.name.toLowerCase() === nama.toLowerCase());
                if (foundG) idVal = foundG.id;
              }

              // Jika nama kosong tapi ID ada, cocokkan dengan Database Guru
              if (!nama && idVal) {
                const foundG = masterGuru.find(g => String(g.id) === String(idVal));
                if (foundG) {
                  nama = foundG.name;
                  jabatan = jabatan || foundG.role;
                }
              }

              if (!status) {
                status = (keluar && keluar !== "-") ? "TAP OUT" : "TAP IN";
              }

              const guruObj = masterGuru.find(g => String(g.id) === String(idVal) || g.name.toLowerCase() === nama.toLowerCase());

              allFetchedLogs.push({
                id: `LOG_${tgl}_${idVal || Math.random().toString(36).substring(7)}`,
                tanggal: tgl,
                hari: getDayFromDateString(tgl),
                guruId: idVal || (guruObj ? guruObj.id : "-"),
                nama: nama,
                jabatan: jabatan || (guruObj ? guruObj.role : "Guru Mapel"),
                kategori: guruObj ? guruObj.category : "PENGAJAR",
                tipe: sensor || (guruObj ? guruObj.sensorType : "FINGER"),
                waktuMasuk: masuk,
                waktuKeluar: keluar,
                status: status
              });
            });
          }
        } catch (err) {
          // Tab sheet belum ada atau di-redirect Google, abaikan secara tenang
        }
      }));

      // Jeda mikro antar-batch untuk stabilitas Google API
      if (bIdx + BATCH_SIZE < logsToFetch.length) {
        await new Promise(r => setTimeout(r, 60));
      }
    }

    if (allFetchedLogs.length > 0) {
      // Gabungkan log baru yang ditarik dengan log riwayat yang ada di cache (hindari duplikasi berdasarkan id log)
      const existingMap = new Map();
      attendanceLogs.forEach(l => existingMap.set(l.id, l));
      allFetchedLogs.forEach(l => existingMap.set(l.id, l));

      attendanceLogs = Array.from(existingMap.values()).sort((a, b) => parseDateTs(b.tanggal) - parseDateTs(a.tanggal));
      try { localStorage.setItem('cache_attendance_logs', JSON.stringify(attendanceLogs)); } catch (e) {}
    }

    console.log(`Berhasil memuat ${masterGuru.length} guru dan ${attendanceLogs.length} baris log presensi bersih dari Google Spreadsheet.`);
    return true;
  } catch (error) {
    console.error("Gagal sinkronisasi dengan Google Spreadsheet:", error);
    return false;
  } finally {
    isLiveLoading = false;
  }
}

// Format Date(1899,11,30,6,17,6) ke HH:mm:ss
function formatGvizDateString(str) {
  if (!str) return str;
  const match = String(str).match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
  if (match && match[4] !== undefined) {
    const h = String(match[4]).padStart(2, '0');
    const m = String(match[5] || '0').padStart(2, '0');
    const s = String(match[6] || '0').padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  return String(str);
}

// Ekstrak hari dari format dd-MM-yyyy
function getDayFromDateString(dStr) {
  if (!dStr) return "-";
  const parts = dStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!isNaN(d.getTime())) {
      return HARI_MAP[d.getDay()];
    }
  }
  return "-";
}

// ==========================================
// PERHITUNGAN STATISTIK GURU
// ==========================================
function getTeacherStats(guruId) {
  const guru = masterGuru.find(g => String(g.id) === String(guruId));
  if (!guru) return null;

  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const todayStr = `${day}-${month}-${year}`;

  const teacherLogs = attendanceLogs.filter(log => String(log.guruId) === String(guruId) || log.nama === guru.name);
  const totalHadir = teacherLogs.length;
  const totalCheckOut = teacherLogs.filter(l => l.waktuKeluar && l.waktuKeluar !== '-').length;
  const totalCheckInOnly = teacherLogs.filter(l => !l.waktuKeluar || l.waktuKeluar === '-').length;

  // Target hari kerja aktif yang terdata di sheet
  const uniqueLoggedDates = Array.from(new Set(attendanceLogs.map(l => l.tanggal)));
  const targetHariJadwal = Math.max(1, uniqueLoggedDates.slice(0, 10).length);
  const persentaseKehadiran = Math.min(100, Math.round((totalHadir / targetHariJadwal) * 100));

  const todayLog = teacherLogs.find(l => l.tanggal === todayStr);

  return {
    guru,
    totalHadir,
    totalCheckOut,
    totalCheckInOnly,
    targetHariJadwal,
    persentaseKehadiran,
    hasScheduleToday: true,
    todayLog: todayLog || null,
    recentLogs: teacherLogs.slice(0, 10)
  };
}

// ==========================================
// RINGKASAN DASHBOARD KESELURUHAN
// ==========================================
function getDashboardSummary() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const todayStr = `${day}-${month}-${year}`;
  const todayName = getIndonesianDayName(today);

  // Ambil log hari ini, atau log pada tanggal terakhir yang tercatat di sheet
  let todayLogs = attendanceLogs.filter(l => l.tanggal === todayStr);
  let activeLogDate = todayStr;
  
  if (todayLogs.length === 0 && attendanceLogs.length > 0) {
    activeLogDate = attendanceLogs[0].tanggal;
    todayLogs = attendanceLogs.filter(l => l.tanggal === activeLogDate);
  }

  const totalGuru = masterGuru.length;
  const totalPengajar = masterGuru.filter(g => g.category === "PENGAJAR").length;
  const totalPengurus = masterGuru.filter(g => g.category === "PENGURUS").length;

  const hadirHariIni = todayLogs.length;
  const tapInHariIni = todayLogs.filter(l => l.status === "TAP IN").length;
  const tapOutHariIni = todayLogs.filter(l => l.status === "TAP OUT").length;
  const belumHadir = Math.max(0, totalGuru - hadirHariIni);

  const totalPersen = masterGuru.reduce((acc, g) => {
    const st = getTeacherStats(g.id);
    return acc + (st ? st.persentaseKehadiran : 0);
  }, 0);
  const rataRataPersentase = Math.round(totalPersen / (totalGuru || 1));

  return {
    todayStr: activeLogDate,
    todayName,
    totalGuru,
    totalPengajar,
    totalPengurus,
    totalTerjadwal: totalGuru,
    hadirHariIni,
    tapInHariIni,
    tapOutHariIni,
    belumHadir,
    rataRataPersentase,
    persenHadirHariIni: totalGuru > 0 ? Math.round((hadirHariIni / totalGuru) * 100) : 0
  };
}

// Simulasi Coba Tap
function simulateEspTap(guruId) {
  const guru = masterGuru.find(g => String(g.id) === String(guruId));
  if (!guru) return { success: false, message: "ID tidak ditemukan" };

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const todayStr = `${day}-${month}-${year}`;

  const timeStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  let existingIndex = attendanceLogs.findIndex(l => l.tanggal === todayStr && String(l.guruId) === String(guru.id));

  if (existingIndex === -1) {
    const newLog = {
      id: `LOG_${todayStr}_${guru.id}`,
      tanggal: todayStr,
      hari: getIndonesianDayName(now),
      guruId: guru.id,
      nama: guru.name,
      jabatan: guru.role,
      kategori: guru.category,
      tipe: guru.sensorType,
      waktuMasuk: timeStr,
      waktuKeluar: "-",
      status: "TAP IN"
    };
    attendanceLogs.unshift(newLog);
    return {
      success: true,
      action: "TAP IN",
      nama: guru.name,
      message: `Presensi Masuk Berhasil: ${guru.name} (${timeStr})`
    };
  } else {
    const log = attendanceLogs[existingIndex];
    if (log.status === "TAP IN") {
      log.waktuKeluar = timeStr;
      log.status = "TAP OUT";
      return {
        success: true,
        action: "TAP OUT",
        nama: guru.name,
        message: `Presensi Pulang Berhasil: ${guru.name} (${timeStr})`
      };
    } else {
      return {
        success: false,
        action: "ALREADY_OUT",
        nama: guru.name,
        message: `${guru.name} sudah melakukan presensi pulang hari ini.`
      };
    }
  }
}

// ==========================================
// SISTEM AUTENTIKASI PENGGUNA (ROLE & SESI)
// ==========================================

const SEEDED_AUTH_USERS = [
  {
    nik: "322360032",
    password: "password123",
    name: "Kindy",
    role: "ADMIN",
    roleLabel: "Administrator Sistem",
    category: "ADMIN",
    teacherId: "29",
    photo: "https://ui-avatars.com/api/?name=Kindy&background=4f46e5&color=fff&size=150&bold=true"
  },
  {
    nik: "12345",
    password: "password123",
    name: "Miftahul Jannah, S.Pd.I.",
    role: "GURU",
    roleLabel: "Guru Pengajar",
    category: "PENGAJAR",
    teacherId: "4",
    photo: "https://ui-avatars.com/api/?name=Miftahul+Jannah&background=059669&color=fff&size=150&bold=true"
  },
  {
    nik: "54321",
    password: "password123",
    name: "Abdul aziz, M.Pd.",
    role: "KEPALA_SEKOLAH",
    roleLabel: "Kepala Sekolah",
    category: "PENGURUS",
    teacherId: "28",
    photo: "https://ui-avatars.com/api/?name=Abdul+Aziz&background=7c3aed&color=fff&size=150&bold=true"
  }
];

function getRegisteredUsers() {
  try {
    const saved = localStorage.getItem('registered_users_list');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

function saveRegisteredUser(userObj) {
  const users = getRegisteredUsers();
  users.push(userObj);
  localStorage.setItem('registered_users_list', JSON.stringify(users));
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('auth_active_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem('auth_active_user');
  } else {
    localStorage.setItem('auth_active_user', JSON.stringify(user));
  }
}

function logoutCurrentUser() {
  localStorage.removeItem('auth_active_user');
}

function authenticateLocalUser(nik, password) {
  const allUsers = [...SEEDED_AUTH_USERS, ...getRegisteredUsers()];
  const found = allUsers.find(u => String(u.nik).trim() === String(nik).trim());
  if (!found) {
    return { success: false, message: "NIK tidak terdaftar dalam sistem." };
  }
  if (found.password !== password) {
    return { success: false, message: "Kata sandi / password salah!" };
  }
  return { success: true, user: found };
}

