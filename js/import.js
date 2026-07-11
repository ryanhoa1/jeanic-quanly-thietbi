import {
  state, DEPARTMENTS, CONDITIONS, DEVICE_TYPES, BRANDS, STATUS_META,
  CATEGORY_FIELDS, ASSET_CATEGORIES, getCategoryId, getCategoryMeta,
  addDeviceRecord, persistDevices, persistMeta,
  addEmployeeRecord, persistEmployees
} from './db.js';
import { esc, todayISO, pad3 } from './helpers.js';
import { toast, openModal, closeModal } from './ui.js';
import { currentUser } from './auth.js';

function ensureXLSX() {
  if (!window.XLSX) { toast("Không thể thao tác với Excel (thiếu thư viện XLSX)", "err"); return false; }
  return true;
}

function todayStamp() { return new Date().toISOString().slice(0, 10); }

// Normalizes Vietnamese text for fuzzy matching: lowercase, Đ/đ -> d, strips
// diacritics/tone marks, collapses whitespace. Lets "Dầm Thị Lý" match
// "Đàm Thị Lý" (common data-entry typos on the base letter, not just tone).
function normalizeVN(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function autoWidth(rows) {
  const widths = [];
  rows.forEach(r => (r || []).forEach((cell, i) => {
    const len = (cell === null || cell === undefined) ? 0 : String(cell).length;
    widths[i] = Math.max(widths[i] || 10, Math.min(len + 2, 45));
  }));
  return widths.map(w => ({ wch: w }));
}

// Vietnamese header labels <-> internal field keys. The order here is also
// the column order used in the generated template.
const IMPORT_COLUMNS = [
  { key: "id", header: "Mã TB (để trống để tự sinh mã)" },
  { key: "type", header: "Loại thiết bị (*)" },
  { key: "brand", header: "Thương hiệu (*)" },
  { key: "specs", header: "Thông số kỹ thuật" },
  { key: "attrsText", header: "Thông số chuyên biệt (key: value; key2: value2)" },
  { key: "condition", header: "Tình trạng (*)" },
  { key: "status", header: "Trạng thái (*)" },
  { key: "holderId", header: "Mã NV hoặc Họ tên đang giữ (bắt buộc nếu Trạng thái = Đang sử dụng)" },
  { key: "importDate", header: "Ngày nhập kho (yyyy-mm-dd)" },
  { key: "purchaseDate", header: "Ngày mua (yyyy-mm-dd)" },
  { key: "purchasePrice", header: "Giá mua (đồng)" },
  { key: "vendor", header: "Nhà cung cấp" },
  { key: "invoiceNo", header: "Số hoá đơn" },
  { key: "warrantyMonths", header: "Bảo hành (tháng)" },
  { key: "usefulLifeYears", header: "Vòng đời sử dụng (năm)" },
  { key: "salvageValue", header: "Giá trị thanh lý ước tính (đồng)" },
  { key: "note", header: "Ghi chú" }
];

// ---------------------------------------------------------------------------
// 1) EXPORT TEMPLATE — file mẫu để người dùng điền thông tin thiết bị
// ---------------------------------------------------------------------------
function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

// Returns { catId, label, types } describing the scope a template/import is
// restricted to. catId "all" (or falsy) means no restriction.
function categoryScope(catId) {
  if (!catId || catId === "all") return { catId: "all", label: null, types: DEVICE_TYPES };
  const meta = getCategoryMeta(catId);
  return { catId, label: meta?.label || catId, types: meta ? ASSET_CATEGORIES.find(c => c.id === catId)?.types || DEVICE_TYPES : DEVICE_TYPES };
}

export function downloadDeviceImportTemplate(catId) {
  if (!ensureXLSX()) return;
  const scope = categoryScope(catId);
  const exampleType = scope.types[0] || DEVICE_TYPES[0];

  const header = IMPORT_COLUMNS.map(c => c.header);
  const exampleRows = [
    ["", exampleType, "Dell", "Ví dụ mô tả thông số kỹ thuật", "", "Mới", "Trong kho", "", todayISO(), todayISO(), 0, "", "", 12, 3, 0, "Ví dụ — hãy xoá dòng này trước khi nhập dữ liệu thật"],
    ["", exampleType, "Logitech", "Ví dụ mô tả thông số kỹ thuật", "", "Tốt", "Đang sử dụng", "NV001", todayISO(), todayISO(), 0, "", "", 12, 2, 0, "Ví dụ — hãy xoá dòng này trước khi nhập dữ liệu thật"]
  ];
  const rows = [header, ...exampleRows];

  const wsMain = window.XLSX.utils.aoa_to_sheet(rows);
  wsMain["!cols"] = autoWidth(rows);

  // Reference sheet: valid values for every dropdown-like column, restricted
  // to the current category scope when the template was requested from a
  // specific asset category tab. Includes the current employee list too, so
  // people can copy-paste the correct Mã NV.
  const refRows = [
    [scope.catId === "all"
      ? "DANH MỤC THAM CHIẾU — dùng để điền đúng giá trị ở sheet 'Nhập thiết bị'"
      : `DANH MỤC THAM CHIẾU — nhóm tài sản: ${scope.label} (dùng để điền đúng giá trị ở sheet 'Nhập thiết bị')`],
    [],
    [scope.catId === "all" ? "Loại thiết bị hợp lệ" : `Loại thiết bị hợp lệ trong nhóm "${scope.label}"`],
    ...scope.types.map(t => [t]),
    [],
    ["Thương hiệu gợi ý (có thể nhập thương hiệu khác nếu không có trong danh sách)"],
    ...BRANDS.map(b => [b]),
    [],
    ["Tình trạng hợp lệ"],
    ...CONDITIONS.map(c => [c]),
    [],
    ["Trạng thái hợp lệ"],
    ...Object.keys(STATUS_META).map(s => [s]),
    [],
    ["Bộ phận (tham khảo)"],
    ...DEPARTMENTS.map(d => [d]),
    [],
    ["Danh sách nhân viên hiện có (dùng cột Mã NV khi Trạng thái = Đang sử dụng)"],
    ["Mã NV", "Họ tên", "Bộ phận"],
    ...state.employees.map(e => [e.id, e.name, e.dept || ""])
  ];
  const wsRef = window.XLSX.utils.aoa_to_sheet(refRows);
  wsRef["!cols"] = autoWidth(refRows);

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, wsMain, "Nhập thiết bị");
  window.XLSX.utils.book_append_sheet(wb, wsRef, "Danh mục tham chiếu");
  const slug = scope.catId !== "all" ? `-${slugify(scope.label)}` : "";
  window.XLSX.writeFile(wb, `Mau-nhap-thiet-bi${slug}-${todayStamp()}.xlsx`);
  toast(`Đã tải file mẫu nhập ${scope.catId === "all" ? "thiết bị" : scope.label.toLowerCase()}`);
}

