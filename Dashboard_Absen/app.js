/**
 * APP LOGIC: PORTAL PRESENSI GURU & PENGURUS
 * Dirancang siap pakai untuk pengguna akhir tanpa istilah teknis,
 * tetap menampilkan Kode Unik presensi tiap individu secara jelas.
 */

let currentScheduleDay = 'ALL';

// ==========================================
// 0. LUXURY SPLASH SCREEN CONTROLLER
// ==========================================
async function runSplashScreen(dataLoadPromise) {
  const splashEl = document.getElementById('splashScreen');
  const barEl = document.getElementById('splashProgressBar');
  const statusEl = document.getElementById('splashStatusText');
  const percentEl = document.getElementById('splashPercentText');

  if (!splashEl) {
    return await dataLoadPromise;
  }

  let progress = 0;
  let isDataLoaded = false;
  let dataResult = null;

  dataLoadPromise.then(res => {
    isDataLoaded = true;
    dataResult = res;
  }).catch(err => {
    console.warn("Gagal load data during splash:", err);
    isDataLoaded = true;
    dataResult = false;
  });

  return new Promise((resolve) => {
    const startTime = Date.now();
    const minDuration = 1800; // Minimal 1.8 detik tampilan mewah yang elegan

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;

      if (!isDataLoaded) {
        // Fase 1 & 2: Loading sedang berlangsung
        if (progress < 40) {
          progress += Math.random() * 4 + 2;
          if (statusEl) statusEl.textContent = "Menghubungkan ke Cloud Database Google...";
        } else if (progress < 75) {
          progress += Math.random() * 3 + 1.5;
          if (statusEl) statusEl.textContent = "Memuat Data Guru & Sensor Biometrik...";
        } else if (progress < 90) {
          progress += Math.random() * 1.5 + 0.5;
          if (statusEl) statusEl.textContent = "Menyinkronkan Riwayat Check In & Check Out...";
        }
      } else {
        // Data sudah siap dari server, akselerasi ke 100%
        if (statusEl) statusEl.textContent = "Menyinkronkan Riwayat Check In & Check Out...";
        progress += 6.5;
      }

      if (progress >= 100 && (elapsed >= minDuration || isDataLoaded)) {
        progress = 100;
        clearInterval(timer);

        if (barEl) barEl.style.width = '100%';
        if (percentEl) percentEl.textContent = '100%';
        if (statusEl) statusEl.textContent = 'Sistem Siap Digunakan';

        // Tahan sejenak pada 100% lalu transisi fade out mewah
        setTimeout(() => {
          splashEl.classList.add('fade-out');
          setTimeout(() => {
            splashEl.style.display = 'none';
            resolve(dataResult);
          }, 850);
        }, 220);
      } else {
        if (progress > 98 && !isDataLoaded) progress = 98; // Tahan di 98% jika server butuh waktu lebih
        if (barEl) barEl.style.width = `${Math.min(100, Math.round(progress))}%`;
        if (percentEl) percentEl.textContent = `${Math.min(100, Math.round(progress))}%`;
      }
    }, 45);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initClock();
  initSimulatorSelect();
  initMobileDock();

  // Mulai memuat data Google Spreadsheet bersamaan dengan splash screen mewah
  const dataPromise = loadLiveGoogleSheetData();
  const success = await runSplashScreen(dataPromise);

  // Kunci halaman jika belum login
  initAuthLockScreen();
  renderAllViews();

  if (success && masterGuru.length > 0 && getCurrentUser()) {
    showToast(`Tersambung: ${masterGuru.length} Guru & ${attendanceLogs.length} Log Presensi`, "success");
  }

  // Sinkronisasi otomatis di latar belakang setiap 20 detik
  setInterval(async () => {
    await loadLiveGoogleSheetData();
    renderAllViews();
  }, 20000);
});

