/**
 * BACKEND GOOGLE APPS SCRIPT: SISTEM PRESENSI & CLOUD COMMAND RELAY
 * Spreadsheet ID: 1yYgUqCSTyE6f4AWcKM_6aR9zFL6TzDpzZh7LLf7wR58
 * 
 * Mendukung:
 * 1. Absensi Tap In & Confirm Out dari Mesin ESP32
 * 2. CRUD Guru (Tambah, Edit Nama/Jabatan, Hapus) dari Web Dashboard
 * 3. Antrean Perintah Cloud Pendaftaran Sidik Jari & RFID Jarak Jauh (Cloud Relay)
 * 4. Multi-Perangkat dengan Unique ID Prefix (A_1, B_1, dst.)
 */

function doGet(e) {
  var p = e.parameter || {};
  var action = p.action;
  var type = p.type;
  var id = p.id;
  var callback = p.callback;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dbSheet = ss.getSheetByName("Database Guru");
  var cmdSheet = ss.getSheetByName("Device_Commands");

  // Inisialisasi Sheet Database Guru jika belum ada
  if (!dbSheet) {
    dbSheet = ss.insertSheet("Database Guru");
    dbSheet.appendRow(["ID (Kartu/Jari)", "Tipe (RFID/FINGER)", "Nama Guru", "Jabatan"]);
  }

  // Inisialisasi Sheet Antrean Perintah Mesin jika belum ada
  if (!cmdSheet) {
    cmdSheet = ss.insertSheet("Device_Commands");
    cmdSheet.appendRow(["CommandID", "Device", "Command", "TargetName", "TargetRole", "TargetType", "Status", "ResultID", "Timestamp"]);
  }

  // Dapatkan Tanggal & Waktu saat ini (WIB GMT+7)
  var date = new Date();
  var dateString = Utilities.formatDate(date, "GMT+7", "dd-MM-yyyy");
  var timeString = Utilities.formatDate(date, "GMT+7", "HH:mm:ss");

  // Format Nama Sheet untuk Log Hari Ini
  var logSheetName = "Log_" + dateString;
  var logSheet = ss.getSheetByName(logSheetName);
  if (!logSheet) {
    logSheet = ss.insertSheet(logSheetName);
    logSheet.appendRow(["Tanggal", "ID", "Nama Guru", "Jabatan", "Tipe", "Waktu Masuk", "Waktu Keluar", "Status"]);
  }

  // Helper kirim JSON / JSONP
  function respondJson(obj) {
    var jsonStr = JSON.stringify(obj);
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + jsonStr + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(jsonStr)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // =========================================================================
  // 1. API UNTUK DASHBOARD WEB: MENGAMBIL DATA GURU (GET USERS)
  // =========================================================================
  if (action === "getUsers") {
    var dataGuruAll = dbSheet.getDataRange().getValues();
    var users = [];
    for (var j = 1; j < dataGuruAll.length; j++) {
      if (dataGuruAll[j][0] && dataGuruAll[j][2]) {
        users.push({
          id: String(dataGuruAll[j][0]),
          type: String(dataGuruAll[j][1] || "FINGER"),
          name: String(dataGuruAll[j][2]),
          role: String(dataGuruAll[j][3] || "Guru Mapel")
        });
      }
    }
    return respondJson({ success: true, users: users });
  }

  // =========================================================================
  // 1.B API UNTUK DASHBOARD WEB: MENGAMBIL DAFTAR SELURUH LOG SHEET (GET ALL LOG SHEETS)
  // =========================================================================
  if (action === "getAllLogSheets") {
    var allSheets = ss.getSheets();
    var logNames = [];
    for (var s = 0; s < allSheets.length; s++) {
      var sName = allSheets[s].getName();
      if (sName.indexOf("Log_") === 0) {
        logNames.push(sName);
      }
    }
    return respondJson({ success: true, sheets: logNames });
  }

  // =========================================================================
  // 2. API UNTUK DASHBOARD WEB: TAMBAH GURU BARU (ADD TEACHER)
  // =========================================================================
  if (action === "addTeacher") {
    var newId = String(p.id || "").trim();
    var newName = String(p.name || "").trim();
    var newRole = String(p.role || "Guru Mapel").trim();
    var newType = String(p.type || "FINGER").toUpperCase().trim();

    if (!newId || !newName) {
      return respondJson({ success: false, message: "ID dan Nama Guru wajib diisi!" });
    }

    var data = dbSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === newId.toUpperCase()) {
        return respondJson({ success: false, message: "ID " + newId + " sudah digunakan oleh " + data[i][2] + "!" });
      }
    }

    dbSheet.appendRow([newId, newType, newName, newRole]);
    return respondJson({ success: true, message: "Guru " + newName + " (" + newId + ") berhasil ditambahkan!" });
  }

  // =========================================================================
  // 3. API UNTUK DASHBOARD WEB: UPDATE GURU (UPDATE TEACHER)
  // =========================================================================
  if (action === "updateTeacher") {
    var targetId = String(p.id || "").trim();
    var updatedName = String(p.name || "").trim();
    var updatedRole = String(p.role || "").trim();
    var updatedType = p.type ? String(p.type).toUpperCase().trim() : "";

    if (!targetId || !updatedName) {
      return respondJson({ success: false, message: "ID dan Nama Guru wajib disertakan!" });
    }

    var data = dbSheet.getDataRange().getValues();
    var rowFound = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === targetId.toUpperCase()) {
        rowFound = i + 1;
        break;
      }
    }

    if (rowFound === -1) {
      return respondJson({ success: false, message: "ID Guru " + targetId + " tidak ditemukan di database!" });
    }

    if (updatedType) dbSheet.getRange(rowFound, 2).setValue(updatedType);
    if (updatedName) dbSheet.getRange(rowFound, 3).setValue(updatedName);
    if (updatedRole) dbSheet.getRange(rowFound, 4).setValue(updatedRole);

    return respondJson({ success: true, message: "Data " + updatedName + " berhasil diperbarui!" });
  }

  // =========================================================================
  // 4. API UNTUK DASHBOARD WEB: HAPUS GURU (DELETE TEACHER)
  // =========================================================================
  if (action === "deleteTeacher") {
    var deleteId = String(p.id || "").trim();
    if (!deleteId) {
      return respondJson({ success: false, message: "ID Guru yang akan dihapus belum ditentukan!" });
    }

    var data = dbSheet.getDataRange().getValues();
    var rowFound = -1;
    var teacherName = "";
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === deleteId.toUpperCase()) {
        rowFound = i + 1;
        teacherName = data[i][2];
        break;
      }
    }

    if (rowFound === -1) {
      return respondJson({ success: false, message: "ID Guru " + deleteId + " tidak ditemukan!" });
    }

    dbSheet.deleteRow(rowFound);
    return respondJson({ success: true, message: "Guru " + teacherName + " (" + deleteId + ") berhasil dihapus!" });
  }

  // =========================================================================
  // 5. CLOUD RELAY: WEB MENGIRIM PERINTAH PENDAFTARAN KE ANTREAN (QUEUE ENROLL)
  // =========================================================================
  if (action === "queueEnroll") {
    var device = String(p.device || "A").toUpperCase().trim();
    var cmd = String(p.command || "ENROLL_FINGER").toUpperCase().trim();
    var tName = String(p.name || "").trim();
    var tRole = String(p.role || "Guru Mapel").trim();
    var tType = String(p.type || "FINGER").toUpperCase().trim();
    var cmdId = "CMD_" + date.getTime() + "_" + Math.floor(Math.random() * 1000);

    if (!tName) {
      return respondJson({ success: false, message: "Nama Guru wajib diisi untuk pendaftaran!" });
    }

    // Bersihkan perintah lama yang masih PENDING untuk device yang sama
    var cmdData = cmdSheet.getDataRange().getValues();
    for (var i = 1; i < cmdData.length; i++) {
      if (String(cmdData[i][1]).toUpperCase() === device && String(cmdData[i][6]) === "PENDING") {
        cmdSheet.getRange(i + 1, 7).setValue("CANCELLED");
      }
    }

    cmdSheet.appendRow([cmdId, device, cmd, tName, tRole, tType, "PENDING", "-", dateString + " " + timeString]);
    return respondJson({
      success: true,
      commandId: cmdId,
      device: device,
      message: "Perintah pendaftaran dikirim ke Mesin " + device + ". Menunggu scan pada alat!"
    });
  }

  // =========================================================================
  // 6. CLOUD RELAY: WEB MENGECEK STATUS PENDAFTARAN (CHECK ENROLL STATUS)
  // =========================================================================
  if (action === "checkEnrollStatus") {
    var checkCmdId = String(p.commandId || "").trim();
    var cmdData = cmdSheet.getDataRange().getValues();
    for (var i = cmdData.length - 1; i >= 1; i--) {
      if (String(cmdData[i][0]) === checkCmdId) {
        return respondJson({
          success: true,
          commandId: checkCmdId,
          device: cmdData[i][1],
          command: cmdData[i][2],
          name: cmdData[i][3],
          role: cmdData[i][4],
          status: cmdData[i][6],
          resultId: cmdData[i][7]
        });
      }
    }
    return respondJson({ success: false, status: "NOT_FOUND", message: "Perintah tidak ditemukan!" });
  }

  // =========================================================================
  // 7. CLOUD RELAY: ESP32 MENGECEK APAKAH ADA PERINTAH BARU (GET COMMAND)
  // =========================================================================
  if (action === "getCommand") {
    var espDevice = String(p.device || "A").toUpperCase().trim();
    var cmdData = cmdSheet.getDataRange().getValues();

    for (var i = cmdData.length - 1; i >= 1; i--) {
      if (String(cmdData[i][1]).toUpperCase() === espDevice && String(cmdData[i][6]) === "PENDING") {
        // Tandai sedang diproses oleh mesin
        cmdSheet.getRange(i + 1, 7).setValue("PROCESSING");
        var cId = cmdData[i][0];
        var cType = cmdData[i][2]; // ENROLL_FINGER / ENROLL_RFID
        var cName = cmdData[i][3];
        var cRole = cmdData[i][4];
        var cSensor = cmdData[i][5];

        // Format balasan ke ESP: CMD|TIPE|NAMA|ROLE|SENSOR|COMMAND_ID
        return ContentService.createTextOutput("CMD|" + cType + "|" + cName + "|" + cRole + "|" + cSensor + "|" + cId);
      }
    }
    return ContentService.createTextOutput("NONE");
  }

  // =========================================================================
  // 8. CLOUD RELAY: ESP32 MELAPORKAN PENDAFTARAN SELESAI (COMPLETE ENROLL)
  // =========================================================================
  if (action === "completeEnroll") {
    var enrollCmdId = String(p.commandId || "").trim();
    var assignedId = String(p.id || "").trim(); // Contoh: A_1, B_2
    var enrolledName = String(p.name || "").trim();
    var enrolledRole = String(p.role || "Guru Mapel").trim();
    var enrolledType = String(p.type || "FINGER").toUpperCase().trim();

    if (!assignedId || !enrolledName) {
      return ContentService.createTextOutput("ERR|DATA TIDAK LENGKAP|Gagal Daftarkan");
    }

    // Perbarui status antrean
    if (enrollCmdId) {
      var cmdData = cmdSheet.getDataRange().getValues();
      for (var i = cmdData.length - 1; i >= 1; i--) {
        if (String(cmdData[i][0]) === enrollCmdId) {
          cmdSheet.getRange(i + 1, 7).setValue("COMPLETED");
          cmdSheet.getRange(i + 1, 8).setValue(assignedId);
          break;
        }
      }
    }

    // Masukkan ke sheet Database Guru (atau perbarui jika ID sudah ada)
    var dbData = dbSheet.getDataRange().getValues();
    var existingRow = -1;
    for (var k = 1; k < dbData.length; k++) {
      if (String(dbData[k][0]).toUpperCase() === assignedId.toUpperCase()) {
        existingRow = k + 1;
        break;
      }
    }

    if (existingRow === -1) {
      dbSheet.appendRow([assignedId, enrolledType, enrolledName, enrolledRole]);
    } else {
      dbSheet.getRange(existingRow, 2).setValue(enrolledType);
      dbSheet.getRange(existingRow, 3).setValue(enrolledName);
      dbSheet.getRange(existingRow, 4).setValue(enrolledRole);
    }

    return ContentService.createTextOutput("OK|PENDAFTARAN SUKSES|" + assignedId);
  }

  // =========================================================================
  // 9. LOGIKA ABSENSI STANDAR DARI MESIN ESP32 (TAP & CONFIRM_OUT)
  // =========================================================================
  if (!type || !id || (!action && !p.action)) {
    action = "TAP";
  }

  var dataGuru = dbSheet.getDataRange().getValues();
  var namaGuru = "";
  var jabatanGuru = "";

  for (var i = 1; i < dataGuru.length; i++) {
    if (String(dataGuru[i][0]).toUpperCase() === String(id).toUpperCase()) {
      namaGuru = dataGuru[i][2];
      jabatanGuru = dataGuru[i][3];
      break;
    }
  }

  if (namaGuru === "") {
    return ContentService.createTextOutput("ERR|BELUM TERDAFTAR|Silakan ke Web");
  }

  var logData = logSheet.getDataRange().getDisplayValues();
  var rowIndex = -1;
  var currentStatus = "";

  for (var i = logData.length - 1; i >= 1; i--) {
    if (logData[i][0] === dateString && String(logData[i][1]).toUpperCase() === String(id).toUpperCase()) {
      rowIndex = i + 1;
      currentStatus = logData[i][7];
      break;
    }
  }

  if (action === "TAP") {
    if (rowIndex === -1) {
      // TAP IN (Masuk)
      logSheet.appendRow([dateString, id, namaGuru, jabatanGuru, type, timeString, "-", "TAP IN"]);
      return ContentService.createTextOutput("OK|TAP IN BERHASIL|" + namaGuru);
    } else {
      if (currentStatus === "TAP IN") {
        return ContentService.createTextOutput("CONFIRM|KONFIRMASI P'LANG|TAP SEKALI LAGI!");
      } else if (currentStatus === "TAP OUT") {
        return ContentService.createTextOutput("ERR|SUDAH PULANG|" + namaGuru);
      }
    }
  } else if (action === "CONFIRM_OUT") {
    if (rowIndex !== -1 && currentStatus === "TAP IN") {
      logSheet.getRange(rowIndex, 7).setValue(timeString);
      logSheet.getRange(rowIndex, 8).setValue("TAP OUT");
      return ContentService.createTextOutput("OK|TAP OUT BERHASIL|" + namaGuru);
    } else {
      return ContentService.createTextOutput("ERR|GAGAL TAP OUT|Status Tidak Valid");
    }
  }

  return ContentService.createTextOutput("ERR|AKSI DITOLAK|Tdk Diketahui");
}