// ---------------------------------------------------------------------------
// 2) READ + VALIDATE the file the user filled in
// ---------------------------------------------------------------------------
function findValue(list, raw, { caseInsensitive = true } = {}) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!caseInsensitive) return list.includes(s) ? s : null;
  const lower = s.toLowerCase();
  return list.find(v => v.toLowerCase() === lower) || null;
}

function parseDateCell(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return fallback;
}

function parseNumberCell(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw === "number") return raw;
  const direct = Number(raw);
  if (!isNaN(direct)) return direct;
  // Fallback for text like "18.500.000 ₫" or "18,500,000" typed by hand.
  const digitsOnly = String(raw).replace(/[^\d-]/g, "");
  const n = Number(digitsOnly);
  return isNaN(n) ? fallback : n;
}

// Reverse label->key map per category, e.g. for "computers": {"CPU":"cpu", "RAM":"ram", ...}
function parseAttrsText(text, catId) {
  const fields = CATEGORY_FIELDS[catId] || [];
  const labelToKey = {};
  fields.forEach(f => { labelToKey[f.label.toLowerCase()] = f.key; });
  const attrs = {};
  if (!text) return attrs;
  String(text).split(";").forEach(pair => {
    const idx = pair.indexOf(":");
    if (idx === -1) return;
    const rawLabel = pair.slice(0, idx).trim().toLowerCase();
    const value = pair.slice(idx + 1).trim();
    const key = labelToKey[rawLabel] || fields.find(f => f.key === rawLabel)?.key;
    if (key && value) attrs[key] = value;
  });
  return attrs;
}