// ==========================================
// 1. JAM REAL-TIME & HEADER TANGGAL
// ==========================================
function initClock() {
  const clockEl = document.getElementById('liveClock');
  const dateHeaderEl = document.getElementById('currentDateHeader');

  function update() {
    const now = new Date();
    
    // Format Waktu: HH:mm:ss WIB
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}:${seconds} WIB`;

    // Format Tanggal: Hari, DD MMMM YYYY
    const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const indonesianMonths = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dayName = indonesianDays[now.getDay()];
    const dayNum = now.getDate();
    const monthName = indonesianMonths[now.getMonth()];
    const year = now.getFullYear();

    dateHeaderEl.textContent = `${dayName}, ${dayNum} ${monthName} ${year}`;
  }

  update();
  setInterval(update, 1000);
}

// ==========================================
// 2. NAVIGASI TAB
// ==========================================
function switchTab(tabId) {
  const aliasMap = {
    'ringkasan': 'overview',
    'jadwal': 'schedule',
    'guru': 'teachers',
    'log': 'logs',
    'status-esp32': 'status-esp32'
  };
  const resolvedTabId = aliasMap[tabId] || tabId;

  // Proteksi Hak Akses: Informasi Alat Absen Hanya untuk Admin
  if (resolvedTabId === 'status-esp32') {
    const user = getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      showToast('Status Alat Absen hanya dapat diakses oleh Administrator Sistem.', 'warning');
      switchTab('overview');
      return;
    }
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    const itemTab = item.getAttribute('data-tab');
    if (itemTab === resolvedTabId || aliasMap[itemTab] === resolvedTabId) {
      item.classList.add('active');
    }
  });

  // Sinkronisasi status aktif pada Mobile ReactBits Dock
  document.querySelectorAll('.dock-item[data-dock-tab]').forEach(item => {
    item.classList.remove('active');
    const dockTab = item.getAttribute('data-dock-tab');
    if (dockTab === resolvedTabId || aliasMap[dockTab] === resolvedTabId) {
      item.classList.add('active');
    }
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`tab-${resolvedTabId}`);
  if (targetView) targetView.classList.add('active');

  const titleMap = {
    overview: "Dashboard Ringkasan Presensi",
    schedule: "Jadwal Mengajar & Beban Tugas",
    teachers: "Daftar Guru & Staf Pengurus",
    logs: "Rekap & Riwayat Absensi",
    'status-esp32': "Status Alat Absen"
  };
  const breadcrumbMap = {
    overview: "Ringkasan",
    schedule: "Jadwal Mengajar",
    teachers: "Daftar Guru & Staf",
    logs: "Rekap Presensi",
    'status-esp32': "Status Alat Absen"
  };

  const pageTitleEl = document.getElementById('pageTitle');
  if (pageTitleEl) pageTitleEl.textContent = titleMap[resolvedTabId] || "Presensi";

  const breadcrumbEl = document.getElementById('activeBreadcrumb');
  if (breadcrumbEl) breadcrumbEl.textContent = breadcrumbMap[resolvedTabId] || "Ringkasan";

  if (resolvedTabId === 'schedule') {
    renderScheduleTab();
  }
}

// ==========================================
// 3. RENDER ALL VIEWS
// ==========================================
function renderAllViews() {
  updateAuthUI();
  populateDateFilterOptions();
  renderOverview();
  renderScheduleTab();
  renderTeachersGrid();
  renderLogsTable();
}

// ==========================================
// 4. RENDER TAB OVERVIEW
// ==========================================
function renderOverview() {
  const summary = getDashboardSummary();

  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const todayStr = `${day}-${month}-${year}`;
  const todayLogs = attendanceLogs.filter(l => l.tanggal === todayStr);

  // Hitung Check In (Masuk) dan Check Out (Pulang) riil dari data hari ini
  const checkInCount = todayLogs.filter(l => l.waktuMasuk && l.waktuMasuk !== '-').length;
  const checkOutCount = todayLogs.filter(l => l.status === 'TAP OUT' || (l.waktuKeluar && l.waktuKeluar !== '-')).length;

  // Update 4 Kartu KPI Modern (Data Presensi Otentik)
  if (document.getElementById('statHadirHariIni')) {
    document.getElementById('statHadirHariIni').textContent = summary.hadirHariIni;
  }
  if (document.getElementById('statTotalGuruRatio')) {
    document.getElementById('statTotalGuruRatio').textContent = `/ ${summary.totalGuru} Guru`;
  }
  if (document.getElementById('statPersenHadirToday')) {
    document.getElementById('statPersenHadirToday').innerHTML = `<i class="fa-solid fa-arrow-trend-up mr-1 text-emerald-600"></i> ${summary.persenHadirHariIni}% kehadiran`;
  }
  if (document.getElementById('statCheckInCount')) {
    document.getElementById('statCheckInCount').textContent = checkInCount;
  }
  if (document.getElementById('statCheckOutCount')) {
    document.getElementById('statCheckOutCount').textContent = checkOutCount;
  }
  if (document.getElementById('statMesinOnline')) {
    document.getElementById('statMesinOnline').textContent = "2 / 2";
  }

  // Kompatibilitas elemen lama jika ada di DOM
  if (document.getElementById('statTotalGuru')) document.getElementById('statTotalGuru').textContent = summary.totalGuru;
  if (document.getElementById('statSubTotalGuru')) document.getElementById('statSubTotalGuru').textContent = `${summary.totalPengajar} Pengajar • ${summary.totalPengurus} Pengurus`;
  if (document.getElementById('statTerjadwalHariIni')) document.getElementById('statTerjadwalHariIni').textContent = summary.totalTerjadwal;
  if (document.getElementById('statHariName')) document.getElementById('statHariName').innerHTML = `<i class="fa-solid fa-clock"></i> Hari: <strong>${summary.todayName}</strong>`;
  if (document.getElementById('statDiSekolah')) document.getElementById('statDiSekolah').textContent = summary.tapInHariIni;
  if (document.getElementById('statBelumHadir')) document.getElementById('statBelumHadir').textContent = summary.belumHadir;
  if (document.getElementById('statRataRataKehadiran')) document.getElementById('statRataRataKehadiran').textContent = `${summary.rataRataPersentase}%`;

  // Render Tabel Kehadiran Hari Ini
  const todayTbody = document.getElementById('todayAttendanceTbody');
  if (todayTbody) {
    todayTbody.innerHTML = '';

    if (todayLogs.length === 0) {
      todayTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">Belum ada presensi tercatat hari ini.</td></tr>`;
    } else {
      todayLogs.forEach(log => {
        const guru = masterGuru.find(g => g.id === log.guruId) || {};
        const statusBadge = log.status === 'TAP OUT' 
          ? `<span class="badge badge-out"><i class="fa-solid fa-check-double"></i> Pulang</span>`
          : `<span class="badge badge-in"><i class="fa-solid fa-arrow-right-to-bracket"></i> Di Sekolah</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${guru.photo || 'https://via.placeholder.com/40'}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid #bec9c2;">
              <div>
                <strong style="color: #141b2b; font-size: 13px;">${log.nama}</strong>
                <div style="font-size: 11px; color: var(--text-secondary);">${log.jabatan}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge" style="background: rgba(0, 108, 73, 0.1); color: #006c49; border: 1px solid rgba(0, 108, 73, 0.25); font-weight: 700;">
              <i class="fa-solid fa-fingerprint"></i> ${log.guruId}
            </span>
          </td>
          <td><strong style="color: #141b2b;">${log.waktuMasuk}</strong></td>
          <td>${log.waktuKeluar === '-' ? '<span style="color: var(--text-muted);">-</span>' : `<strong style="color: #141b2b;">${log.waktuKeluar}</strong>`}</td>
          <td>${statusBadge}</td>
        `;
        todayTbody.appendChild(tr);
      });
    }
  }

  // Render Live Activity Feed (Hanya Guru yang Hadir Hari Ini & Menampilkan Jam Tap In + Tap Out)
  const feedContainer = document.getElementById('activityFeedList');
  if (feedContainer) {
    feedContainer.innerHTML = '';

    if (todayLogs.length === 0) {
      feedContainer.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; color: var(--text-muted); background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <span class="material-symbols-outlined" style="font-size: 32px; color: #94a3b8; display: block; margin-bottom: 6px;">event_busy</span>
          <strong style="display: block; color: var(--text-main); font-size: 13px;">Belum Ada Presensi Hari Ini</strong>
          <span style="font-size: 11.5px; color: var(--text-muted);">Belum ada guru yang melakukan absensi pada hari ini (${summary.todayName}, ${summary.todayStr}).</span>
        </div>
      `;
    } else {
      todayLogs.forEach(log => {
        const guru = masterGuru.find(g => String(g.id) === String(log.guruId) || g.name.toLowerCase() === log.nama.toLowerCase()) || {};
        const item = document.createElement('div');
        item.className = 'feed-item';

        const isOut = log.status === 'TAP OUT' || (log.waktuKeluar && log.waktuKeluar !== '-');
        const inTime = log.waktuMasuk && log.waktuMasuk !== '-' ? log.waktuMasuk : '-';
        const outTime = log.waktuKeluar && log.waktuKeluar !== '-' ? log.waktuKeluar : '-';

        item.innerHTML = `
          <img src="${guru.photo || 'https://via.placeholder.com/40'}" class="feed-avatar" alt="${log.nama}">
          <div class="feed-details">
            <div class="feed-name">${log.nama}</div>
            <div class="feed-sub">
              <span style="color: #006c49; font-weight: 700;">Kode: ${log.guruId}</span>
              <span>&bull;</span>
              <span style="color: var(--text-muted);">${log.jabatan || guru.role || 'Guru Mapel'}</span>
              <span>&bull;</span>
              <span>${log.tipe === 'RFID' ? 'Kartu RFID' : 'Sidik Jari'}</span>
            </div>
          </div>
          <div class="feed-badge-group" style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
              <span class="badge badge-in" style="font-size: 11px; padding: 3px 9px; font-weight: 700; white-space: nowrap;">
                <i class="fa-solid fa-arrow-right-to-bracket mr-1"></i> Masuk: ${inTime}
              </span>
              ${isOut && outTime !== '-' 
                ? `<span class="badge badge-out" style="font-size: 11px; padding: 3px 9px; font-weight: 700; white-space: nowrap;">
                     <i class="fa-solid fa-check-double mr-1"></i> Pulang: ${outTime}
                   </span>`
                : `<span class="badge" style="background: rgba(0, 108, 73, 0.08); color: #006c49; border: 1px solid rgba(0, 108, 73, 0.25); font-size: 11px; padding: 3px 9px; font-weight: 600; white-space: nowrap;">
                     <i class="fa-solid fa-building-user mr-1"></i> Di Sekolah
                   </span>`
              }
            </div>
          </div>
        `;
        feedContainer.appendChild(item);
      });
    }
  }
}

// ==========================================
// 5. RENDER TAB JADWAL MENGAJAR & TUGAS
// ==========================================
function renderScheduleTab() {
  const container = document.getElementById('scheduleGridContainer');
  if (!container) return;
  container.innerHTML = '';

  const search = (document.getElementById('scheduleSearchInput')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('scheduleCategoryFilter')?.value || 'ALL';

  let allScheduleItems = [];
  masterGuru.forEach(guru => {
    if (categoryFilter !== 'ALL' && guru.category !== categoryFilter) return;

    guru.scheduleDetails.forEach(item => {
      const matchSearch = guru.name.toLowerCase().includes(search) ||
                          item.subject.toLowerCase().includes(search) ||
                          item.class.toLowerCase().includes(search) ||
                          item.room.toLowerCase().includes(search);

      const matchDay = (currentScheduleDay === 'ALL') || (item.day === currentScheduleDay);

      if (matchSearch && matchDay) {
        allScheduleItems.push({
          ...item,
          teacherName: guru.name,
          teacherRole: guru.role,
          teacherPhoto: guru.photo,
          teacherId: guru.id,
          category: guru.category
        });
      }
    });
  });

  const dayOrder = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6 };
  allScheduleItems.sort((a, b) => (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99));

  if (allScheduleItems.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 36px; color: var(--text-muted); margin-bottom: 12px;"></i>
        <p style="color: var(--text-secondary);">Tidak ada jadwal yang cocok dengan filter atau pencarian.</p>
      </div>
    `;
    return;
  }

  const currentUser = getCurrentUser();

  allScheduleItems.forEach(item => {
    const card = document.createElement('div');
    const isPengurus = item.category === 'PENGURUS';
    const isMySchedule = currentUser && (
      String(item.teacherId) === String(currentUser.teacherId) ||
      (item.teacherName && currentUser.name && item.teacherName.toLowerCase().includes(currentUser.name.toLowerCase()))
    );

    card.className = `schedule-item-card ${isPengurus ? 'pengurus-item' : ''}`;
    if (isMySchedule) {
      card.style.borderColor = 'var(--accent-emerald)';
      card.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.25)';
    }

    card.innerHTML = `
      <div class="sched-header">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="sched-day-tag">${item.day}</span>
          ${isMySchedule ? `<span class="badge badge-on-time" style="font-size: 9.5px; padding: 2px 6px;"><i class="fa-solid fa-user-check"></i> Jadwal Saya</span>` : ''}
        </div>
        <span class="sched-time"><i class="fa-regular fa-clock"></i> ${item.time}</span>
      </div>

      <div class="sched-subject">${item.subject}</div>
      
      <div class="sched-teacher">
        <img src="${item.teacherPhoto}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
        <span><strong>${item.teacherName}</strong></span>
      </div>

      <div class="sched-meta-pills">
        <span class="class-pill"><i class="fa-solid fa-graduation-cap"></i> ${item.class}</span>
        <span class="room-pill"><i class="fa-solid fa-location-dot"></i> ${item.room}</span>
        <span class="badge" style="background: rgba(99, 102, 241, 0.12); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.25);">
          Kode: ${item.teacherId}
        </span>
      </div>
    `;
    container.appendChild(card);
  });
}

function selectScheduleDay(day) {
  currentScheduleDay = day;
  document.querySelectorAll('.day-pill-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-day') === day) {
      btn.classList.add('active');
    }
  });
  renderScheduleTab();
}

function filterSchedule() {
  renderScheduleTab();
}

