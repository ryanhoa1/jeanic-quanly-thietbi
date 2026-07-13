// ===========================================================================
// NHẬP TỪ GLPI — đọc file Excel xuất ra từ GLPI nội bộ (Computers, Monitors,
// Peripherals, Printers, Network...), tự nhận diện loại tài sản, tự dò người
// đang giữ theo email (hoặc theo tên máy khi không có email), rồi cho xem
// trước / chỉnh sửa trước khi ghi vào hệ thống — không cần nhập tay từng dòng.
//
// Cách dùng trong GLPI: Assets > Computers/Monitors/... > chọn hết > "Export"
// > "Export to file (CSV/XLSX)". Chọn thêm các cột: Name, Status, Manufacturer,
// Serial number, Type, Model, Operating System - Name, Components - Processor,
// Location, Alternate username (nếu có) — rồi tải file .xlsx đó lên đây.
// ===========================================================================
import {
  state, DEVICE_TYPES, CATEGORY_FIELDS, getCategoryId,
  addDeviceRecord, updateDeviceRecord, persistDevices, persistMeta
} from './db.js';
import { esc, todayISO, pad3 } from './helpers.js';
import { toast, openModal, closeModal } from './ui.js';
import { currentUser } from './auth.js';

function ensureXLSX() {
  if (!window.XLSX) { toast("Không thể thao tác với Excel (thiếu thư viện XLSX)", "err"); return false; }
  return true;
}