function nextAvailableDeviceId(usedIds) {
  while (usedIds.has("TB" + pad3(state.meta.deviceSeq))) state.meta.deviceSeq += 1;
  const id = "TB" + pad3(state.meta.deviceSeq);
  state.meta.deviceSeq += 1;
  usedIds.add(id);
  return id;
}

// Parses + validates every row, WITHOUT touching state yet. Returns a report
// the user reviews before anything is actually imported.
function buildImportReport(rawRows, categoryContext) {
  const scope = categoryScope(categoryContext);
  const existingIds = new Set(state.devices.map(d => d.id));
  const seenInFileIds = new Set();
  const results = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-based row numbering
    const errors = [];
    const warnings = [];

    const rawType = row["Loại thiết bị (*)"];
    const rawBrand = row["Thương hiệu (*)"];
    const rawCondition = row["Tình trạng (*)"];
    const rawStatus = row["Trạng thái (*)"];
    const rawHolderId = row["Mã NV hoặc Họ tên đang giữ (bắt buộc nếu Trạng thái = Đang sử dụng)"];
    const rawId = row["Mã TB (để trống để tự sinh mã)"];

    // Skip fully blank rows silently (common at the end of a spreadsheet)
    const allBlank = Object.values(row).every(v => v === undefined || v === null || String(v).trim() === "");
    if (allBlank) return;

    const type = findValue(DEVICE_TYPES, rawType);
    if (!type) {
      errors.push(`Loại thiết bị "${rawType || ""}" không hợp lệ`);
    } else if (scope.catId !== "all" && !scope.types.includes(type)) {
      errors.push(`Loại thiết bị "${type}" không thuộc nhóm "${scope.label}" — hãy nhập ở mục "Tất cả tài sản" hoặc đúng nhóm của nó`);
    }

    const brand = rawBrand ? String(rawBrand).trim() : "";
    if (!brand) errors.push("Thiếu Thương hiệu");

    const condition = findValue(CONDITIONS, rawCondition);
    if (!condition) errors.push(`Tình trạng "${rawCondition || ""}" không hợp lệ`);

    const status = findValue(Object.keys(STATUS_META), rawStatus);
    if (!status) errors.push(`Trạng thái "${rawStatus || ""}" không hợp lệ`);

    let holderId = null, holderName = null, dept = null;
    if (status === "Đang sử dụng") {
      const holderRaw = rawHolderId ? String(rawHolderId).trim() : "";
      if (!holderRaw) {
        errors.push("Trạng thái là 'Đang sử dụng' nhưng thiếu Mã NV/Họ tên đang giữ");
      } else {
        // Try exact employee ID first (e.g. NV001), then fall back to a
        // Vietnamese-typo-tolerant full-name match (e.g. "Dầm Thị Lý" ~ "Đàm Thị Lý").
        let emp = state.employees.find(e => e.id.toUpperCase() === holderRaw.toUpperCase());
        let holderResolutionError = null;
        if (!emp) {
          const normTarget = normalizeVN(holderRaw);
          const nameMatches = state.employees.filter(e => normalizeVN(e.name) === normTarget);
          if (nameMatches.length === 1) {
            emp = nameMatches[0];
            warnings.push(`Đã dò theo họ tên "${holderRaw}" → khớp nhân viên ${emp.id} - ${emp.name}`);
          } else if (nameMatches.length > 1) {
            holderResolutionError = `Có ${nameMatches.length} nhân viên trùng tên "${holderRaw}" — vui lòng dùng Mã NV (${nameMatches.map(e => e.id).join(", ")}) để tránh nhầm lẫn`;
          } else {
            holderResolutionError = `Không tìm thấy nhân viên khớp với "${holderRaw}" (theo mã hoặc theo tên)`;
          }
        }
        if (holderResolutionError) errors.push(holderResolutionError);
        else if (emp) { holderId = emp.id; holderName = emp.name; dept = emp.dept; }
      }
    }

    // Device ID: optional. Blank => auto-generate later. Provided => must be unique.
    let id = null;
    let duplicate = false;
    if (rawId && String(rawId).trim()) {
      id = String(rawId).trim().toUpperCase();
      if (existingIds.has(id) || seenInFileIds.has(id)) {
        duplicate = true;
        warnings.push(`Mã "${id}" đã tồn tại — dòng này sẽ được BỎ QUA`);
      }
    }

    const importDate = parseDateCell(row["Ngày nhập kho (yyyy-mm-dd)"], todayISO());
    const purchaseDate = parseDateCell(row["Ngày mua (yyyy-mm-dd)"], importDate);
    const purchasePrice = parseNumberCell(row["Giá mua (đồng)"], 0);
    const warrantyMonths = parseNumberCell(row["Bảo hành (tháng)"], state.settings.warrantyMonths);
    const usefulLifeYears = parseNumberCell(row["Vòng đời sử dụng (năm)"], state.settings.usefulLifeYears);
    const salvageValue = parseNumberCell(row["Giá trị thanh lý ước tính (đồng)"], 0);
    const catId = type ? getCategoryId(type) : "others";
    const attrs = parseAttrsText(row["Thông số chuyên biệt (key: value; key2: value2)"], catId);

    const data = {
      id, type, brand, specs: (row["Thông số kỹ thuật"] || "").toString().trim(), attrs,
      condition, status, holderId, holderName, dept,
      importDate, purchaseDate, purchasePrice, vendor: (row["Nhà cung cấp"] || "").toString().trim(),
      invoiceNo: (row["Số hoá đơn"] || "").toString().trim(),
      warrantyMonths, usefulLifeYears, salvageValue,
      note: (row["Ghi chú"] || "").toString().trim()
    };

    let rowStatus = "ok";
    if (errors.length > 0) rowStatus = "error";
    else if (duplicate) rowStatus = "skip";

    if (id && !duplicate) seenInFileIds.add(id);

    results.push({ rowNum, data, errors, warnings, rowStatus, rawType, rawBrand });
  });

  return results;
}