// ==========================================
// 6. RENDER TAB DAFTAR GURU & PERSENTASE
// ==========================================
function renderTeachersGrid(filteredList = null) {
  const container = document.getElementById('teachersGridContainer');
  if (!container) return;
  container.innerHTML = '';

  const list = filteredList || masterGuru;
  const currentUser = getCurrentUser();
  const canManageTeachers = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'KEPALA_SEKOLAH');

  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
        <span class="material-symbols-outlined text-[36px] text-slate-400 mb-2">person_off</span>
        <p style="color: #64748b; font-size: 13px; margin: 0;">Tidak ada guru atau staf yang sesuai kriteria pencarian.</p>
      </div>
    `;
    return;
  }

  list.forEach(guru => {
    const stats = getTeacherStats(guru.id);
    const pct = stats.persentaseKehadiran;

    let pctClass = 'pct-high';
    let fillClass = 'fill-high';
    if (pct < 75) {
      pctClass = 'pct-low';
      fillClass = 'fill-low';
    } else if (pct < 90) {
      pctClass = 'pct-mid';
      fillClass = 'fill-mid';
    }

    const unitBadge = guru.category === 'PENGAJAR'
      ? `<span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-[#006c49] border border-emerald-200">Pengajar</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Pengurus</span>`;

    // Status Hari Ini Tag yang rapi
    let todayStatusBadge = '';
    if (!stats.hasScheduleToday) {
      todayStatusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600"><span class="material-symbols-outlined text-[14px]">hotel</span> Bebas Tugas Hari Ini</span>`;
    } else if (stats.todayLog) {
      todayStatusBadge = stats.todayLog.status === 'TAP OUT'
        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-[#004532]"><span class="material-symbols-outlined text-[14px]">check_circle</span> Hadir & Pulang (${stats.todayLog.waktuMasuk} - ${stats.todayLog.waktuKeluar})</span>`
        : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800"><span class="material-symbols-outlined text-[14px]">login</span> Di Sekolah (${stats.todayLog.waktuMasuk})</span>`;
    } else {
      todayStatusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"><span class="material-symbols-outlined text-[14px]">schedule</span> Belum Presensi</span>`;
    }

    // Role / Subject label (hindari duplikasi teks "Guru Mapel Guru Mapel")
    let displaySubtitle = guru.role || 'Guru Pengajar';
    if (guru.subject && guru.subject.toLowerCase() !== (guru.role || '').toLowerCase() && !guru.role.toLowerCase().includes(guru.subject.toLowerCase())) {
      displaySubtitle = `${guru.subject} • ${guru.role}`;
    }

    const card = document.createElement('div');
    card.className = 'teacher-card';
    card.innerHTML = `
      <!-- Card Header: Photo + Name + Unit Badge -->
      <div class="card-top">
        <img src="${guru.photo}" class="teacher-photo" alt="${guru.name}">
        <div class="teacher-meta">
          <h4 class="teacher-name" title="${guru.name}">${guru.name}</h4>
          <div class="teacher-role-badge">
            <span class="material-symbols-outlined text-[14px]">school</span>
            <span>${displaySubtitle}</span>
          </div>
        </div>
        <div>
          ${unitBadge}
        </div>
      </div>

      <!-- Card Chips: ID Unik & Sensor -->
      <div class="teacher-chips-row">
        <span class="card-chip-id">
          <i class="fa-solid fa-key"></i> ID: ${guru.id}
        </span>
        <span class="card-chip-sensor">
          <i class="fa-solid ${guru.sensorType === 'RFID' ? 'fa-id-card' : 'fa-fingerprint'}"></i>
          ${guru.sensorType === 'RFID' ? 'Kartu RFID' : 'Sidik Jari'}
        </span>
      </div>

      <!-- Status Hari Ini -->
      <div style="margin-bottom: 12px;">
        ${todayStatusBadge}
      </div>

      <!-- Attendance Percentage Mini Progress -->
      <div class="attendance-progress-box">
        <div class="progress-header">
          <span class="progress-label">Kehadiran (${stats.totalHadir}/${stats.targetHariJadwal} hari)</span>
          <span class="progress-value ${pctClass}">${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill ${fillClass}" style="width: ${pct}%"></div>
        </div>
      </div>

      <!-- Card Footer Actions: Jadwal + Edit/Hapus -->
      <div class="card-actions-clean">
        <button class="btn-teacher-detail" onclick="openTeacherDetail('${guru.id}')">
          <span class="material-symbols-outlined text-[16px]">calendar_month</span>
          <span>Lihat Jadwal</span>
        </button>

        ${canManageTeachers ? `
          <button class="btn-teacher-icon edit" onclick="openEditTeacherModal('${guru.id}')" title="Edit Data Guru">
            <span class="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button class="btn-teacher-icon delete" onclick="confirmDeleteTeacher('${guru.id}')" title="Hapus Guru">
            <span class="material-symbols-outlined text-[16px]">delete</span>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function filterTeachers() {
  const query = document.getElementById('teacherSearchInput').value.toLowerCase().trim();
  const category = document.getElementById('teacherCategoryFilter').value;
  const sensor = document.getElementById('sensorFilter').value;
  const pctFilter = document.getElementById('pctFilter').value;

  const filtered = masterGuru.filter(guru => {
    const matchQuery = guru.name.toLowerCase().includes(query) ||
                       guru.role.toLowerCase().includes(query) ||
                       guru.subject.toLowerCase().includes(query) ||
                       guru.nip.toLowerCase().includes(query) ||
                       guru.id.toLowerCase().includes(query);

    const matchCategory = (category === 'ALL') || (guru.category === category);
    const matchSensor = (sensor === 'ALL') || (guru.sensorType === sensor);

    const stats = getTeacherStats(guru.id);
    let matchPct = true;
    if (pctFilter === 'HIGH') matchPct = stats.persentaseKehadiran >= 90;
    else if (pctFilter === 'MID') matchPct = stats.persentaseKehadiran >= 75 && stats.persentaseKehadiran < 90;
    else if (pctFilter === 'LOW') matchPct = stats.persentaseKehadiran < 75;

    return matchQuery && matchCategory && matchSensor && matchPct;
  });

  renderTeachersGrid(filtered);
}

// ==========================================
// 7. RENDER TAB LOG & REKAP TABEL
// ==========================================
function renderLogsTable(filteredLogs = null) {
  const tbody = document.getElementById('allLogsTbody');
  if (!tbody) return;

  const currentUser = getCurrentUser();
  const noticeBanner = document.getElementById('logRoleNoticeBanner');

  // Jika tidak disediakan data terfilter secara eksplisit, periksa filter aktif
  if (filteredLogs === null) {
    const query = document.getElementById('logSearchInput') ? document.getElementById('logSearchInput').value.trim() : '';
    const dateVal = document.getElementById('logDateFilter') ? document.getElementById('logDateFilter').value : 'ALL';
    const categoryFilter = document.getElementById('logCategoryFilter') ? document.getElementById('logCategoryFilter').value : 'ALL';
    const statusFilter = document.getElementById('logStatusFilter') ? document.getElementById('logStatusFilter').value : 'ALL';

    if (query || (dateVal && dateVal !== 'ALL') || (categoryFilter && categoryFilter !== 'ALL') || (statusFilter && statusFilter !== 'ALL')) {
      filterLogs();
      return;
    }
  }

  let baseLogs = attendanceLogs;
  if (currentUser && (currentUser.role === 'GURU' || currentUser.role === 'PENGELOLA')) {
    baseLogs = attendanceLogs.filter(l => 
      String(l.guruId) === String(currentUser.teacherId) || 
      (l.nama && currentUser.name && l.nama.toLowerCase().includes(currentUser.name.toLowerCase()))
    );
  }

  const logs = filteredLogs !== null ? filteredLogs : baseLogs;

  // Render Banner Informasi Akses Riwayat
  if (noticeBanner) {
    if (currentUser && (currentUser.role === 'GURU' || currentUser.role === 'PENGELOLA')) {
      noticeBanner.style.display = 'flex';
      noticeBanner.className = 'mb-3.5 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-xs';
      noticeBanner.innerHTML = `
        <span class="material-symbols-outlined text-[18px] text-emerald-700">lock_open</span>
        <div style="line-height: 1.4;">
          <strong>Mode Rekap Presensi Mandiri:</strong> Menampilkan riwayat kehadiran milik <strong>${currentUser.name}</strong> (${logs.length} catatan). Untuk melihat seluruh guru, masuk sebagai Administrator.
        </div>
      `;
    } else {
      noticeBanner.style.display = 'flex';
      noticeBanner.className = 'mb-3.5 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 bg-slate-50 text-slate-800 border border-slate-200/80 shadow-xs';
      noticeBanner.innerHTML = `
        <span class="material-symbols-outlined text-[18px] text-slate-600">admin_panel_settings</span>
        <div style="line-height: 1.4;">
          <strong>Akses Administrator:</strong> Menampilkan seluruh riwayat presensi dewan guru & staf (${logs.length} catatan terdata).
        </div>
      `;
    }
  }

  // Anti-Flicker: Jika data log yang dirender sama persis dengan yang ada di DOM, jangan reset innerHTML agar posisi scroll pengguna tidak terganggu
  const newSignature = logs.map(l => `${l.id || l.tanggal}_${l.guruId}_${l.waktuMasuk}_${l.waktuKeluar}_${l.status}`).join('|');
  if (tbody.dataset.signature === newSignature) {
    return;
  }
  tbody.dataset.signature = newSignature;

  tbody.innerHTML = '';

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">Tidak ada riwayat absensi yang cocok dengan filter.</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');

    const statusBadge = log.status === 'TAP OUT'
      ? `<span class="badge badge-out"><i class="fa-solid fa-check-double"></i> PULANG</span>`
      : `<span class="badge badge-in"><i class="fa-solid fa-arrow-right-to-bracket"></i> MASUK</span>`;

    tr.innerHTML = `
      <td>
        <strong style="color: #141b2b;">${log.tanggal}</strong>
        <div style="font-size: 11px; color: #006c49; font-weight: 600;">${log.hari || '-'}</div>
      </td>
      <td>
        <strong style="color: #141b2b; display: block;">${log.nama}</strong>
        <span style="color: var(--text-secondary); font-size: 11px;">${log.jabatan}</span>
      </td>
      <td>
        <span class="badge" style="background: rgba(0, 108, 73, 0.1); color: #006c49; border: 1px solid rgba(0, 108, 73, 0.25); font-weight: 700;">
          <i class="fa-solid fa-key"></i> ${log.guruId}
        </span>
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${log.tipe === 'RFID' ? 'Kartu RFID' : 'Sidik Jari'}</div>
      </td>
      <td><span style="font-weight: 700; color: #141b2b;">${log.waktuMasuk}</span></td>
      <td>${log.waktuKeluar === '-' ? '<span style="color: var(--text-muted);">-</span>' : `<span style="font-weight: 700; color: #141b2b;">${log.waktuKeluar}</span>`}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="openTeacherDetail('${log.guruId}')" title="Detail & Jadwal">
          <i class="fa-solid fa-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function populateDateFilterOptions() {
  const select = document.getElementById('logDateFilter');
  if (!select) return;

  const currentVal = select.value || 'ALL';
  const currentUser = getCurrentUser();

  let baseLogs = attendanceLogs;
  if (currentUser && (currentUser.role === 'GURU' || currentUser.role === 'PENGELOLA')) {
    baseLogs = attendanceLogs.filter(l => 
      String(l.guruId) === String(currentUser.teacherId) || 
      (l.nama && currentUser.name && l.nama.toLowerCase().includes(currentUser.name.toLowerCase()))
    );
  }

  // Kumpulkan semua tanggal unik dari baseLogs yang relevan dengan akun aktif
  const uniqueDates = [];
  const seenDates = new Set();

  baseLogs.forEach(log => {
    if (log.tanggal && !seenDates.has(log.tanggal)) {
      seenDates.add(log.tanggal);
      uniqueDates.push({
        tanggal: log.tanggal,
        hari: log.hari || getDayFromDateString(log.tanggal)
      });
    }
  });

  // Urutkan tanggal dari terbaru ke terlama
  uniqueDates.sort((a, b) => {
    const parse = (str) => {
      const parts = str.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      }
      return 0;
    };
    return parse(b.tanggal) - parse(a.tanggal);
  });

  const labelAll = currentUser && (currentUser.role === 'GURU' || currentUser.role === 'PENGELOLA')
    ? `Semua Tanggal Pribadi (${baseLogs.length} Log)`
    : `Semua Tanggal (${attendanceLogs.length} Log)`;

  let optionsHtml = `<option value="ALL">${labelAll}</option>`;
  
  if (uniqueDates.length > 0) {
    optionsHtml += `<optgroup label="Pilih Tanggal Riwayat:">`;
    uniqueDates.forEach(item => {
      optionsHtml += `<option value="${item.tanggal}">${item.tanggal} (${item.hari})</option>`;
    });
    optionsHtml += `</optgroup>`;
  }

  optionsHtml += `<option value="CUSTOM">📅 Pilih Kalender Bebas...</option>`;
  select.innerHTML = optionsHtml;

  // Pertahankan nilai pilihan sebelumnya jika masih ada
  if (Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  } else {
    select.value = 'ALL';
  }
}

function handleDateFilterChange() {
  const select = document.getElementById('logDateFilter');
  if (!select) return;

  if (select.value === 'CUSTOM') {
    const customPicker = document.getElementById('logCustomDatePicker');
    if (customPicker) {
      if (typeof customPicker.showPicker === 'function') {
        try {
          customPicker.showPicker();
        } catch (e) {
          customPicker.click();
        }
      } else {
        customPicker.click();
      }
    }
    return;
  }

  filterLogs();
}

function handleCustomDatePicked(pickerVal) {
  if (!pickerVal) {
    document.getElementById('logDateFilter').value = 'ALL';
    filterLogs();
    return;
  }
  // Konversi yyyy-mm-dd ke dd-mm-yyyy
  const parts = pickerVal.split('-');
  const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
  const dayName = getDayFromDateString(formatted);

  const select = document.getElementById('logDateFilter');
  let opt = Array.from(select.options).find(o => o.value === formatted);
  if (!opt) {
    opt = document.createElement('option');
    opt.value = formatted;
    opt.textContent = `📅 ${formatted} (${dayName})`;
    select.appendChild(opt);
  }
  select.value = formatted;
  filterLogs();
}

function filterLogs() {
  const query = document.getElementById('logSearchInput').value.toLowerCase().trim();
  const dateVal = document.getElementById('logDateFilter').value;
  const categoryFilter = document.getElementById('logCategoryFilter').value;
  const statusFilter = document.getElementById('logStatusFilter').value;

  const currentUser = getCurrentUser();
  let baseLogs = attendanceLogs;
  if (currentUser && (currentUser.role === 'GURU' || currentUser.role === 'PENGELOLA')) {
    baseLogs = attendanceLogs.filter(l => 
      String(l.guruId) === String(currentUser.teacherId) || 
      (l.nama && currentUser.name && l.nama.toLowerCase().includes(currentUser.name.toLowerCase()))
    );
  }

  const filtered = baseLogs.filter(log => {
    const matchQuery = !query ||
                       log.nama.toLowerCase().includes(query) ||
                       log.jabatan.toLowerCase().includes(query) ||
                       log.guruId.toLowerCase().includes(query) ||
                       log.tanggal.toLowerCase().includes(query);

    const matchDate = (dateVal === 'ALL') || (log.tanggal === dateVal);
    const matchCategory = (categoryFilter === 'ALL') || (log.kategori === categoryFilter);

    let matchStatus = true;
    if (statusFilter === 'TAP IN') matchStatus = log.status === 'TAP IN';
    else if (statusFilter === 'TAP OUT') matchStatus = log.status === 'TAP OUT';

    return matchQuery && matchDate && matchCategory && matchStatus;
  });

  renderLogsTable(filtered);
}

// ==========================================
// 8. MODAL DETAIL GURU & JADWAL PRIBADI
// ==========================================
function openTeacherDetail(guruId) {
  const guru = masterGuru.find(g => g.id === guruId);
  if (!guru) return;

  const stats = getTeacherStats(guruId);
  const modal = document.getElementById('teacherDetailModal');
  const body = document.getElementById('modalTeacherBody');
  document.getElementById('modalTeacherName').textContent = `Profil & Jadwal: ${guru.name}`;

  let pctClass = stats.persentaseKehadiran >= 90 ? 'pct-high' : (stats.persentaseKehadiran >= 75 ? 'pct-mid' : 'pct-low');
  let fillClass = stats.persentaseKehadiran >= 90 ? 'fill-high' : (stats.persentaseKehadiran >= 75 ? 'fill-mid' : 'fill-low');

  // Render Jadwal Mingguan
  let scheduleRowsHtml = guru.scheduleDetails.map(item => `
    <tr>
      <td><span class="sched-day-tag">${item.day}</span></td>
      <td><strong>${item.time}</strong></td>
      <td><span style="color: #0f172a; font-weight: 600;">${item.subject}</span></td>
      <td><span class="class-pill">${item.class}</span></td>
      <td><span class="room-pill">${item.room}</span></td>
    </tr>
  `).join('');

  // Riwayat Terakhir
  let logRowsHtml = stats.recentLogs.map(log => `
    <tr>
      <td>${log.tanggal} (${log.hari || '-'})</td>
      <td><strong style="color: #0f172a;">${log.waktuMasuk}</strong></td>
      <td>${log.waktuKeluar === '-' ? '<span style="color: var(--text-muted);">-</span>' : `<strong style="color: #0f172a;">${log.waktuKeluar}</strong>`}</td>
      <td>
        <span class="badge ${log.status === 'TAP OUT' ? 'badge-out' : 'badge-in'}">${log.status === 'TAP OUT' ? 'PULANG' : 'MASUK'}</span>
      </td>
    </tr>
  `).join('');

  if (stats.recentLogs.length === 0) {
    logRowsHtml = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">Belum ada riwayat tercatat.</td></tr>`;
  }

  const checkOutPct = stats.totalHadir > 0 ? Math.round((stats.totalCheckOut / stats.totalHadir) * 100) : 100;

  body.innerHTML = `
    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 20px;">
      <img src="${guru.photo}" style="width: 68px; height: 68px; border-radius: 18px; object-fit: cover; border: 2px solid var(--border-color);">
      <div>
        <h4 style="font-size: 16px; color: #0f172a; font-weight: 700; margin-bottom: 3px;">${guru.name}</h4>
        <div style="font-size: 12.5px; color: var(--primary); font-weight: 600;">${guru.role}</div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
          NIP: ${guru.nip} &bull; <strong style="color: #0f172a;">Kode Unik: <code>${guru.id}</code></strong>
        </div>
      </div>
    </div>

    <!-- Indikator Persentase -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
      <div class="attendance-progress-box" style="margin: 0;">
        <div class="progress-header">
          <span class="progress-label">Kehadiran (Sesuai Jadwal)</span>
          <span class="progress-value ${pctClass}">${stats.persentaseKehadiran}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill ${fillClass}" style="width: ${stats.persentaseKehadiran}%"></div>
        </div>
        <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 5px;">
          ${stats.totalHadir} hadir dari target ${stats.targetHariJadwal} hari jadwal
        </div>
      </div>

      <div class="attendance-progress-box" style="margin: 0;">
        <div class="progress-header">
          <span class="progress-label">Kelengkapan Check Out</span>
          <span class="progress-value pct-high">${checkOutPct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill fill-high" style="width: ${checkOutPct}%"></div>
        </div>
        <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 5px;">
          ${stats.totalCheckOut} dari ${stats.totalHadir} kehadiran telah check out
        </div>
      </div>
    </div>

    <!-- Jadwal Mingguan -->
    <h5 style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
      <i class="fa-solid fa-calendar-week" style="color: var(--primary-light);"></i> Jadwal Wajib Mingguan
    </h5>
    <div class="table-responsive" style="margin-bottom: 20px;">
      <table class="modern-table">
        <thead>
          <tr>
            <th>Hari</th>
            <th>Jam</th>
            <th>Mata Pelajaran / Tugas</th>
            <th>Kelas</th>
            <th>Ruangan</th>
          </tr>
        </thead>
        <tbody>
          ${scheduleRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Tabel Riwayat Terakhir -->
    <h5 style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
      <i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-cyan);"></i> Riwayat Presensi Terkini
    </h5>
    <div class="table-responsive" style="max-height: 180px; overflow-y: auto;">
      <table class="modern-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Check In (Masuk)</th>
            <th>Check Out (Pulang)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${logRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  modal.classList.add('active');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ==========================================
// 8. KELOLA DATA GURU & CLOUD ENROLLMENT ALAT ABSEN
// ==========================================

let cloudEnrollSessionTimer = null;
let cloudEnrollPollInterval = null;
let activeCommandId = null;

function getSuggestedNextId(devicePrefix) {
  const prefix = (devicePrefix || 'A').toUpperCase() + '_';
  let maxNum = 0;
  masterGuru.forEach(g => {
    const sId = String(g.id);
    if (sId.startsWith(prefix)) {
      const n = parseInt(sId.replace(prefix, ''), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    } else if (!sId.includes('_')) {
      const n = parseInt(sId, 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  });
  return `${prefix}${maxNum + 1}`;
}

function openAddTeacherModal() {
  document.getElementById('teacherFormMode').value = 'ADD';
  document.getElementById('teacherFormOriginalId').value = '';
  document.getElementById('teacherFormModalTitle').textContent = 'Tambah Guru / Staf Baru';
  
  document.getElementById('teacherFormName').value = '';
  document.getElementById('teacherFormRole').value = '';
  document.getElementById('teacherFormCategory').value = 'PENGAJAR';
  document.getElementById('teacherFormSensor').value = 'FINGER';
  document.getElementById('teacherFormDevice').value = 'A';
  
  // Suggest next unique ID based on Device A
  const nextId = getSuggestedNextId('A');
  const idInput = document.getElementById('teacherFormId');
  idInput.value = nextId;
  idInput.disabled = false;
  
  document.getElementById('btnSaveTeacherManual').style.display = 'inline-flex';
  document.getElementById('btnTriggerCloudEnroll').style.display = 'inline-flex';
  
  openModal('teacherFormModal');
}

function openEditTeacherModal(guruId) {
  const guru = masterGuru.find(g => String(g.id) === String(guruId));
  if (!guru) {
    showToast('Data guru tidak ditemukan.', 'error');
    return;
  }

  document.getElementById('teacherFormMode').value = 'EDIT';
  document.getElementById('teacherFormOriginalId').value = guru.id;
  document.getElementById('teacherFormModalTitle').textContent = `Edit Data: ${guru.name}`;

  document.getElementById('teacherFormName').value = guru.name;
  document.getElementById('teacherFormRole').value = guru.role;
  document.getElementById('teacherFormCategory').value = guru.category || 'PENGAJAR';
  document.getElementById('teacherFormSensor').value = guru.sensorType || 'FINGER';

  // Determine device
  const sId = String(guru.id);
  let dev = 'A';
  if (sId.startsWith('B_')) dev = 'B';
  else if (sId.startsWith('C_')) dev = 'C';
  document.getElementById('teacherFormDevice').value = dev;

  const idInput = document.getElementById('teacherFormId');
  idInput.value = guru.id;
  idInput.disabled = true; // ID tidak diubah saat edit agar sinkron dengan sidik jari mesin

  document.getElementById('btnSaveTeacherManual').style.display = 'inline-flex';
  document.getElementById('btnTriggerCloudEnroll').style.display = 'none'; // Pendaftaran sensor hanya untuk ID baru

  openModal('teacherFormModal');
}

async function handleSaveTeacherManual() {
  const mode = document.getElementById('teacherFormMode').value;
  const originalId = document.getElementById('teacherFormOriginalId').value;
  const name = document.getElementById('teacherFormName').value.trim();
  const role = document.getElementById('teacherFormRole').value.trim();
  const category = document.getElementById('teacherFormCategory').value;
  const sensor = document.getElementById('teacherFormSensor').value;
  const device = document.getElementById('teacherFormDevice').value;
  let id = document.getElementById('teacherFormId').value.trim();

  if (!name) {
    showToast('Silakan masukkan nama lengkap guru!', 'warning');
    return;
  }

  if (!id) {
    id = getSuggestedNextId(device);
  }

  const btn = document.getElementById('btnSaveTeacherManual');
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  btn.disabled = true;

  try {
    let res;
    if (mode === 'ADD') {
      res = await apiAddTeacher({
        id: id,
        name: name,
        role: role || (category === 'PENGAJAR' ? 'Guru Mapel' : 'Staf Pengurus'),
        type: sensor
      });
    } else {
      res = await apiUpdateTeacher({
        id: originalId || id,
        name: name,
        role: role || (category === 'PENGAJAR' ? 'Guru Mapel' : 'Staf Pengurus'),
        type: sensor
      });
    }

    if (res && res.success) {
      showToast(res.message || 'Data guru berhasil disimpan ke spreadsheet!', 'success');
      closeModal('teacherFormModal');
      // Refresh live data dari spreadsheet
      await loadLiveGoogleSheetData();
      initSimulatorSelect();
      renderAllViews();
    } else {
      showToast((res && res.message) || 'Gagal menyimpan data guru ke server.', 'error');
    }
  } catch (err) {
    console.error('Error saving teacher:', err);
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

async function handleStartCloudEnroll() {
  const name = document.getElementById('teacherFormName').value.trim();
  const role = document.getElementById('teacherFormRole').value.trim();
  const category = document.getElementById('teacherFormCategory').value;
  const sensor = document.getElementById('teacherFormSensor').value;
  const device = document.getElementById('teacherFormDevice').value || 'A';

  if (!name) {
    showToast('Silakan masukkan nama lengkap guru terlebih dahulu!', 'warning');
    return;
  }

  const command = sensor === 'RFID' ? 'ENROLL_RFID' : 'ENROLL_FINGER';

  // Tutup form input guru dan buka modal pemantauan cloud enroll
  closeModal('teacherFormModal');
  openModal('cloudEnrollModal');

  // Set UI Sesi
  document.getElementById('cloudEnrollTeacherName').textContent = name;
  document.getElementById('cloudEnrollDeviceBadge').textContent = `MESIN ${device} (MENUNGGU RESPON)`;
  document.getElementById('cloudEnrollStatusDesc').innerHTML = `Perintah pendaftaran <strong>${sensor === 'RFID' ? 'Kartu RFID' : 'Sidik Jari'}</strong> dikirim ke antrean Cloud.<br>Meminta Mesin Absen ${device} bersiap...`;
  
  const progressBar = document.getElementById('cloudEnrollProgressBar');
  const timerText = document.getElementById('cloudEnrollTimerText');
  const timerCountdown = document.getElementById('cloudEnrollTimerCountdown');
  
  if (progressBar) progressBar.style.width = '10%';
  if (timerText) timerText.textContent = 'Menghubungkan ke Google Cloud...';

  try {
    const queueRes = await apiQueueEnroll({
      device: device,
      command: command,
      name: name,
      role: role || (category === 'PENGAJAR' ? 'Guru Mapel' : 'Staf Pengurus'),
      type: sensor
    });

    if (!queueRes || !queueRes.success) {
      showToast('Gagal mengirim perintah antrean ke Google Cloud: ' + (queueRes ? queueRes.message : ''), 'error');
      cancelCloudEnroll();
      return;
    }

    activeCommandId = queueRes.commandId;
    showToast(`Perintah pendaftaran aktif di Mesin ${device}!`, 'info');

    // Mulai polling real-time selama maks 35 detik
    let countdown = 35;
    if (timerCountdown) timerCountdown.textContent = `${countdown}s`;

    clearInterval(cloudEnrollPollInterval);
    clearTimeout(cloudEnrollSessionTimer);

    cloudEnrollPollInterval = setInterval(async () => {
      countdown--;
      if (timerCountdown) timerCountdown.textContent = `${countdown}s`;
      
      const pct = Math.min(95, Math.round(((35 - countdown) / 35) * 100));
      if (progressBar) progressBar.style.width = `${pct}%`;

      if (countdown <= 0) {
        clearInterval(cloudEnrollPollInterval);
        showToast('Waktu pendaftaran di mesin habis (Timeout). Pastikan mesin absen menyala dan terhubung WiFi.', 'warning');
        cancelCloudEnroll();
        return;
      }

      // Cek status perintah di Google Sheet antrean Device_Commands
      try {
        const checkRes = await apiCheckEnrollStatus(activeCommandId);
        if (checkRes && checkRes.success) {
          const status = checkRes.status;
          
          if (status === 'PROCESSING') {
            document.getElementById('cloudEnrollDeviceBadge').textContent = `MESIN ${device} (SENSOR SCAN AKTIF)`;
            document.getElementById('cloudEnrollStatusDesc').innerHTML = `<span style="color: var(--accent-cyan); font-weight: 700;">Mesin telah menerima perintah!</span><br>Silakan tempelkan jari / kartu pada sensor mesin absen sekarang!`;
            if (timerText) timerText.textContent = 'Merekam sensor di mesin absen...';
          } else if (status === 'COMPLETED') {
            clearInterval(cloudEnrollPollInterval);
            if (progressBar) progressBar.style.width = '100%';
            if (timerText) timerText.textContent = 'Pendaftaran Berhasil!';
            
            const assignedId = checkRes.assignedId || 'Baru';
            showToast(`Sukses! ${name} berhasil didaftarkan di Mesin ${device} dengan ID: ${assignedId}`, 'success');
            
            setTimeout(async () => {
              closeModal('cloudEnrollModal');
              await loadLiveGoogleSheetData();
              initSimulatorSelect();
              renderAllViews();
            }, 1200);
          } else if (status === 'FAILED') {
            clearInterval(cloudEnrollPollInterval);
            showToast('Pendaftaran dibatalkan atau gagal pada sensor mesin.', 'error');
            cancelCloudEnroll();
          }
        }
      } catch (pollErr) {
        console.warn('Polling check error:', pollErr);
      }
    }, 1500);

  } catch (err) {
    console.error('Error starting cloud enroll:', err);
    showToast('Gagal memulai pendaftaran cloud: ' + err.message, 'error');
    cancelCloudEnroll();
  }
}

function cancelCloudEnroll() {
  if (cloudEnrollPollInterval) {
    clearInterval(cloudEnrollPollInterval);
    cloudEnrollPollInterval = null;
  }
  if (cloudEnrollSessionTimer) {
    clearTimeout(cloudEnrollSessionTimer);
    cloudEnrollSessionTimer = null;
  }
  activeCommandId = null;
  closeModal('cloudEnrollModal');
}

async function confirmDeleteTeacher(guruId) {
  const guru = masterGuru.find(g => String(g.id) === String(guruId));
  const name = guru ? guru.name : guruId;

  const sure = window.confirm(`Apakah Anda yakin ingin menghapus data guru:\n\n"${name}" (ID: ${guruId})?\n\nData ini akan dihapus dari Database Guru di Spreadsheet.`);
  if (!sure) return;

  showToast(`Menghapus data guru ${name}...`, 'info');
  try {
    const res = await apiDeleteTeacher(guruId);
    if (res && res.success) {
      showToast(`Data guru ${name} berhasil dihapus!`, 'success');
      await loadLiveGoogleSheetData();
      initSimulatorSelect();
      renderAllViews();
    } else {
      showToast((res && res.message) || 'Gagal menghapus guru dari server.', 'error');
    }
  } catch (err) {
    console.error('Error deleting teacher:', err);
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  }
}

// ==========================================
// 9. SIMULATOR TAP PRESENSI
// ==========================================
function initSimulatorSelect() {
  const select = document.getElementById('simGuruSelect');
  if (!select) return;

  select.innerHTML = '';

  const optGroupPengajar = document.createElement('optgroup');
  optGroupPengajar.label = "Unit Pengajar (Guru)";

  const optGroupPengurus = document.createElement('optgroup');
  optGroupPengurus.label = "Unit Pengurus (Staf)";

  masterGuru.forEach(guru => {
    const opt = document.createElement('option');
    opt.value = guru.id;
    opt.textContent = `${guru.name} [Kode: ${guru.id}]`;

    if (guru.category === 'PENGAJAR') {
      optGroupPengajar.appendChild(opt);
    } else {
      optGroupPengurus.appendChild(opt);
    }
  });

  select.appendChild(optGroupPengajar);
  select.appendChild(optGroupPengurus);
}

function openSimulatorModal() {
  document.getElementById('simulatorModal').classList.add('active');
}
window.openSimModal = openSimulatorModal;

function executeSimulatedTap() {
  const select = document.getElementById('simGuruSelect');
  const guruId = select.value;

  const res = simulateEspTap(guruId);
  closeModal('simulatorModal');

  if (res.success) {
    const actText = res.action === 'TAP OUT' ? 'Presensi Pulang Berhasil' : 'Presensi Masuk Berhasil';
    showToast(`${actText}: ${res.nama} (Kode: ${guruId})`, res.action === 'TAP OUT' ? 'warning' : 'success');
  } else {
    showToast(res.message, 'error');
  }

  renderAllViews();
}

async function refreshData() {
  showToast("Memuat ulang data terbaru dari Spreadsheet...", "info");
  await loadLiveGoogleSheetData();
  initSimulatorSelect();
  renderAllViews();
  showToast("Data presensi telah diperbarui!", "success");
}

// ==========================================
// 10. TOAST NOTIFIKASI
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: 'fa-circle-check',
    warning: 'fa-triangle-exclamation',
    error: 'fa-circle-xmark',
    info: 'fa-circle-info'
  };

  const iconColors = {
    success: '#054e37',
    warning: '#b45309',
    error: '#b91c1c',
    info: '#0369a1'
  };

  const bgColors = {
    success: '#dcfce7',
    warning: '#fef3c7',
    error: '#fee2e2',
    info: '#e0f2fe'
  };

  toast.innerHTML = `
    <div style="width: 30px; height: 30px; border-radius: 50%; background: ${bgColors[type] || '#e0f2fe'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <i class="fa-solid ${iconMap[type] || 'fa-bell'}" style="font-size: 14px; color: ${iconColors[type] || '#054e37'};"></i>
    </div>
    <div class="toast-message" style="color: #0f172a !important; font-size: 13.5px; font-weight: 600; line-height: 1.4;">${message}</div>
    <button style="margin-left: auto; background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; font-size: 13px; display: flex; align-items: center;" onclick="this.closest('.toast').remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// 11. EKSPOR KE CSV & LAPORAN REKAPITULASI BULANAN
// ==========================================
const INDO_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

let currentExportFormat = 'RECAP'; // 'RECAP' atau 'DETAILED'

function getAvailableExportMonths() {
  const monthMap = new Map();

  attendanceLogs.forEach(log => {
    if (log.tanggal) {
      const parts = log.tanggal.split('-'); // format dd-MM-yyyy
      if (parts.length === 3) {
        const monthNum = parseInt(parts[1], 10);
        const yearNum = parseInt(parts[2], 10);
        const key = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
        if (!monthMap.has(key)) {
          monthMap.set(key, {
            key: key,
            year: yearNum,
            month: monthNum,
            label: `${INDO_MONTH_NAMES[monthNum - 1]} ${yearNum}`
          });
        }
      }
    }
  });

  // Urutkan dari bulan terbaru
  return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function openExportModal() {
  const months = getAvailableExportMonths();

  const singleSelect = document.getElementById('exportSingleMonthSelect');
  const startSelect = document.getElementById('exportRangeStartSelect');
  const endSelect = document.getElementById('exportRangeEndSelect');

  let monthOptionsHtml = '';
  months.forEach(m => {
    monthOptionsHtml += `<option value="${m.key}">${m.label}</option>`;
  });

  if (months.length === 0) {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const curLabel = `${INDO_MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    monthOptionsHtml = `<option value="${curKey}">${curLabel}</option>`;
  }

  if (singleSelect) singleSelect.innerHTML = monthOptionsHtml;
  if (startSelect) {
    const ascMonths = [...months].reverse();
    startSelect.innerHTML = ascMonths.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
  }
  if (endSelect) endSelect.innerHTML = monthOptionsHtml;

  // Reset tampilan modal
  selectExportFormat('RECAP');
  document.getElementById('exportPeriodMode').value = 'ALL';
  handleExportPeriodModeChange();

  const modal = document.getElementById('exportModal');
  if (modal) modal.classList.add('active');
}

function selectExportFormat(format) {
  currentExportFormat = format;
  const optRecap = document.getElementById('optFormatRecap');
  const optDetailed = document.getElementById('optFormatDetailed');

  if (format === 'RECAP') {
    if (optRecap) optRecap.classList.add('active');
    if (optDetailed) optDetailed.classList.remove('active');
  } else {
    if (optDetailed) optDetailed.classList.add('active');
    if (optRecap) optRecap.classList.remove('active');
  }
}

function handleExportPeriodModeChange() {
  const mode = document.getElementById('exportPeriodMode').value;
  const singleGroup = document.getElementById('exportSingleMonthGroup');
  const rangeGroup = document.getElementById('exportRangeMonthGroup');

  if (mode === 'SINGLE') {
    if (singleGroup) singleGroup.style.display = 'block';
    if (rangeGroup) rangeGroup.style.display = 'none';
  } else if (mode === 'RANGE') {
    if (singleGroup) singleGroup.style.display = 'none';
    if (rangeGroup) rangeGroup.style.display = 'block';
  } else {
    if (singleGroup) singleGroup.style.display = 'none';
    if (rangeGroup) rangeGroup.style.display = 'none';
  }
}

function executeExportDownload(fileType = 'XLS') {
  if (attendanceLogs.length === 0) {
    showToast("Tidak ada data presensi untuk diekspor", "warning");
    return;
  }

  const periodMode = document.getElementById('exportPeriodMode').value;
  const unitFilter = document.getElementById('exportUnitSelect').value;

  let targetStartKey = '';
  let targetEndKey = '';

  if (periodMode === 'SINGLE') {
    targetStartKey = document.getElementById('exportSingleMonthSelect').value;
    targetEndKey = targetStartKey;
  } else if (periodMode === 'RANGE') {
    targetStartKey = document.getElementById('exportRangeStartSelect').value;
    targetEndKey = document.getElementById('exportRangeEndSelect').value;
    if (targetStartKey > targetEndKey) {
      const temp = targetStartKey;
      targetStartKey = targetEndKey;
      targetEndKey = temp;
    }
  }

  // Filter logs berdasarkan periode dan unit
  const filteredLogs = attendanceLogs.filter(log => {
    if (unitFilter !== 'ALL' && log.kategori !== unitFilter) {
      return false;
    }

    if (periodMode !== 'ALL' && log.tanggal) {
      const parts = log.tanggal.split('-');
      if (parts.length === 3) {
        const logMonthKey = `${parts[2]}-${String(parts[1]).padStart(2, '0')}`;
        if (logMonthKey < targetStartKey || logMonthKey > targetEndKey) {
          return false;
        }
      }
    }

    return true;
  });

  if (filteredLogs.length === 0) {
    showToast("Tidak ada data yang cocok dengan periode yang dipilih", "warning");
    return;
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const periodLabel = periodMode === 'ALL' ? 'Semua_Periode' : (targetStartKey === targetEndKey ? targetStartKey : `${targetStartKey}_sd_${targetEndKey}`);

  let headers = [];
  let rows = [];
  let baseFileName = "";
  let reportTitle = "";

  if (currentExportFormat === 'RECAP') {
    // 1. FORMAT TABEL REKAPITULASI BULANAN PER GURU / STAF
    baseFileName = `Rekapitulasi_Presensi_${periodLabel}_${dateStamp}`;
    reportTitle = `REKAPITULASI KEHADIRAN GURU & STAF (${periodMode === 'ALL' ? 'Semua Periode' : periodLabel})`;

    headers = [
      "No", "Kode ID", "Nama Guru / Staf", "Jabatan", "Kategori Unit",
      "Total Hadir", "Check Out Selesai", "Check In Saja", "Persentase Kehadiran (%)"
    ];

    let targetTeachers = masterGuru;
    if (unitFilter !== 'ALL') {
      targetTeachers = targetTeachers.filter(g => g.category === unitFilter);
    }

    targetTeachers.forEach((guru, idx) => {
      const gLogs = filteredLogs.filter(l => String(l.guruId) === String(guru.id) || l.nama === guru.name);
      const totalHadir = gLogs.length;
      const totalCheckOut = gLogs.filter(l => l.waktuKeluar && l.waktuKeluar !== '-').length;
      const uniqueDates = Array.from(new Set(attendanceLogs.map(l => l.tanggal)));
      const targetDays = Math.max(1, uniqueDates.slice(0, 10).length);
      const kehadiranPct = Math.min(100, Math.round((totalHadir / targetDays) * 100));

      rows.push([
        idx + 1,
        guru.id,
        guru.name,
        guru.role,
        guru.category === 'PENGAJAR' ? 'Unit Pengajar (Guru)' : 'Unit Pengurus (Staf)',
        totalHadir,
        totalCheckOut,
        totalCheckInOnly,
        `${kehadiranPct}%`
      ]);
    });

  } else {
    // 2. FORMAT LOG RINCIAN RIWAYAT HARIAN
    baseFileName = `Log_Presensi_Harian_${periodLabel}_${dateStamp}`;
    reportTitle = `LOG RINCIAN HARIAN PRESENSI (${periodMode === 'ALL' ? 'Semua Periode' : periodLabel})`;

    headers = [
      "No", "Tanggal", "Hari", "Kode ID", "Nama", "Jabatan",
      "Kategori Unit", "Sensor", "Waktu Check In", "Waktu Check Out", "Status"
    ];

    filteredLogs.forEach((log, idx) => {
      rows.push([
        idx + 1,
        log.tanggal,
        log.hari || '-',
        log.guruId,
        log.nama,
        log.jabatan,
        log.kategori === 'PENGAJAR' ? 'Pengajar' : (log.kategori === 'PENGURUS' ? 'Pengurus' : '-'),
        log.tipe,
        log.waktuMasuk,
        log.waktuKeluar,
        log.status
      ]);
    });
  }

  if (fileType === 'XLS') {
    // Unduh sebagai Excel Workbook Asli (.xls) dengan format tabel bergaris rapi
    downloadExcelHTML(reportTitle, headers, rows, `${baseFileName}.xls`);
  } else {
    // Unduh sebagai CSV dengan delimiter titik-koma (;) dan sep=; agar Excel Indonesia membagi kolom
    downloadSemicolonCSV(headers, rows, `${baseFileName}.csv`);
  }

  closeModal('exportModal');
}

function downloadExcelHTML(title, headers, rows, fileName) {
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Laporan Presensi</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
        th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #475569; padding: 8px 12px; text-align: center; }
        td { border: 1px solid #cbd5e1; padding: 6px 10px; }
        .text-center { text-align: center; }
        h2 { font-family: Calibri, Arial, sans-serif; color: #0f172a; margin-bottom: 6px; font-size: 14pt; }
        p { font-family: Calibri, Arial, sans-serif; color: #64748b; font-size: 10pt; margin-top: 0; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <h2>${title}</h2>
      <p>Dicetak otomatis dari Portal Presensi SMA Daruttaqwa pada ${new Date().toLocaleString('id-ID')}</p>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              ${r.map((c, i) => {
                const isCenter = i === 0 || i === 1 || i === 5 || i === 6 || i === 7 || i === 8;
                return `<td class="${isCenter ? 'text-center' : ''}">${String(c).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  triggerStandardDownload(blob, fileName);
}

function downloadSemicolonCSV(headers, rows, fileName) {
  // sep=;\r\n adalah instruksi resmi Microsoft Excel untuk membagi kolom menggunakan titik koma (;)
  const BOM = "\uFEFF";
  let csv = "sep=;\r\n";
  csv += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(";") + "\r\n";

  rows.forEach(r => {
    const line = r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";");
    csv += line + "\r\n";
  });

  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  triggerStandardDownload(blob, fileName);
}

function triggerStandardDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 400);

  showToast(`File ${fileName} berhasil diunduh!`, "success");
}

// Fallback untuk backward compatibility jika ada pemanggilan lama
function exportLogsToCSV() {
  openExportModal();
}

// ==========================================
// REACTBITS DOCK INTERACTION & MAGNIFICATION
// ==========================================
function initMobileDock() {
  const dockPanel = document.getElementById('mobileDockPanel');
  if (!dockPanel) return;

  const items = dockPanel.querySelectorAll('.dock-item');
  const maxScale = 1.32;
  const maxDistance = 90; // radius of influence in px

  function onPointerMove(e) {
    const mouseX = e.clientX;
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      const dist = Math.abs(mouseX - itemCenterX);

      if (dist < maxDistance) {
        const factor = 1 - (dist / maxDistance);
        const scale = 1 + (maxScale - 1) * Math.pow(factor, 1.4);
        item.style.transform = `scale(${scale.toFixed(3)}) translateY(-${((scale - 1) * 10).toFixed(1)}px)`;
      } else {
        item.style.transform = 'scale(1) translateY(0)';
      }
    });
  }

  function resetDock() {
    items.forEach(item => {
      item.style.transform = 'scale(1) translateY(0)';
    });
  }

  dockPanel.addEventListener('pointermove', onPointerMove);
  dockPanel.addEventListener('pointerleave', resetDock);
  dockPanel.addEventListener('touchend', () => setTimeout(resetDock, 150));
  dockPanel.addEventListener('touchcancel', resetDock);
}