function normalizeVN(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// 1) Nhận diện loại tài sản GLPI (Computers / Monitors-Peripherals / khác)
//    dựa trên các cột có trong file, để chọn loại thiết bị mặc định hợp lý
//    khi không dò được cụ thể hơn.
// ---------------------------------------------------------------------------
function detectExportKind(headers) {
  const h = headers.map(x => String(x || "").toLowerCase().trim());
  if (h.includes("components - processor") || h.includes("operating system - name")) return "computers";
  if (h.includes("type") || h.includes("alternate username")) return "monitors_or_peripherals";
  return "unknown";
}

// Giá trị cột "Type" trong GLPI (tiếng Anh hoặc tiếng Việt tuỳ cấu hình) -> loại thiết bị nội bộ
const GLPI_TYPE_MAP = {
  "desktop": "Desktop", "máy tính để bàn": "Desktop", "may tinh de ban": "Desktop",
  "mini pc": "Desktop", "all-in-one": "Desktop", "aio": "Desktop",
  "notebook": "Laptop", "laptop": "Laptop", "máy tính xách tay": "Laptop",
  "monitor": "Màn hình", "screen": "Màn hình", "màn hình": "Màn hình",
  "printer": "Máy in", "máy in": "Máy in",
  "network equipment": "Router/Switch", "networking": "Router/Switch",
  "router": "Router/Switch", "switch": "Router/Switch", "access point": "Router/Switch",
  "phone": "Điện thoại", "smartphone": "Điện thoại", "điện thoại": "Điện thoại",
  "keyboard": "Bàn phím", "bàn phím": "Bàn phím",
  "mouse": "Chuột không dây", "chuột": "Chuột không dây",
  "headset": "Tai nghe", "headphone": "Tai nghe", "tai nghe": "Tai nghe",
  "speaker": "Loa", "loa": "Loa",
  "webcam": "Webcam",
  "camera": "Camera", "cctv": "Camera"
};

// Dò theo từ khoá trong Type/Name/Model khi không khớp bảng trên (áp dụng cho
// các export Peripherals dùng chung 1 sheet cho nhiều loại phụ kiện khác nhau).
const KEYWORD_TYPE_RULES = [
  [/wireless.*(mouse|chuột)|chuột.*không dây/i, "Chuột không dây"],
  [/\b(usb\s*mouse|wired mouse)\b|chuột.*có dây/i, "Chuột có dây"],
  [/bàn phím|keyboard/i, "Bàn phím"],
  [/combo.*(bàn phím|keyboard).*(chuột|mouse)/i, "Combo Bàn phím + Chuột"],
  [/chuột|mouse/i, "Chuột không dây"],
  [/tai nghe|headset|headphone/i, "Tai nghe"],
  [/loa|speaker/i, "Loa"],
  [/webcam/i, "Webcam"],
  [/camera|cctv/i, "Camera"],
  [/màn hình|monitor|màn hinh/i, "Màn hình"],
  [/máy in|printer/i, "Máy in"],
  [/router|switch|access point|wifi|wi-fi/i, "Router/Switch"],
  [/laptop|notebook/i, "Laptop"],
  [/mini pc|optiplex|expertcenter|\bnuc\b|all-in-one/i, "Desktop"],
  // Điện thoại bàn/IP Phone: GLPI thường để trống cột Type cho nhóm này, nên
  // phải nhận diện qua tên hãng sản xuất phổ biến ghi trong Name/Model.
  [/điện thoại|smartphone|\biphone\b|ip\s*phone|desk\s*phone|voip|sip[-\s]?t\d|grandstream|yealink|\bcisco\b|panasonic|polycom|fanvil|\bavaya\b/i, "Điện thoại"]
];

// Khi GLPI để trống cột Manufacturer (thường gặp với điện thoại bàn/IP Phone
// nhập thủ công), thử dò thương hiệu qua từ khoá xuất hiện trong Name/Model
// trước khi đành chấp nhận "Khác".
const BRAND_KEYWORDS = [
  ["dell", "Dell"], ["hp", "HP"], ["lenovo", "Lenovo"], ["asus", "Asus"], ["acer", "Acer"],
  ["apple", "Apple"], ["logitech", "Logitech"], ["samsung", "Samsung"], ["lg", "LG"],
  ["canon", "Canon"], ["tp-link", "TP-Link"], ["tplink", "TP-Link"], ["hikvision", "HIKVision"],
  ["kingston", "Kingston"], ["xiaomi", "Xiaomi"],
  ["grandstream", "Grandstream"], ["yealink", "Yealink"], ["cisco", "Cisco"],
  ["panasonic", "Panasonic"], ["polycom", "Polycom"], ["fanvil", "Fanvil"], ["avaya", "Avaya"]
];

function inferBrand(manufacturer, name, model) {
  if (manufacturer) return manufacturer;
  const text = normalizeVN(`${name || ""} ${model || ""}`);
  for (const [kw, label] of BRAND_KEYWORDS) {
    if (text.includes(kw)) return label;
  }
  return "Khác";
}

function mapGlpiType(rawType, kind, extraText) {
  const t = String(rawType || "").trim().toLowerCase();
  if (t && GLPI_TYPE_MAP[t]) return GLPI_TYPE_MAP[t];
  const text = `${rawType || ""} ${extraText || ""}`;
  for (const [re, type] of KEYWORD_TYPE_RULES) {
    if (re.test(text)) return type;
  }
  // "computers" là export riêng cho máy tính nên mặc định Desktop là hợp lý
  // khi bỏ trống Type. Nhưng "monitors_or_peripherals" gộp chung rất nhiều
  // loại phụ kiện khác nhau (màn hình, điện thoại, bàn phím, chuột...), nên
  // KHÔNG được đoán bừa thành "Màn hình" — trước đây điều này khiến điện
  // thoại bàn (Type để trống) bị gán nhầm thành Màn hình và biến mất khỏi
  // mục Điện thoại. Khi không dò được, để "Khác" để người dùng còn thấy và
  // tự sửa lại loại cho đúng trong bảng xem trước hoặc sau khi nhập.
  if (kind === "computers") return "Desktop";
  return "Khác";
}

// ---------------------------------------------------------------------------
// 2) Dò người đang giữ thiết bị: ưu tiên khớp email tuyệt đối (cột "Alternate
//    username" khi máy trạm/thiết bị đã đăng nhập domain), sau đó mới dò theo
//    tên máy (hostname) khi không có email hợp lệ.
// ---------------------------------------------------------------------------
function isLikelyEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function matchHolderByEmail(raw) {
  const s = String(raw || "").trim();
  if (!isLikelyEmail(s)) return null;
  return state.employees.find(e => e.email && e.email.toLowerCase() === s.toLowerCase()) || null;
}

// hostname kiểu "JGS-VIENHR", "Tuan-JGS", "JGS-THUYACC" -> dò theo phần đầu
// email (trước dấu chấm/@) của nhân viên, ví dụ "vien.do@..." -> "vien".
function matchHolderByHostname(hostname) {
  const h = normalizeVN(String(hostname || "")).replace(/[^a-z0-9]/g, "");
  if (!h) return null;
  let best = null, bestLen = 0;
  state.employees.forEach(e => {
    if (!e.email) return;
    const firstFrag = normalizeVN(e.email.split("@")[0].split(".")[0]).replace(/[^a-z0-9]/g, "");
    if (firstFrag.length >= 3 && h.includes(firstFrag) && firstFrag.length > bestLen) {
      best = e; bestLen = firstFrag.length;
    }
  });
  return best;
}

function resolveHolder(row, kind) {
  const altUser = row["Alternate username"];
  const name = (row["Name"] || "").toString().trim();

  if (altUser) {
    const direct = matchHolderByEmail(altUser);
    if (direct) return { holder: direct, method: "email" };
    // Định dạng agent kiểu "user@HOSTNAME" (không phải email thật)
    const s = String(altUser).trim();
    const userPart = s.split("@")[0];
    const byUserPart = matchHolderByHostname(userPart);
    if (byUserPart) return { holder: byUserPart, method: "hostname" };
  }
  if (kind === "computers" && name) {
    const byName = matchHolderByHostname(name);
    if (byName) return { holder: byName, method: "hostname" };
  }
  return { holder: null, method: null };
}

// ---------------------------------------------------------------------------
// 3) Đọc + xây báo cáo xem trước (chưa ghi vào state)
// ---------------------------------------------------------------------------
function nextAvailableDeviceId(usedIds) {
  while (usedIds.has("TB" + pad3(state.meta.deviceSeq))) state.meta.deviceSeq += 1;
  const id = "TB" + pad3(state.meta.deviceSeq);
  state.meta.deviceSeq += 1;
  usedIds.add(id);
  return id;
}

function buildGlpiImportReport(rawRows, headers) {
  const kind = detectExportKind(headers);

  const existingBySerial = new Map();
  const existingByGlpiName = new Map();
  state.devices.forEach(d => {
    if (d.attrs && d.attrs.serial) existingBySerial.set(String(d.attrs.serial).trim().toUpperCase(), d);
    const m = /\[GLPI:([^\]]+)\]/.exec(d.note || "");
    if (m) existingByGlpiName.set(m[1].trim().toUpperCase(), d);
  });

  const results = [];
  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const name = (row["Name"] || "").toString().trim();
    const allBlank = Object.values(row).every(v => v === undefined || v === null || String(v).trim() === "");
    if (allBlank || !name) return;

    const manufacturer = (row["Manufacturer"] || "").toString().trim();
    const model = (row["Model"] || "").toString().trim();
    const rawType = row["Type"];
    const serial = (row["Serial number"] || "").toString().trim();
    const os = (row["Operating System - Name"] || "").toString().trim();
    const cpu = (row["Components - Processor"] || "").toString().trim();
    const location = (row["Location"] || "").toString().trim();

    const type = mapGlpiType(rawType, kind, `${name} ${model}`);
    const catId = getCategoryId(type);
    const brand = inferBrand(manufacturer, name, model);
    const specs = [manufacturer || brand, model].filter(Boolean).join(" ").trim();

    const attrs = {};
    const fieldKeys = new Set((CATEGORY_FIELDS[catId] || []).map(f => f.key));
    if (serial && fieldKeys.has("serial")) attrs.serial = serial;
    if (cpu && fieldKeys.has("cpu")) attrs.cpu = cpu;
    if (os && fieldKeys.has("os")) attrs.os = os;

    const { holder, method } = resolveHolder(row, kind);
    const warnings = [];
    if (holder && method === "hostname") {
      warnings.push(`Không có email khớp trực tiếp — đã dò theo tên máy "${name}" → gợi ý ${holder.id} - ${holder.name}. Vui lòng kiểm tra lại.`);
    }
    const altUser = row["Alternate username"];
    if (!holder && altUser) {
      warnings.push(`Không dò được người dùng khớp với "${altUser}"`);
    }

    const status = holder ? "Đang sử dụng" : "Trong kho";

    let existing = null;
    if (serial && existingBySerial.has(serial.toUpperCase())) existing = existingBySerial.get(serial.toUpperCase());
    else if (existingByGlpiName.has(name.toUpperCase())) existing = existingByGlpiName.get(name.toUpperCase());

    const data = {
      glpiName: name, type, catId, brand, specs, attrs,
      condition: existing ? existing.condition : "Tốt", status,
      holderId: holder ? holder.id : null, holderName: holder ? holder.name : null, dept: holder ? holder.dept : null,
      importDate: existing ? existing.importDate : todayISO(),
      purchaseDate: existing ? existing.purchaseDate : todayISO(),
      purchasePrice: existing ? existing.purchasePrice : 0,
      vendor: existing ? existing.vendor : "", invoiceNo: existing ? existing.invoiceNo : "",
      warrantyMonths: existing ? existing.warrantyMonths : state.settings.warrantyMonths,
      usefulLifeYears: existing ? existing.usefulLifeYears : state.settings.usefulLifeYears,
      salvageValue: existing ? existing.salvageValue : 0,
      note: `[GLPI:${name}]${location ? " Vị trí GLPI: " + location : ""}`
    };

    results.push({
      rowNum, data, warnings,
      rowStatus: existing ? "update" : "ok",
      existingId: existing ? existing.id : null
    });
  });

  return results;
}