// ---------------------------------------------------------------------------
// 3) UI: pick file -> preview -> confirm import
// ---------------------------------------------------------------------------
let importCategoryContext = "all";

export function triggerImportFilePicker(catId) {
  if (!ensureXLSX()) return;
  importCategoryContext = catId || "all";
  const input = document.getElementById("deviceImportFileInput");
  if (input) { input.value = ""; input.click(); }
}

export function handleImportFileSelected(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = window.XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames.find(n => n === "Nhập thiết bị") || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawRows = window.XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rawRows.length === 0) {
        toast("File không có dữ liệu để nhập", "err");
        return;
      }

      const requiredHeaders = ["Loại thiết bị (*)", "Thương hiệu (*)", "Tình trạng (*)", "Trạng thái (*)"];
      const firstRowKeys = Object.keys(rawRows[0]);
      const missingHeaders = requiredHeaders.filter(h => !firstRowKeys.includes(h));
      if (missingHeaders.length > 0) {
        toast(`File không đúng định dạng mẫu — thiếu cột: ${missingHeaders.join(", ")}. Vui lòng tải lại file mẫu.`, "err");
        return;
      }

      const report = buildImportReport(rawRows, importCategoryContext);
      showImportPreview(report, importCategoryContext);
    } catch (err) {
      console.error("Lỗi đọc file nhập thiết bị:", err);
      toast("Không thể đọc file. Vui lòng dùng đúng file .xlsx theo mẫu.", "err");
    }
  };
  reader.readAsArrayBuffer(file);
}