// ==========================================
// 10. AUTHENTICATION (LOGIN, REGISTER, ROLES)
// ==========================================

function openLoginModal(initialTab = 'LOGIN') {
  switchAuthTab(initialTab);
  openModal('loginModal');
}

function switchAuthTab(tabName) {
  const btnLogin = document.getElementById('tabBtnLogin');
  const btnRegister = document.getElementById('tabBtnRegister');
  const panelLogin = document.getElementById('authPanelLogin');
  const panelRegister = document.getElementById('authPanelRegister');

  if (!btnLogin || !btnRegister) return;

  if (tabName === 'LOGIN') {
    btnLogin.classList.add('active');
    btnRegister.classList.remove('active');
    if (panelLogin) panelLogin.style.display = 'block';
    if (panelRegister) panelRegister.style.display = 'none';
  } else {
    btnRegister.classList.add('active');
    btnLogin.classList.remove('active');
    if (panelRegister) panelRegister.style.display = 'block';
    if (panelLogin) panelLogin.style.display = 'none';
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = isPass ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  }
}

function updateRegDeviceHint() {
  const category = document.getElementById('regCategory').value;
  const notice = document.getElementById('regDeviceNoticeText');
  if (!notice) return;
  if (category === 'PENGAJAR') {
    notice.innerHTML = 'Unit Guru akan otomatis memicu <strong>Mesin A (Prefix A_)</strong> untuk rekam sidik jari.';
  } else {
    notice.innerHTML = 'Unit Pengelola akan otomatis memicu <strong>Mesin B (Prefix B_)</strong> untuk rekam sidik jari.';
  }
}