// ---------------------------------------------------------------------------
// 4) UI: chọn file -> xem trước (có thể sửa người giữ từng dòng) -> xác nhận
// ---------------------------------------------------------------------------
export function triggerGlpiImportFilePicker() {
  if (!ensureXLSX()) return;
  const input = document.getElementById("glpiImportFileInput");
  if (input) { input.value = ""; input.click(); }
}

export function handleGlpiImportFileSelected(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = window.XLSX.read(data, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = window.XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rawRows.length === 0) {
        toast("File GLPI không có dữ liệu", "err");
        return;
      }
      if (!("Name" in rawRows[0])) {
        toast("File không đúng định dạng export của GLPI — thiếu cột \"Name\". Vui lòng xuất từ GLPI với cột Name.", "err");
        return;
      }

      const headers = Object.keys(rawRows[0]);
      const report = buildGlpiImportReport(rawRows, headers);
      if (report.length === 0) {
        toast("Không đọc được dòng dữ liệu hợp lệ nào trong file", "err");
        return;
      }
      showGlpiImportPreview(report);
    } catch (err) {
      console.error("Lỗi đọc file GLPI:", err);
      toast("Không thể đọc file. Vui lòng dùng đúng file .xlsx xuất từ GLPI.", "err");
    }
  };
  reader.readAsArrayBuffer(file);
}