// =========================================================================
// 10. FUNGSI OTOMATIS: RAPIKAN LOG FORMAT LAMA (24 AGUSTUS KE BELAKANG)
// =========================================================================
/**
 * Jalankan fungsi ini sekali saja di Google Apps Script untuk otomatis 
 * mengonversi seluruh tab log lama menjadi format modern:
 * [Tanggal, ID, Nama Guru, Jabatan, Tipe, Waktu Masuk, Waktu Keluar, Status]
 */
function konversiSemuaLogKeFormatBaru() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var convertedCount = 0;
  var skippedCount = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();

    // Hanya periksa tab dengan awalan "Log_"
    if (sheetName.indexOf("Log_") !== 0) continue;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 2) continue;

    // Ambil daftar header
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return String(h).toLowerCase().trim();
    });

    // Cek apakah sudah memakai format baru (punya kolom waktu masuk & keluar)
    var hasWaktuMasuk = headers.some(function(h) { return h.indexOf("masuk") !== -1 && h.indexOf("tipe") === -1; });
    var hasWaktuKeluar = headers.some(function(h) { return h.indexOf("keluar") !== -1; });

    if (hasWaktuMasuk && hasWaktuKeluar) {
      Logger.log("Dilewati (sudah format baru): " + sheetName);
      skippedCount++;
      continue;
    }

    // Pemetaan indeks kolom format lama
    var colTanggal = -1, colWaktu = -1, colTipeAbsen = -1, colNama = -1;
    var colJabatan = -1, colStatus = -1, colMetode = -1, colId = -1;

    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      if (h.indexOf("tanggal") !== -1) colTanggal = c;
      else if (h.indexOf("waktu") !== -1 || h.indexOf("jam") !== -1) colWaktu = c;
      else if (h.indexOf("tipe absen") !== -1) colTipeAbsen = c;
      else if (h.indexOf("nama") !== -1) colNama = c;
      else if (h.indexOf("jabatan") !== -1) colJabatan = c;
      else if (h.indexOf("status") !== -1) colStatus = c;
      else if (h.indexOf("metode") !== -1 || (h.indexOf("tipe") !== -1 && h.indexOf("absen") === -1)) colMetode = c;
      else if (h === "id" || h === "# id" || h.indexOf("(kartu/jari)") !== -1) colId = c;
    }

    // Fallback indeks default bila header tidak terdeteksi
    if (colTanggal === -1) colTanggal = 0;
    if (colWaktu === -1) colWaktu = 1;
    if (colTipeAbsen === -1) colTipeAbsen = 2;
    if (colNama === -1) colNama = 3;
    if (colJabatan === -1) colJabatan = 4;
    if (colStatus === -1) colStatus = 5;
    if (colMetode === -1) colMetode = 7;
    if (colId === -1) colId = 8;

    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var teacherMap = {};
    var orderKeys = [];

    for (var r = 0; r < allData.length; r++) {
      var row = allData[r];
      var tgl = String(row[colTanggal] || "").trim();
      var waktu = String(row[colWaktu] || "").trim();
      var tipeAbsen = String(row[colTipeAbsen] || "").toUpperCase().trim();
      var nama = String(row[colNama] || "").trim();
      var jabatan = String(row[colJabatan] || "").trim();
      var metode = String(row[colMetode] || "FINGER").trim();
      var id = String(row[colId] || "").trim();

      // Abaikan baris kosong atau baris judul berulang
      if (!nama && !id) continue;
      if (nama.toLowerCase().indexOf("nama guru") !== -1) continue;

      if (!tgl) {
        tgl = sheetName.replace("Log_", "");
      }

      var key = id ? String(id).toUpperCase() : nama.toLowerCase();

      if (!teacherMap[key]) {
        teacherMap[key] = {
          tanggal: tgl,
          id: id,
          nama: nama,
          jabatan: jabatan,
          tipe: metode || "FINGER",
          waktuMasuk: "-",
          waktuKeluar: "-",
          status: "DI SEKOLAH"
        };
        orderKeys.push(key);
      }

      var item = teacherMap[key];
      if (jabatan && !item.jabatan) item.jabatan = jabatan;
      if (id && !item.id) item.id = id;
      if (nama && !item.nama) item.nama = nama;

      if (tipeAbsen === "MASUK") {
        item.waktuMasuk = waktu;
      } else if (tipeAbsen === "PULANG" || tipeAbsen === "KELUAR") {
        item.waktuKeluar = waktu;
      } else {
        if (item.waktuMasuk === "-") {
          item.waktuMasuk = waktu;
        } else if (item.waktuKeluar === "-") {
          item.waktuKeluar = waktu;
        }
      }

      if (item.waktuKeluar !== "-") {
        item.status = "TAP OUT";
      } else if (item.waktuMasuk !== "-") {
        item.status = "TAP IN";
      }
    }

    // Bangun baris data baru format terpadu
    var newRows = [];
    for (var k = 0; k < orderKeys.length; k++) {
      var entry = teacherMap[orderKeys[k]];
      newRows.push([
        entry.tanggal,
        entry.id,
        entry.nama,
        entry.jabatan,
        entry.tipe,
        entry.waktuMasuk,
        entry.waktuKeluar,
        entry.status
      ]);
    }

    // Format ulang sheet
    sheet.clear();
    var newHeader = ["Tanggal", "ID", "Nama Guru", "Jabatan", "Tipe", "Waktu Masuk", "Waktu Keluar", "Status"];
    sheet.appendRow(newHeader);

    // Styling Header
    var headerRange = sheet.getRange(1, 1, 1, 8);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#d1fae5");
    headerRange.setFontColor("#004532");

    if (newRows.length > 0) {
      sheet.getRange(2, 1, newRows.length, 8).setValues(newRows);
      for (var col = 1; col <= 8; col++) {
        sheet.autoResizeColumn(col);
      }
    }

    Logger.log("Berhasil merapikan tab: " + sheetName + " (" + newRows.length + " guru)");
    convertedCount++;
  }

  var msg = "Selesai! " + convertedCount + " tab log berhasil dirapikan ke format baru. (" + skippedCount + " tab sudah format baru dan dilewati).";
  Logger.log(msg);
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Konversi Berhasil", 8);
}