function quickFillLogin(nik, password) {
  const nikInput = document.getElementById('loginNik');
  const passInput = document.getElementById('loginPassword');
  if (nikInput) nikInput.value = nik;
  if (passInput) passInput.value = password;
  executeLogin(nik, password);
}

function initAuthLockScreen() {
  const user = getCurrentUser();
  const gate = document.getElementById('authGateScreen');
  const appContainer = document.querySelector('.app-container');
  const dock = document.getElementById('mobileDockWrapper');

  if (!user) {
    if (gate) {
      gate.classList.remove('unlocked');
      gate.style.display = 'flex';
    }
    if (appContainer) appContainer.style.display = 'none';
    if (dock) dock.style.display = 'none';
  } else {
    if (gate) {
      gate.classList.add('unlocked');
      gate.style.display = 'none';
    }
    if (appContainer) appContainer.style.display = 'flex';
    if (dock) dock.style.display = '';
  }
}

function switchGateAuthTab(tabName) {
  const btnLogin = document.getElementById('gateTabBtnLogin');
  const btnRegister = document.getElementById('gateTabBtnRegister');
  const panelLogin = document.getElementById('gatePanelLogin');
  const panelRegister = document.getElementById('gatePanelRegister');

  if (!btnLogin || !btnRegister) return;

  if (tabName === 'LOGIN') {
    btnLogin.classList.add('active');
    btnRegister.classList.remove('active');
    if (panelLogin) panelLogin.style.display = 'block';
    if (panelRegister) panelRegister.style.display = 'none';
  } else {
    btnRegister.classList.add('active');
    btnLogin.classList.remove('active');
    if (panelRegister) panelRegister.style.display = 'block';
    if (panelLogin) panelLogin.style.display = 'none';
  }
}

