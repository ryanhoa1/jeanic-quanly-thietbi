import { state, getCategoryId, getCategoryMeta } from './db.js';
import { fmtDate, fmtDateTime } from './helpers.js';
import { toast } from './ui.js';

function ensureXLSX() {
  if (!window.XLSX) { toast("Không thể xuất Excel (thiếu thư viện XLSX)", "err"); return false; }
  return true;
}

function todayStamp() { return new Date().toISOString().slice(0, 10); }

function autoWidth(rows) {
  const widths = [];
  rows.forEach(r => (r || []).forEach((cell, i) => {
    const len = (cell === null || cell === undefined) ? 0 : String(cell).length;
    widths[i] = Math.max(widths[i] || 10, Math.min(len + 2, 45));
  }));
  return widths.map(w => ({ wch: w }));
}

function devicesSheetRows(list) {
  const header = ["STT", "Mã TB", "Nhóm tài sản", "Loại thiết bị", "Thương hiệu", "Thông số kỹ thuật", "Thông số chuyên biệt", "Tình trạng", "Trạng thái",
    "Người đang giữ", "Bộ phận", "Ngày nhập kho", "Ngày mua", "Giá mua (₫)", "Nhà cung cấp", "Số hoá đơn",
    "Bảo hành (tháng)", "Vòng đời (năm)", "Ghi chú"];
  const rows = [header];
  list.forEach((d, i) => {
    const catLabel = getCategoryMeta(getCategoryId(d.type))?.label || "Khác";
    const attrsText = d.attrs ? Object.entries(d.attrs).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
    rows.push([
      i + 1, d.id, catLabel, d.type, d.brand, d.specs || "", attrsText, d.condition, d.status,
      d.holderName || "", d.dept || "", fmtDate(d.importDate), fmtDate(d.purchaseDate),
      d.purchasePrice || 0, d.vendor || "", d.invoiceNo || "",
      d.warrantyMonths || 0, d.usefulLifeYears || 0, d.note || ""
    ]);
  });
  return rows;
}

function employeesSheetRows(list) {
  const header = ["Mã NV", "Họ tên", "Bộ phận", "Chức vụ", "Email", "Điện thoại", "Trạng thái", "Số thiết bị đang giữ"];
  const rows = [header];
  list.forEach(e => rows.push([
    e.id, e.name, e.dept || "", e.position || "", e.email || "", e.phone || "", e.status || "",
    state.devices.filter(d => d.holderId === e.id).length
  ]));
  return rows;
}

function historySheetRows() {
  const recent = [];
  state.devices.forEach(d => (d.history || []).forEach(h => recent.push({ ...h, deviceId: d.id, deviceType: d.type, deviceBrand: d.brand })));
  recent.sort((a, b) => new Date(b.date) - new Date(a.date));
  const header = ["Ngày giờ", "Mã TB", "Loại / Thương hiệu", "Sự kiện", "Từ", "Đến", "Bộ phận", "Tình trạng", "Ghi chú", "Người thực hiện"];
  const rows = [header];
  recent.forEach(h => rows.push([
    fmtDateTime(h.date), h.deviceId, `${h.deviceType || ""} - ${h.deviceBrand || ""}`, h.label || "",
    h.from || "", h.to || "", h.dept || "", h.condition || "", h.note || "", h.by || ""
  ]));
  return rows;
}

function inventoryChecklistRows(list) {
  const s = state.settings || {};
  const header = ["STT", "Mã TB", "Nhóm tài sản", "Loại / Thương hiệu", "Bộ phận / Vị trí", "Người sử dụng",
    "Tình trạng (sổ sách)", "Kết quả kiểm kê (Đủ / Thiếu / Hỏng)", "Ghi chú thực tế", "Người kiểm kê ký xác nhận"];
  const rows = [
    [s.companyName || "CÔNG TY TNHH JEANIC GARMENT"],
    ["BIÊN BẢN KIỂM KÊ TÀI SẢN CNTT"],
    [`Ngày kiểm kê: ${fmtDate(todayStamp())}`],
    [],
    header
  ];
  list.forEach((d, i) => {
    const catLabel = getCategoryMeta(getCategoryId(d.type))?.label || "Khác";
    rows.push([
      i + 1, d.id, catLabel, `${d.type} - ${d.brand}`, d.dept || "Trong kho", d.holderName || "—", d.condition, "", "", ""
    ]);
  });
  rows.push([]);
  rows.push(["", "", "", "", "", "", "", "Đại diện phòng IT", "", "Đại diện Ban Giám đốc"]);
  rows.push(["", "", "", "", "", "", "", "(Ký, ghi rõ họ tên)", "", "(Ký, ghi rõ họ tên)"]);
  return rows;
}

function sheetFromRows(rows, merges) {
  const ws = window.XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = autoWidth(rows);
  if (merges) ws["!merges"] = merges;
  return ws;
}

function download(wb, filename) {
  window.XLSX.writeFile(wb, filename);
}

export function exportDevicesExcel(list) {
  if (!ensureXLSX()) return;
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(devicesSheetRows(list || state.devices)), "Danh sách thiết bị");
  download(wb, `Danh-sach-thiet-bi-${todayStamp()}.xlsx`);
  toast("Đã xuất danh sách thiết bị (Excel)");
}

export function exportEmployeesExcel(list) {
  if (!ensureXLSX()) return;
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(employeesSheetRows(list || state.employees)), "Danh sách nhân viên");
  download(wb, `Danh-sach-nhan-vien-${todayStamp()}.xlsx`);
  toast("Đã xuất danh sách nhân viên (Excel)");
}

export function exportHistoryExcel() {
  if (!ensureXLSX()) return;
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(historySheetRows()), "Lịch sử nghiệp vụ");
  download(wb, `Lich-su-nghiep-vu-${todayStamp()}.xlsx`);
  toast("Đã xuất lịch sử nghiệp vụ (Excel)");
}

export function exportInventoryChecklist(list) {
  if (!ensureXLSX()) return;
  const rows = inventoryChecklistRows(list || state.devices);
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }
  ];
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(rows, merges), "Phiếu kiểm kê");
  download(wb, `Phieu-kiem-ke-thiet-bi-${todayStamp()}.xlsx`);
  toast("Đã xuất phiếu kiểm kê (Excel)");
}

export function exportFullReport() {
  if (!ensureXLSX()) return;
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(devicesSheetRows(state.devices)), "Danh sách thiết bị");
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(employeesSheetRows(state.employees)), "Danh sách nhân viên");
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(historySheetRows()), "Lịch sử nghiệp vụ");
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }
  ];
  window.XLSX.utils.book_append_sheet(wb, sheetFromRows(inventoryChecklistRows(state.devices), merges), "Phiếu kiểm kê");
  download(wb, `Bao-cao-tong-hop-CNTT-${todayStamp()}.xlsx`);
  toast("Đã xuất báo cáo tổng hợp (Excel)");
}
