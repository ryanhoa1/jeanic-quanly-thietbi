import { state } from './db.js';

export function pad3(n) { return String(n).padStart(3, "0"); }
export function nextDeviceId() { return "TB" + pad3(state.meta.deviceSeq); }
export function nextEmployeeId() { return "NV" + pad3(state.meta.employeeSeq); }
export function nextLicenseId() { return "LIC" + pad3(state.meta.licenseSeq || 1); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }

export function fmtDate(iso) { 
  if (!iso) return "—"; 
  const d = new Date(iso); 
  if (isNaN(d)) return String(iso); 
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }); 
}

export function fmtDateTime(iso) { 
  const d = new Date(iso); 
  if (isNaN(d)) return String(iso); 
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); 
}

// Vietnamese official-document style date, e.g. "Ngày 08 tháng 07 năm 2026"
export function fmtDateVN(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `Ngày ${dd} tháng ${mm} năm ${yyyy}`;
}

export function esc(s) { 
  return (s === undefined || s === null) ? "" : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); 
}

export function fmtVND(n) { 
  if (n === null || n === undefined || n === "" || isNaN(n)) return "—"; 
  return Math.round(Number(n)).toLocaleString("vi-VN") + " ₫"; 
}

export function monthsBetween(a, b) { 
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); 
  if (b.getDate() < a.getDate()) m -= 1; 
  return m; 
}

export function computeDepreciation(d) {
  const price = Number(d.purchasePrice) || 0;
  const salvage = Number(d.salvageValue) || 0;
  const lifeYears = Number(d.usefulLifeYears) || state.settings.usefulLifeYears;
  const lifeMonths = Math.max(1, Math.round(lifeYears * 12));
  if (!d.purchaseDate || price <= 0) {
    return { hasData: false, price: 0, bookValue: null, percentUsed: 0, monthsElapsed: 0, lifeMonths, monthlyDep: 0, accumDep: 0 };
  }
  const start = new Date(d.purchaseDate);
  const now = new Date();
  let monthsElapsed = monthsBetween(start, now);
  monthsElapsed = Math.max(0, Math.min(monthsElapsed, lifeMonths));
  const depreciableAmount = Math.max(0, price - salvage);
  const monthlyDep = depreciableAmount / lifeMonths;
  const accumDep = monthlyDep * monthsElapsed;
  const bookValue = Math.max(salvage, price - accumDep);
  const percentUsed = lifeMonths > 0 ? Math.min(100, Math.round((monthsElapsed / lifeMonths) * 100)) : 0;
  return { hasData: true, price, salvage, lifeMonths, monthsElapsed, monthlyDep, accumDep, bookValue, percentUsed };
}

export function warrantyInfo(d) {
  if (!d.purchaseDate || !d.warrantyMonths) return { hasData: false };
  const start = new Date(d.purchaseDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + (Number(d.warrantyMonths) || 0));
  const now = new Date();
  const daysLeft = Math.round((end - now) / 86400000);
  return { hasData: true, end, daysLeft, expired: daysLeft < 0, endISO: end.toISOString().slice(0, 10) };
}

export function repairTotal(d) { 
  return (d.repairs || []).reduce((s, r) => s + (Number(r.cost) || 0), 0); 
}

export function computeAlerts() {
  const alerts = [];
  state.devices.forEach(d => {
    if (d.status === "Thanh lý") return;
    const dep = computeDepreciation(d);
    const war = warrantyInfo(d);
    const rTotal = repairTotal(d);
    
    if (war.hasData && !war.expired && war.daysLeft <= state.settings.warrantyWarnDays) {
      alerts.push({ device: d, kind: "warranty", text: `Sắp hết bảo hành (còn ${war.daysLeft} ngày)` });
    } else if (war.hasData && war.expired && war.daysLeft >= -state.settings.warrantyWarnDays) {
      alerts.push({ device: d, kind: "warranty-expired", text: `Đã hết bảo hành ${Math.abs(war.daysLeft)} ngày trước` });
    }
    
    if (dep.hasData) {
      if ((100 - dep.percentUsed) <= state.settings.depreciationWarnPercent) {
        alerts.push({ device: d, kind: "depreciation", text: `Đã khấu hao ${dep.percentUsed}% — giá trị còn lại thấp` });
      }
      if (dep.price > 0 && rTotal >= dep.price * state.settings.repairCostWarnPercent / 100) {
        alerts.push({ device: d, kind: "repair-cost", text: `Chi phí sửa chữa ${fmtVND(rTotal)} — cân nhắc thanh lý` });
      }
    }
  });
  return alerts;
}

// License-specific alerts (expiring soon / expired / seats full). Kept
// separate from computeAlerts() (device-only) since license alerts key off
// a license record rather than a device record.
export function computeLicenseAlerts() {
  const alerts = [];
  (state.licenses || []).forEach(lic => {
    const used = (lic.assignments || []).length;
    const max = Number(lic.maxSeats) || 0;
    if (lic.expiryDate) {
      const end = new Date(lic.expiryDate);
      const daysLeft = Math.round((end - new Date()) / 86400000);
      const warnDays = state.settings.licenseExpiryWarnDays || 30;
      if (daysLeft < 0) {
        alerts.push({ license: lic, kind: "license-expired", text: `Đã hết hạn ${Math.abs(daysLeft)} ngày trước` });
      } else if (daysLeft <= warnDays) {
        alerts.push({ license: lic, kind: "license-expiring", text: `Sắp hết hạn (còn ${daysLeft} ngày)` });
      }
    }
    if (max > 0 && used >= max) {
      alerts.push({ license: lic, kind: "license-full", text: `Đã cấp phát đủ ${used}/${max} chỗ` });
    }
  });
  return alerts;
}

export function downloadFile(content, filename, mime) {
  const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); 
  a.href = url; 
  a.download = filename;
  document.body.appendChild(a); 
  a.click(); 
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