function updateGateRegDeviceHint() {
  const category = document.getElementById('gateRegCategory').value;
  const notice = document.getElementById('gateRegDeviceNoticeText');
  if (!notice) return;
  if (category === 'PENGAJAR') {
    notice.innerHTML = 'Unit Guru otomatis memicu <strong>Mesin A (Prefix A_)</strong> untuk rekam sidik jari.';
  } else {
    notice.innerHTML = 'Unit Pengelola otomatis memicu <strong>Mesin B (Prefix B_)</strong> untuk rekam sidik jari.';
  }
}

function quickFillGateLogin(nik, password) {
  const nikInput = document.getElementById('gateLoginNik');
  const passInput = document.getElementById('gateLoginPassword');
  if (nikInput) nikInput.value = nik;
  if (passInput) passInput.value = password;
  executeLogin(nik, password);
}

function handleGateLoginSubmit(e) {
  if (e) e.preventDefault();
  const nik = document.getElementById('gateLoginNik').value.trim();
  const password = document.getElementById('gateLoginPassword').value;
  executeLogin(nik, password);
}

function handleGateRegisterSubmit(e) {
  if (e) e.preventDefault();
  const nik = document.getElementById('gateRegNik').value.trim();
  const name = document.getElementById('gateRegName').value.trim();
  const category = document.getElementById('gateRegCategory').value;
  const sensor = document.getElementById('gateRegSensor').value;
  const pass = document.getElementById('gateRegPassword').value;
  const confirmPass = document.getElementById('gateRegConfirmPassword').value;

  if (!nik || !name || !pass) {
    showToast("Silakan lengkapi seluruh kolom formulir!", "warning");
    return;
  }

  if (pass.length < 6) {
    showToast("Password minimal 6 karakter!", "warning");
    return;
  }
  if (pass !== confirmPass) {
    showToast("Konfirmasi password tidak cocok!", "error");
    return;
  }

  const device = (category === 'PENGAJAR') ? 'A' : 'B';
  const roleLabel = (category === 'PENGAJAR') ? 'Guru Pengajar' : 'Pengelola Sekolah';
  const newId = getSuggestedNextId(device);

  const newUser = {
    nik: nik,
    password: pass,
    name: name,
    role: (category === 'PENGAJAR') ? 'GURU' : 'PENGELOLA',
    roleLabel: roleLabel,
    category: category,
    teacherId: newId,
    photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${category === 'PENGURUS' ? '4f46e5' : '059669'}&color=fff&size=150&bold=true`
  };

  saveRegisteredUser(newUser);

  // Buka kunci layar
  const gate = document.getElementById('authGateScreen');
  const appContainer = document.querySelector('.app-container');
  const dock = document.getElementById('mobileDockWrapper');
  if (gate) {
    gate.classList.add('unlocked');
    setTimeout(() => { gate.style.display = 'none'; }, 450);
  }
  if (appContainer) appContainer.style.display = 'flex';
  if (dock) dock.style.display = '';

  showToast(`Akun terdaftar! Menghubungkan ke Mesin ${device} untuk pendaftaran ${sensor}...`, "info");

  document.getElementById('teacherFormName').value = name;
  document.getElementById('teacherFormRole').value = roleLabel;
  document.getElementById('teacherFormCategory').value = category;
  document.getElementById('teacherFormSensor').value = sensor;
  document.getElementById('teacherFormDevice').value = device;
  document.getElementById('teacherFormId').value = newId;

  setCurrentUser(newUser);
  handleStartCloudEnroll();
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const nik = document.getElementById('loginNik').value.trim();
  const password = document.getElementById('loginPassword').value;
  executeLogin(nik, password);
}

function executeLogin(nik, password) {
  if (!nik || !password) {
    showToast("Silakan masukkan NIK dan kata sandi Anda!", "warning");
    return;
  }

  const res = authenticateLocalUser(nik, password);
  if (!res.success) {
    showToast(res.message, "error");
    return;
  }

  setCurrentUser(res.user);
  closeModal('loginModal');
  showToast(`Selamat datang, ${res.user.name}! (${res.user.roleLabel})`, "success");

  // Buka kunci layar gerbang (Unlock Gate Screen)
  const gate = document.getElementById('authGateScreen');
  const appContainer = document.querySelector('.app-container');
  const dock = document.getElementById('mobileDockWrapper');

  if (gate) {
    gate.classList.add('unlocked');
    setTimeout(() => {
      gate.style.display = 'none';
    }, 450);
  }
  if (appContainer) appContainer.style.display = 'flex';
  if (dock) dock.style.display = '';

  renderAllViews();
}

function handleLogout() {
  logoutCurrentUser();
  showToast("Anda telah keluar dari akun. Halaman dikunci.", "info");

  // Kunci kembali halaman penuh
  const gate = document.getElementById('authGateScreen');
  const appContainer = document.querySelector('.app-container');
  const dock = document.getElementById('mobileDockWrapper');

  if (gate) {
    gate.classList.remove('unlocked');
    gate.style.display = 'flex';
  }
  if (appContainer) appContainer.style.display = 'none';
  if (dock) dock.style.display = 'none';

  renderAllViews();
}

function handleRegisterSubmit(e) {
  if (e) e.preventDefault();
  const nik = document.getElementById('regNik').value.trim();
  const name = document.getElementById('regName').value.trim();
  const category = document.getElementById('regCategory').value;
  const sensor = document.getElementById('regSensor').value;
  const pass = document.getElementById('regPassword').value;
  const confirmPass = document.getElementById('regConfirmPassword').value;

  if (!nik || !name || !pass) {
    showToast("Silakan lengkapi seluruh kolom formulir!", "warning");
    return;
  }

  if (pass.length < 6) {
    showToast("Password minimal 6 karakter!", "warning");
    return;
  }
  if (pass !== confirmPass) {
    showToast("Konfirmasi password tidak cocok!", "error");
    return;
  }

  // Tentukan mesin dan prefix otomatis
  const device = (category === 'PENGAJAR') ? 'A' : 'B';
  const roleLabel = (category === 'PENGAJAR') ? 'Guru Pengajar' : 'Pengelola Sekolah';
  const newId = getSuggestedNextId(device);

  const newUser = {
    nik: nik,
    password: pass,
    name: name,
    role: (category === 'PENGAJAR') ? 'GURU' : 'PENGELOLA',
    roleLabel: roleLabel,
    category: category,
    teacherId: newId,
    photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${category === 'PENGURUS' ? '4f46e5' : '059669'}&color=fff&size=150&bold=true`
  };

  saveRegisteredUser(newUser);
  closeModal('loginModal');

  showToast(`Akun terdaftar! Menghubungkan ke Mesin ${device} untuk pendaftaran ${sensor}...`, "info");

  // Masukkan data ke form enrollment dan trigger mesin secara otomatis
  document.getElementById('teacherFormName').value = name;
  document.getElementById('teacherFormRole').value = roleLabel;
  document.getElementById('teacherFormCategory').value = category;
  document.getElementById('teacherFormSensor').value = sensor;
  document.getElementById('teacherFormDevice').value = device;
  document.getElementById('teacherFormId').value = newId;

  // Set currentUser ke akun baru ini
  setCurrentUser(newUser);

  // Trigger cloud enroll otomatis di mesin yang tepat (A untuk Guru, B untuk Pengelola)
  handleStartCloudEnroll();
}