function showImportPreview(report, categoryContext) {
  const scope = categoryScope(categoryContext);
  const okRows = report.filter(r => r.rowStatus === "ok");
  const errorRows = report.filter(r => r.rowStatus === "error");
  const skipRows = report.filter(r => r.rowStatus === "skip");

  const body = `
    ${scope.catId !== "all" ? `<p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:8px;"><i class="ph ph-funnel"></i> Đang nhập cho nhóm: <b>${esc(scope.label)}</b></p>` : ""}
    <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
      Đã đọc <b>${report.length}</b> dòng dữ liệu:
      <span class="pill pill-success">${okRows.length} hợp lệ</span>
      <span class="pill pill-danger">${errorRows.length} lỗi</span>
      <span class="pill pill-slate">${skipRows.length} trùng mã (bỏ qua)</span>
    </p>
    <div class="table-responsive" style="max-height:360px; overflow-y:auto;">
      <table class="data">
        <tr><th>Dòng</th><th>Loại / Thương hiệu</th><th>Trạng thái</th><th>Người giữ</th><th>Kết quả</th></tr>
        ${report.map(r => `
          <tr>
            <td>${r.rowNum}</td>
            <td><div class="cell-title">${esc(r.data.type || r.rawType || "—")}</div><div class="cell-sub">${esc(r.data.brand || r.rawBrand || "")}</div></td>
            <td>${esc(r.data.status || "—")}</td>
            <td class="cell-sub">${esc(r.data.holderName || "—")}</td>
            <td>
              ${r.rowStatus === "ok" ? '<span class="pill pill-success">Hợp lệ</span>' : ""}
              ${r.rowStatus === "skip" ? `<span class="pill pill-slate">Bỏ qua</span><div class="cell-sub">${r.warnings.map(esc).join("<br>")}</div>` : ""}
              ${r.rowStatus === "error" ? `<span class="pill pill-danger">Lỗi</span><div class="cell-sub">${r.errors.map(esc).join("<br>")}</div>` : ""}
            </td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;

  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" ${okRows.length === 0 ? "disabled" : ""} onclick="app.confirmDeviceImport()">
      <i class="ph ph-upload-simple"></i> Nhập ${okRows.length} thiết bị hợp lệ
    </button>
  `;

  window.__pendingImportReport = report;
  openModal("Xem trước dữ liệu nhập thiết bị", body, foot, "900px");
}

export async function confirmDeviceImport() {
  const report = window.__pendingImportReport || [];
  const okRows = report.filter(r => r.rowStatus === "ok");
  if (okRows.length === 0) { closeModal(); return; }

  const usedIds = new Set(state.devices.map(d => d.id));
  const byEmail = currentUser?.email;
  let maxSeq = state.meta.deviceSeq;

  okRows.forEach(r => {
    const d = r.data;
    let id = d.id;
    if (!id) {
      id = nextAvailableDeviceId(usedIds);
    } else {
      usedIds.add(id);
      const m = /^TB(\d+)$/.exec(id);
      if (m) maxSeq = Math.max(maxSeq, Number(m[1]) + 1);
    }
    const device = {
      id, status: d.status, holderId: d.holderId, holderName: d.holderName, dept: d.dept,
      type: d.type, brand: d.brand, specs: d.specs, attrs: d.attrs, condition: d.condition,
      importDate: d.importDate, purchaseDate: d.purchaseDate, purchasePrice: d.purchasePrice,
      vendor: d.vendor, invoiceNo: d.invoiceNo, warrantyMonths: d.warrantyMonths,
      usefulLifeYears: d.usefulLifeYears, salvageValue: d.salvageValue, note: d.note
    };
    addDeviceRecord(device, byEmail);
  });

  state.meta.deviceSeq = Math.max(state.meta.deviceSeq, maxSeq);

  await persistDevices();
  await persistMeta();
  closeModal();
  toast(`Đã nhập thành công ${okRows.length} thiết bị`);
  window.__pendingImportReport = null;
  if (window.__deviceImportRefresh) window.__deviceImportRefresh();
}

// ===========================================================================
// NHÂN VIÊN — Excel template export + bulk import with validation preview
// ===========================================================================
const EMPLOYEE_STATUSES = ["Đang làm việc", "Đã nghỉ việc"];

const EMPLOYEE_IMPORT_COLUMNS = [
  { key: "id", header: "Mã NV (để trống để tự sinh mã)" },
  { key: "name", header: "Họ tên (*)" },
  { key: "dept", header: "Bộ phận (*)" },
  { key: "position", header: "Chức vụ" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Điện thoại" },
  { key: "status", header: "Trạng thái (*)" }
];

export function downloadEmployeeImportTemplate() {
  if (!ensureXLSX()) return;

  const header = EMPLOYEE_IMPORT_COLUMNS.map(c => c.header);
  const exampleRows = [
    ["", "Nguyễn Văn A", DEPARTMENTS[0], "Nhân viên", "a.nguyen@jeanicgarment.com", "0900000000", "Đang làm việc"],
    ["", "Trần Thị B", DEPARTMENTS[1] || DEPARTMENTS[0], "Trưởng nhóm", "b.tran@jeanicgarment.com", "0900000001", "Đang làm việc"]
  ];
  const rows = [header, ...exampleRows];
  rows.push(["", "", "", "", "", "", ""]);
  rows[rows.length - 1][1] = "Ví dụ — hãy xoá 2 dòng ví dụ ở trên trước khi nhập dữ liệu thật";

  const wsMain = window.XLSX.utils.aoa_to_sheet(rows);
  wsMain["!cols"] = autoWidth(rows);

  const refRows = [
    ["DANH MỤC THAM CHIẾU — dùng để điền đúng giá trị ở sheet 'Nhập nhân viên'"],
    [],
    ["Bộ phận hợp lệ"],
    ...DEPARTMENTS.map(d => [d]),
    [],
    ["Trạng thái hợp lệ"],
    ...EMPLOYEE_STATUSES.map(s => [s])
  ];
  const wsRef = window.XLSX.utils.aoa_to_sheet(refRows);
  wsRef["!cols"] = autoWidth(refRows);

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, wsMain, "Nhập nhân viên");
  window.XLSX.utils.book_append_sheet(wb, wsRef, "Danh mục tham chiếu");
  window.XLSX.writeFile(wb, `Mau-nhap-nhan-vien-${todayStamp()}.xlsx`);
  toast("Đã tải file mẫu nhập nhân viên");
}

function nextAvailableEmployeeId(usedIds) {
  while (usedIds.has("NV" + pad3(state.meta.employeeSeq))) state.meta.employeeSeq += 1;
  const id = "NV" + pad3(state.meta.employeeSeq);
  state.meta.employeeSeq += 1;
  usedIds.add(id);
  return id;
}

function buildEmployeeImportReport(rawRows) {
  const existingIds = new Set(state.employees.map(e => e.id));
  const existingEmails = new Set(state.employees.filter(e => e.email).map(e => e.email.toLowerCase()));
  const seenInFileIds = new Set();
  const results = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errors = [];
    const warnings = [];

    const allBlank = Object.values(row).every(v => v === undefined || v === null || String(v).trim() === "");
    if (allBlank) return;

    const rawId = row["Mã NV (để trống để tự sinh mã)"];
    const name = (row["Họ tên (*)"] || "").toString().trim();
    const rawDept = row["Bộ phận (*)"];
    const position = (row["Chức vụ"] || "").toString().trim();
    const email = (row["Email"] || "").toString().trim();
    const phone = (row["Điện thoại"] || "").toString().trim();
    const rawStatus = row["Trạng thái (*)"];

    if (!name) errors.push("Thiếu Họ tên");

    const dept = findValue(DEPARTMENTS, rawDept);
    if (!dept) errors.push(`Bộ phận "${rawDept || ""}" không hợp lệ`);

    const status = findValue(EMPLOYEE_STATUSES, rawStatus) || (rawStatus ? null : "Đang làm việc");
    if (!status) errors.push(`Trạng thái "${rawStatus || ""}" không hợp lệ`);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warnings.push(`Email "${email}" có vẻ không đúng định dạng`);
    }
    if (email && existingEmails.has(email.toLowerCase())) {
      warnings.push(`Email "${email}" đã tồn tại ở một nhân viên khác trong hệ thống`);
    }

    let id = null;
    let duplicate = false;
    if (rawId && String(rawId).trim()) {
      id = String(rawId).trim().toUpperCase();
      if (existingIds.has(id) || seenInFileIds.has(id)) {
        duplicate = true;
        warnings.push(`Mã "${id}" đã tồn tại — dòng này sẽ được BỎ QUA`);
      }
    }

    const data = { id, name, dept, position, email, phone, status };

    let rowStatus = "ok";
    if (errors.length > 0) rowStatus = "error";
    else if (duplicate) rowStatus = "skip";

    if (id && !duplicate) seenInFileIds.add(id);

    results.push({ rowNum, data, errors, warnings, rowStatus });
  });

  return results;
}