function holderSelectHTML(rowIdx, r) {
  const opts = [`<option value="">— Trong kho (không gán người giữ) —</option>`]
    .concat(state.employees
      .filter(e => e.status !== "Đã nghỉ việc")
      .map(e => `<option value="${esc(e.id)}" ${r.data.holderId === e.id ? "selected" : ""}>${esc(e.id)} - ${esc(e.name)}${e.dept ? " (" + esc(e.dept) + ")" : ""}</option>`));
  return `<select style="font-size:12.5px; max-width:220px;" onchange="app.setGlpiImportHolder(${rowIdx}, this.value)">${opts.join("")}</select>`;
}

function renderGlpiPreviewRows(report) {
  return report.map((r, i) => `
    <tr>
      <td>${r.rowNum}</td>
      <td><div class="cell-title">${esc(r.data.glpiName)}</div><div class="cell-sub">${esc(r.data.type)} · ${esc(r.data.specs || "—")}</div></td>
      <td>${holderSelectHTML(i, r)}</td>
      <td>${esc(r.data.status)}</td>
      <td>
        ${r.rowStatus === "ok" ? '<span class="pill pill-success">Thêm mới</span>' : ""}
        ${r.rowStatus === "update" ? `<span class="pill pill-brand">Cập nhật ${esc(r.existingId)}</span>` : ""}
        ${r.warnings.length > 0 ? `<div class="cell-sub">${r.warnings.map(esc).join("<br>")}</div>` : ""}
      </td>
    </tr>
  `).join("");
}

function showGlpiImportPreview(report) {
  window.__pendingGlpiImportReport = report;
  refreshGlpiImportModal();
}