function updateAuthUI() {
  const container = document.getElementById('headerAuthContainer');
  const banner = document.getElementById('userPortalBanner');
  const user = getCurrentUser();

  const addBtn = document.querySelector("button[onclick='openAddTeacherModal()']");
  const tabAddBtn = document.getElementById('btn-add-teacher-tab');
  const canManageTeachers = user && (user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH');

  if (addBtn) {
    addBtn.style.display = canManageTeachers ? 'inline-flex' : 'none';
  }
  if (tabAddBtn) {
    tabAddBtn.style.display = canManageTeachers ? 'inline-flex' : 'none';
  }

  // ==========================================
  // INFORMASI PERANGKAT: HANYA UNTUK ADMIN
  // ==========================================
  const navEsp32 = document.getElementById('nav-item-esp32');
  const mobileDockAlat = document.getElementById('mobileDockItemAlat');
  const widgetTelemetry = document.getElementById('sidebar-telemetry-widget');
  const isAdmin = user && user.role === 'ADMIN';

  if (navEsp32) {
    navEsp32.style.display = isAdmin ? 'flex' : 'none';
  }
  if (mobileDockAlat) {
    mobileDockAlat.style.display = isAdmin ? 'flex' : 'none';
  }
  if (widgetTelemetry) {
    widgetTelemetry.style.display = isAdmin ? 'block' : 'none';
  }

  // Jika bukan admin dan saat ini sedang berada di tab status-esp32, alihkan ke overview
  const currentTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
  if (!isAdmin && currentTab === 'status-esp32') {
    switchTab('overview');
  }

  if (!user) {
    // Mode Tamu / Belum Login
    if (container) {
      container.innerHTML = `
        <button class="btn btn-primary" onclick="openLoginModal('LOGIN')" id="btnHeaderLogin">
          <i class="fa-solid fa-right-to-bracket"></i> Masuk / Login
        </button>
      `;
    }
    if (banner) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div class="portal-banner-content">
          <i class="fa-solid fa-circle-info portal-banner-icon"></i>
          <div>
            <div class="portal-banner-title">Portal Presensi Terbuka (Mode Tamu)</div>
            <div class="portal-banner-sub">Silakan Masuk menggunakan NIK & Password untuk mengakses portal pribadi guru atau wewenang administrator.</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="openLoginModal('LOGIN')" style="font-size: 11.5px; padding: 6px 12px; white-space: nowrap;">
          Masuk Akun
        </button>
      `;
    }
    return;
  }

  // Pengguna Sedang Login
  let badgeClass = 'badge-role-guru';
  let badgeIcon = 'fa-chalkboard-user';
  if (user.role === 'ADMIN') {
    badgeClass = 'badge-role-admin';
    badgeIcon = 'fa-crown';
  } else if (user.role === 'KEPALA_SEKOLAH') {
    badgeClass = 'badge-role-kepsek';
    badgeIcon = 'fa-graduation-cap';
  }

  if (container) {
    container.innerHTML = `
      <div class="user-profile-capsule">
        <img src="${user.photo}" alt="${user.name}" class="user-capsule-avatar">
        <div class="user-capsule-meta">
          <div class="user-capsule-name" title="${user.name}">${user.name}</div>
          <span class="badge-role ${badgeClass}">
            <i class="fa-solid ${badgeIcon}"></i> ${user.roleLabel}
          </span>
        </div>
        <button class="btn-capsule-logout" onclick="handleLogout()" title="Keluar / Ganti Akun">
          <i class="fa-solid fa-power-off"></i>
        </button>
      </div>
    `;
  }

  if (banner) {
    banner.style.display = 'flex';
    if (user.role === 'GURU') {
      banner.innerHTML = `
        <div class="portal-banner-content">
          <i class="fa-solid fa-user-check portal-banner-icon" style="color: #34d399;"></i>
          <div>
            <div class="portal-banner-title">Portal Guru: ${user.name}</div>
            <div class="portal-banner-sub">Menampilkan jadwal mengajar sekolah serta rekapitulasi riwayat presensi khusus akun Anda.</div>
          </div>
        </div>
        <span class="badge badge-on-time" style="white-space: nowrap;"><i class="fa-solid fa-lock"></i> Rekap Privat Aktif</span>
      `;
    } else if (user.role === 'ADMIN') {
      banner.innerHTML = `
        <div class="portal-banner-content">
          <i class="fa-solid fa-shield-halved portal-banner-icon" style="color: #818cf8;"></i>
          <div>
            <div class="portal-banner-title">Administrator Sistem: ${user.name}</div>
            <div class="portal-banner-sub">Akses Tak Terbatas: Anda dapat menambah guru, mengubah data, memicu sensor Alat Absen, dan mengunduh seluruh rekap.</div>
          </div>
        </div>
        <span class="badge badge-device-pengajar" style="white-space: nowrap;"><i class="fa-solid fa-key"></i> Full Access</span>
      `;
    } else if (user.role === 'KEPALA_SEKOLAH') {
      banner.innerHTML = `
        <div class="portal-banner-content">
          <i class="fa-solid fa-graduation-cap portal-banner-icon" style="color: #c084fc;"></i>
          <div>
            <div class="portal-banner-title">Kepala Sekolah: ${user.name}</div>
            <div class="portal-banner-sub">Akses Monitoring Lengkap: Memantau seluruh rekap kehadiran guru, jadwal kelas, dan laporan presensi sekolah.</div>
          </div>
        </div>
        <span class="badge badge-device-pengurus" style="white-space: nowrap;"><i class="fa-solid fa-star"></i> Pimpinan</span>
      `;
    }
  }
}