export function triggerEmployeeImportFilePicker() {
  if (!ensureXLSX()) return;
  const input = document.getElementById("employeeImportFileInput");
  if (input) { input.value = ""; input.click(); }
}

export function handleEmployeeImportFileSelected(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = window.XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames.find(n => n === "Nhập nhân viên") || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawRows = window.XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rawRows.length === 0) {
        toast("File không có dữ liệu để nhập", "err");
        return;
      }

      const requiredHeaders = ["Họ tên (*)", "Bộ phận (*)"];
      const firstRowKeys = Object.keys(rawRows[0]);
      const missingHeaders = requiredHeaders.filter(h => !firstRowKeys.includes(h));
      if (missingHeaders.length > 0) {
        toast(`File không đúng định dạng mẫu — thiếu cột: ${missingHeaders.join(", ")}. Vui lòng tải lại file mẫu.`, "err");
        return;
      }

      const report = buildEmployeeImportReport(rawRows);
      showEmployeeImportPreview(report);
    } catch (err) {
      console.error("Lỗi đọc file nhập nhân viên:", err);
      toast("Không thể đọc file. Vui lòng dùng đúng file .xlsx theo mẫu.", "err");
    }
  };
  reader.readAsArrayBuffer(file);
}

function showEmployeeImportPreview(report) {
  const okRows = report.filter(r => r.rowStatus === "ok");
  const errorRows = report.filter(r => r.rowStatus === "error");
  const skipRows = report.filter(r => r.rowStatus === "skip");

  const body = `
    <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
      Đã đọc <b>${report.length}</b> dòng dữ liệu:
      <span class="pill pill-success">${okRows.length} hợp lệ</span>
      <span class="pill pill-danger">${errorRows.length} lỗi</span>
      <span class="pill pill-slate">${skipRows.length} trùng mã (bỏ qua)</span>
    </p>
    <div class="table-responsive" style="max-height:360px; overflow-y:auto;">
      <table class="data">
        <tr><th>Dòng</th><th>Họ tên</th><th>Bộ phận</th><th>Trạng thái</th><th>Kết quả</th></tr>
        ${report.map(r => `
          <tr>
            <td>${r.rowNum}</td>
            <td class="cell-title">${esc(r.data.name || "—")}</td>
            <td>${esc(r.data.dept || "—")}</td>
            <td>${esc(r.data.status || "—")}</td>
            <td>
              ${r.rowStatus === "ok" ? '<span class="pill pill-success">Hợp lệ</span>' : ""}
              ${r.rowStatus === "skip" ? `<span class="pill pill-slate">Bỏ qua</span><div class="cell-sub">${r.warnings.map(esc).join("<br>")}</div>` : ""}
              ${r.rowStatus === "error" ? `<span class="pill pill-danger">Lỗi</span><div class="cell-sub">${r.errors.map(esc).join("<br>")}</div>` : ""}
              ${r.rowStatus === "ok" && r.warnings.length > 0 ? `<div class="cell-sub">${r.warnings.map(esc).join("<br>")}</div>` : ""}
            </td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;

  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" ${okRows.length === 0 ? "disabled" : ""} onclick="app.confirmEmployeeImport()">
      <i class="ph ph-upload-simple"></i> Nhập ${okRows.length} nhân viên hợp lệ
    </button>
  `;

  window.__pendingEmployeeImportReport = report;
  openModal("Xem trước dữ liệu nhập nhân viên", body, foot, "800px");
}

export async function confirmEmployeeImport() {
  const report = window.__pendingEmployeeImportReport || [];
  const okRows = report.filter(r => r.rowStatus === "ok");
  if (okRows.length === 0) { closeModal(); return; }

  const usedIds = new Set(state.employees.map(e => e.id));
  let maxSeq = state.meta.employeeSeq;

  okRows.forEach(r => {
    const d = r.data;
    let id = d.id;
    if (!id) {
      id = nextAvailableEmployeeId(usedIds);
    } else {
      usedIds.add(id);
      const m = /^NV(\d+)$/.exec(id);
      if (m) maxSeq = Math.max(maxSeq, Number(m[1]) + 1);
    }
    addEmployeeRecord({
      id, name: d.name, dept: d.dept, position: d.position,
      email: d.email, phone: d.phone, status: d.status
    });
  });

  state.meta.employeeSeq = Math.max(state.meta.employeeSeq, maxSeq);

  await persistEmployees();
  await persistMeta();
  closeModal();
  toast(`Đã nhập thành công ${okRows.length} nhân viên`);
  window.__pendingEmployeeImportReport = null;
  if (window.__employeeImportRefresh) window.__employeeImportRefresh();
}