function refreshGlpiImportModal() {
  const report = window.__pendingGlpiImportReport || [];
  const newCount = report.filter(r => r.rowStatus === "ok").length;
  const updateCount = report.filter(r => r.rowStatus === "update").length;
  const assignedCount = report.filter(r => r.data.holderId).length;

  const body = `
    <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
      Đã đọc <b>${report.length}</b> thiết bị từ GLPI:
      <span class="pill pill-success">${newCount} thêm mới</span>
      <span class="pill pill-brand">${updateCount} cập nhật (đã có trong hệ thống)</span>
      <span class="pill pill-slate">${assignedCount} đã gán người giữ</span>
    </p>
    <p style="color:var(--text-secondary); font-size:12.5px; margin-bottom:12px;">
      Với các dòng chưa dò được đúng người giữ (hoặc gán sai), hãy chọn lại ở cột "Người giữ" trước khi nhập.
    </p>
    <div class="table-responsive" style="max-height:400px; overflow-y:auto;">
      <table class="data">
        <tr><th>Dòng</th><th>Thiết bị (GLPI)</th><th>Người giữ</th><th>Trạng thái</th><th>Kết quả</th></tr>
        ${renderGlpiPreviewRows(report)}
      </table>
    </div>
  `;

  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" ${report.length === 0 ? "disabled" : ""} onclick="app.confirmGlpiImport()">
      <i class="ph ph-upload-simple"></i> Đồng bộ ${report.length} thiết bị từ GLPI
    </button>
  `;

  openModal("Xem trước dữ liệu đồng bộ từ GLPI", body, foot, "960px");
}

// Người dùng đổi người giữ ngay trong bảng xem trước, trước khi xác nhận nhập
export function setGlpiImportHolder(rowIdx, empId) {
  const report = window.__pendingGlpiImportReport || [];
  const r = report[rowIdx];
  if (!r) return;
  if (!empId) {
    r.data.holderId = null; r.data.holderName = null; r.data.dept = null; r.data.status = "Trong kho";
  } else {
    const emp = state.employees.find(e => e.id === empId);
    if (emp) {
      r.data.holderId = emp.id; r.data.holderName = emp.name; r.data.dept = emp.dept; r.data.status = "Đang sử dụng";
    }
  }
  refreshGlpiImportModal();
}

export async function confirmGlpiImport() {
  const report = window.__pendingGlpiImportReport || [];
  if (report.length === 0) { closeModal(); return; }

  const usedIds = new Set(state.devices.map(d => d.id));
  const byEmail = currentUser?.email;
  let maxSeq = state.meta.deviceSeq;
  let addedCount = 0, updatedCount = 0;

  report.forEach(r => {
    const d = r.data;
    if (r.rowStatus === "update" && r.existingId) {
      updateDeviceRecord(r.existingId, {
        status: d.status, holderId: d.holderId, holderName: d.holderName, dept: d.dept,
        type: d.type, brand: d.brand, specs: d.specs, attrs: d.attrs, note: d.note
      }, byEmail, "Đồng bộ từ GLPI");
      updatedCount += 1;
    } else {
      const id = nextAvailableDeviceId(usedIds);
      const m = /^TB(\d+)$/.exec(id);
      if (m) maxSeq = Math.max(maxSeq, Number(m[1]) + 1);
      addDeviceRecord({
        id, status: d.status, holderId: d.holderId, holderName: d.holderName, dept: d.dept,
        type: d.type, brand: d.brand, specs: d.specs, attrs: d.attrs, condition: d.condition,
        importDate: d.importDate, purchaseDate: d.purchaseDate, purchasePrice: d.purchasePrice,
        vendor: d.vendor, invoiceNo: d.invoiceNo, warrantyMonths: d.warrantyMonths,
        usefulLifeYears: d.usefulLifeYears, salvageValue: d.salvageValue, note: d.note
      }, byEmail);
      addedCount += 1;
    }
  });

  state.meta.deviceSeq = Math.max(state.meta.deviceSeq, maxSeq);

  await persistDevices();
  await persistMeta();
  closeModal();
  toast(`Đồng bộ GLPI xong: thêm mới ${addedCount}, cập nhật ${updatedCount} thiết bị`);
  window.__pendingGlpiImportReport = null;
  if (window.__deviceImportRefresh) window.__deviceImportRefresh();
}
