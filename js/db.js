import { db, useFirebase } from './firebase-config.js';

export const DEPARTMENTS = ["Ban Giám đốc","IT","Nhân sự (HR)","Kế toán","Kinh doanh","Plan (Kế hoạch)","Cắt (Cutting)","May (Sewing)","Hoàn thiện (Finishing)","QA/QC","Kho (Warehouse)","Bảo trì (Maintenance)","Xuất nhập khẩu","Khác"];
export const CONDITIONS = ["Mới","Tốt","Khá","Trung bình","Hỏng nhẹ","Hỏng nặng"];
export const DEVICE_TYPES = ["Desktop","Laptop","Laptop + Sạc","Màn hình","Bàn phím","Chuột không dây","Chuột có dây","Combo Bàn phím + Chuột","Tai nghe","Webcam","Camera","Máy in","Router/Switch","Điện thoại","Mực in/Hộp mực","USB/Ổ cứng di động","Balo/Túi laptop","Sạc/Cáp","Khác"];
export const BRANDS = ["Dell","HP","Lenovo","Asus","Acer","Apple","Logitech","EBLUE","Samsung","LG","Canon","TP-Link","HIKVision","Kingston","Xiaomi","Khác"];

// ---------- Asset Categories (GLPI-style grouping) ----------
export const ASSET_CATEGORIES = [
  { id: "computers", label: "Máy tính (Desktop/Laptop)", ico: "ph-desktop-tower", types: ["Desktop", "Laptop", "Laptop + Sạc"] },
  { id: "monitors", label: "Màn hình", ico: "ph-monitor", types: ["Màn hình"] },
  { id: "peripherals", label: "Thiết bị ngoại vi", ico: "ph-mouse", types: ["Bàn phím", "Chuột không dây", "Chuột có dây", "Combo Bàn phím + Chuột", "Tai nghe", "Webcam", "Camera"] },
  { id: "printers", label: "Máy in", ico: "ph-printer", types: ["Máy in"] },
  { id: "network", label: "Thiết bị mạng", ico: "ph-network", types: ["Router/Switch"] },
  { id: "phones", label: "Điện thoại", ico: "ph-device-mobile", types: ["Điện thoại"] },
  { id: "cartridges", label: "Mực in / Vật tư in", ico: "ph-drop", types: ["Mực in/Hộp mực"] },
  { id: "consumables", label: "Vật tư tiêu hao", ico: "ph-package", types: ["USB/Ổ cứng di động", "Balo/Túi laptop", "Sạc/Cáp"] },
  { id: "others", label: "Khác", ico: "ph-question", types: ["Khác"] }
];

export function getCategoryId(type) {
  const cat = ASSET_CATEGORIES.find(c => c.types.includes(type));
  return cat ? cat.id : "others";
}

export function getCategoryMeta(catId) {
  return ASSET_CATEGORIES.find(c => c.id === catId) || null;
}

// Category-specific specification fields, stored per-device in `device.attrs`
export const CATEGORY_FIELDS = {
  computers: [
    { key: "cpu", label: "CPU" },
    { key: "ram", label: "RAM" },
    { key: "storage", label: "Ổ cứng" },
    { key: "os", label: "Hệ điều hành" },
    { key: "serial", label: "Số Serial" }
  ],
  monitors: [
    { key: "screenSize", label: "Kích thước (inch)" },
    { key: "resolution", label: "Độ phân giải" },
    { key: "panelType", label: "Loại tấm nền" },
    { key: "serial", label: "Số Serial" }
  ],
  peripherals: [
    { key: "connectType", label: "Kết nối (Có dây/Không dây/Bluetooth)" },
    { key: "serial", label: "Số Serial" }
  ],
  printers: [
    { key: "printType", label: "Loại in (Laser/Phun mực)" },
    { key: "inkModel", label: "Mã mực / hộp mực dùng" },
    { key: "serial", label: "Số Serial" }
  ],
  network: [
    { key: "ip", label: "Địa chỉ IP" },
    { key: "mac", label: "Địa chỉ MAC" },
    { key: "serial", label: "Số Serial" }
  ],
  phones: [
    { key: "imei", label: "IMEI" },
    { key: "simNumber", label: "Số SIM" },
    { key: "os", label: "Hệ điều hành" }
  ],
  cartridges: [
    { key: "inkModel", label: "Mã mực" },
    { key: "printerModel", label: "Dùng cho máy in" }
  ],
  consumables: [],
  others: []
};

export const STATUS_META = {
  "Đang sử dụng": { pill: "pill-success" },
  "Trong kho": { pill: "pill-brand" },
  "Bảo trì": { pill: "pill-warning" },
  "Thanh lý": { pill: "pill-danger" }
};

// ---------- Licenses (Bản quyền phần mềm) ----------
export const LICENSE_TYPES = [
  "Vĩnh viễn (Perpetual)",
  "Thuê bao theo năm (Subscription)",
  "Thuê bao theo tháng (Subscription)",
  "Dùng thử (Trial)",
  "OEM đi kèm thiết bị",
  "Khác"
];

export const LICENSE_STATUS_META = {
  "Còn hiệu lực": { pill: "pill-success" },
  "Sắp hết hạn": { pill: "pill-warning" },
  "Hết hạn": { pill: "pill-danger" },
  "Hết chỗ": { pill: "pill-slate" }
};

export const DEFAULT_SETTINGS = {
  usefulLifeYears: 3,
  warrantyMonths: 12,
  depreciationWarnPercent: 15,
  warrantyWarnDays: 30,
  repairCostWarnPercent: 30,
  licenseExpiryWarnDays: 30,
  defaultLicenseSeats: 5,
  companyName: "Công ty TNHH Jeanic Garment",
  companyAddress: "",
  companyDept: "Phòng Công nghệ thông tin"
};

export const state = {
  devices: [],
  employees: [],
  licenses: [],
  meta: { deviceSeq: 1, employeeSeq: 1, licenseSeq: 1 },
  settings: { ...DEFAULT_SETTINGS },
  accounts: [],
  view: "dashboard",
  loaded: false
};

export const Store = {
  mode: useFirebase ? "cloud" : "local",
  async get(key) {
    if (this.mode === "cloud" && db) {
      try {
        const doc = await db.collection("jeanic_data").doc(key).get();
        return doc.exists ? { value: doc.data().dataString } : null;
      } catch (e) {
        console.error("Store get error:", e);
        return null;
      }
    }
    try {
      const v = localStorage.getItem("jeanic-" + key);
      return v === null ? null : { value: v };
    } catch (e) { return null; }
  },
  async set(key, value) {
    if (this.mode === "cloud" && db) {
      try {
        await db.collection("jeanic_data").doc(key).set({ dataString: value, updatedAt: new Date().toISOString() });
        return true;
      } catch (e) {
        console.error("Store set error:", e);
        return false;
      }
    }
    try {
      localStorage.setItem("jeanic-" + key, value);
      return true;
    } catch (e) { return false; }
  }
};

// ---------- Public QR Lookup Sync ----------
// Khi quét mã QR trên tem thiết bị, người quét (có thể không đăng nhập) sẽ được
// đưa tới trang lookup.html?id=TBxxx. Trang đó CHỈ đọc dữ liệu tối thiểu, an toàn
// từ collection "jeanic_public_devices" (không chứa toàn bộ dữ liệu công ty).
// Collection này được ghi đè tự động mỗi khi state.devices thay đổi và được lưu (persistDevices()).
// => Cần cấu hình Firestore Security Rules cho phép đọc công khai nhưng chỉ cho phép
//    ghi khi đã đăng nhập, ví dụ:
//    match /jeanic_public_devices/{deviceId} {
//      allow read: if true;
//      allow write: if request.auth != null;
//    }
export const PUBLIC_LOOKUP_COLLECTION = "jeanic_public_devices";

function buildPublicLookupPayload(d) {
  return {
    id: d.id,
    type: d.type || "",
    brand: d.brand || "",
    specs: d.specs || "",
    condition: d.condition || "",
    status: d.status || "",
    holderName: d.holderName || null,
    holderDept: d.dept || null,
    updatedAt: new Date().toISOString()
  };
}

async function syncPublicLookup() {
  if (Store.mode !== "cloud" || !db) return;
  const CHUNK = 400; // giới hạn an toàn cho 1 batch Firestore (tối đa 500 thao tác)
  try {
    for (let i = 0; i < state.devices.length; i += CHUNK) {
      const chunk = state.devices.slice(i, i + CHUNK);
      const batch = db.batch();
      chunk.forEach(d => {
        const ref = db.collection(PUBLIC_LOOKUP_COLLECTION).doc(d.id);
        batch.set(ref, buildPublicLookupPayload(d));
      });
      await batch.commit();
    }
  } catch (e) {
    console.error("Lỗi đồng bộ dữ liệu tra cứu công khai (QR):", e);
  }
}

export async function persistDevices() {
  await Store.set("devices", JSON.stringify(state.devices));
  await syncPublicLookup();
}
export async function persistEmployees() { await Store.set("employees", JSON.stringify(state.employees)); }
export async function persistMeta() { await Store.set("meta", JSON.stringify(state.meta)); }
export async function persistSettings() { await Store.set("settings", JSON.stringify(state.settings)); }
export async function persistLicenses() { await Store.set("licenses", JSON.stringify(state.licenses)); }

export async function persistAll() {
  await Promise.all([persistDevices(), persistEmployees(), persistMeta(), persistSettings(), persistLicenses()]);
}

// ---------- Device CRUD ----------
export function addDeviceRecord(deviceData, byEmail) {
  const now = new Date().toISOString();
  const device = {
    ...deviceData,
    repairs: [],
    history: [{
      date: now, type: "them_moi", label: "Thêm mới thiết bị vào hệ thống",
      condition: deviceData.condition, by: byEmail || "—", note: deviceData.note || ""
    }]
  };
  state.devices.push(device);
  state.meta.deviceSeq += 1;
  return device;
}

export function updateDeviceRecord(id, patch, byEmail, changeNote) {
  const d = state.devices.find(x => x.id === id);
  if (!d) return null;
  Object.assign(d, patch);
  if (changeNote) {
    d.history = d.history || [];
    d.history.unshift({
      date: new Date().toISOString(), type: "cap_nhat", label: "Cập nhật thông tin thiết bị",
      by: byEmail || "—", note: changeNote
    });
  }
  return d;
}

export function addRepairRecord(id, repair, byEmail) {
  const d = state.devices.find(x => x.id === id);
  if (!d) return null;
  d.repairs = d.repairs || [];
  const rec = { date: repair.date || todayISOLocal(), desc: repair.desc || "", cost: Number(repair.cost) || 0 };
  d.repairs.push(rec);
  d.history = d.history || [];
  d.history.unshift({
    date: new Date().toISOString(), type: "sua_chua", label: "Ghi nhận sửa chữa/bảo trì",
    by: byEmail || "—", note: `${rec.desc} — Chi phí: ${rec.cost.toLocaleString("vi-VN")} ₫`
  });
  return rec;
}

function todayISOLocal() { return new Date().toISOString().slice(0, 10); }

// ---------- Employee CRUD ----------
export function addEmployeeRecord(empData) {
  const emp = { ...empData };
  state.employees.push(emp);
  state.meta.employeeSeq += 1;
  return emp;
}

export function updateEmployeeRecord(id, patch) {
  const e = state.employees.find(x => x.id === id);
  if (!e) return null;
  Object.assign(e, patch);
  return e;
}

// ---------- License CRUD ----------
// A single license record can be allotted to several users at once (e.g. one
// Office 365 key covering 5 employees). `maxSeats` is the number of users it
// may legally be assigned to; `assignments` is the actual list currently
// holding a seat. Optionally each assignment can also reference a specific
// device (e.g. tying the seat to the laptop it's installed on).
export function addLicenseRecord(licData, byEmail) {
  const now = new Date().toISOString();
  const lic = {
    ...licData,
    assignments: [],
    history: [{
      date: now, type: "them_moi", label: "Thêm mới bản quyền vào hệ thống",
      by: byEmail || "—", note: licData.note || ""
    }]
  };
  state.licenses.push(lic);
  state.meta.licenseSeq = (state.meta.licenseSeq || 1) + 1;
  return lic;
}

export function updateLicenseRecord(id, patch, byEmail, changeNote) {
  const lic = state.licenses.find(x => x.id === id);
  if (!lic) return null;
  Object.assign(lic, patch);
  if (changeNote) {
    lic.history = lic.history || [];
    lic.history.unshift({
      date: new Date().toISOString(), type: "cap_nhat", label: "Cập nhật thông tin bản quyền",
      by: byEmail || "—", note: changeNote
    });
  }
  return lic;
}

export function deleteLicenseRecord(id) {
  const idx = state.licenses.findIndex(x => x.id === id);
  if (idx === -1) return false;
  state.licenses.splice(idx, 1);
  return true;
}

export function licenseSeatsUsed(lic) {
  return (lic.assignments || []).length;
}

export function licenseSeatsLeft(lic) {
  return Math.max(0, (Number(lic.maxSeats) || 0) - licenseSeatsUsed(lic));
}

// Derived status: expiry takes priority over seat availability so an admin
// always sees the most urgent problem first.
export function licenseStatus(lic) {
  if (lic.expiryDate) {
    const end = new Date(lic.expiryDate);
    const daysLeft = Math.round((end - new Date()) / 86400000);
    if (daysLeft < 0) return { key: "Hết hạn", daysLeft };
    if (daysLeft <= (state.settings.licenseExpiryWarnDays || 30)) return { key: "Sắp hết hạn", daysLeft };
  }
  if (licenseSeatsLeft(lic) <= 0 && Number(lic.maxSeats) > 0) return { key: "Hết chỗ", daysLeft: null };
  return { key: "Còn hiệu lực", daysLeft: null };
}

export function assignLicenseSeat(licenseId, { employeeId, deviceId, note }, byEmail) {
  const lic = state.licenses.find(x => x.id === licenseId);
  const emp = state.employees.find(x => x.id === employeeId);
  if (!lic || !emp) return { ok: false, message: "Không tìm thấy bản quyền hoặc nhân viên" };
  if (licenseSeatsLeft(lic) <= 0) return { ok: false, message: "Bản quyền đã cấp phát đủ số lượng cho phép" };
  if ((lic.assignments || []).some(a => a.employeeId === employeeId && (!deviceId || a.deviceId === deviceId))) {
    return { ok: false, message: "Nhân viên này đã được cấp bản quyền này rồi" };
  }
  const device = deviceId ? state.devices.find(x => x.id === deviceId) : null;
  lic.assignments = lic.assignments || [];
  const assignment = {
    assignId: "A" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000),
    employeeId: emp.id, employeeName: emp.name, dept: emp.dept,
    deviceId: device ? device.id : null, deviceLabel: device ? `${device.id} — ${device.type}` : null,
    assignedDate: new Date().toISOString().slice(0, 10),
    note: note || ""
  };
  lic.assignments.push(assignment);
  lic.history = lic.history || [];
  lic.history.unshift({
    date: new Date().toISOString(), type: "cap_phat", label: "Cấp phát cho nhân viên",
    to: emp.name, dept: emp.dept, by: byEmail || "—",
    note: (device ? `Thiết bị: ${device.id}. ` : "") + (note || "")
  });
  return { ok: true, assignment };
}

export function unassignLicenseSeat(licenseId, assignId, byEmail) {
  const lic = state.licenses.find(x => x.id === licenseId);
  if (!lic) return false;
  const idx = (lic.assignments || []).findIndex(a => a.assignId === assignId);
  if (idx === -1) return false;
  const a = lic.assignments[idx];
  lic.assignments.splice(idx, 1);
  lic.history = lic.history || [];
  lic.history.unshift({
    date: new Date().toISOString(), type: "thu_hoi_cap_phat", label: "Thu hồi cấp phát khỏi nhân viên",
    from: a.employeeName, by: byEmail || "—", note: ""
  });
  return true;
}

// ---------- Operations: handover / return / transfer ----------
export function handoverDevice(deviceId, employeeId, condition, note, byEmail) {
  const d = state.devices.find(x => x.id === deviceId);
  const emp = state.employees.find(x => x.id === employeeId);
  if (!d || !emp) return null;
  d.status = "Đang sử dụng";
  d.holderId = emp.id;
  d.holderName = emp.name;
  d.dept = emp.dept;
  if (condition) d.condition = condition;
  d.history = d.history || [];
  d.history.unshift({
    date: new Date().toISOString(), type: "ban_giao", label: "Bàn giao cho nhân viên",
    to: emp.name, dept: emp.dept, condition: d.condition, by: byEmail || "—", note: note || ""
  });
  return d;
}

export function returnDevice(deviceId, condition, note, byEmail) {
  const d = state.devices.find(x => x.id === deviceId);
  if (!d) return null;
  const fromName = d.holderName;
  d.status = "Trong kho";
  d.holderId = null;
  d.holderName = null;
  d.dept = null;
  if (condition) d.condition = condition;
  d.history = d.history || [];
  d.history.unshift({
    date: new Date().toISOString(), type: "thu_hoi", label: "Thu hồi về kho",
    from: fromName, condition: d.condition, by: byEmail || "—", note: note || ""
  });
  return d;
}

export function transferDevice(deviceId, toEmployeeId, condition, note, byEmail) {
  const d = state.devices.find(x => x.id === deviceId);
  const emp = state.employees.find(x => x.id === toEmployeeId);
  if (!d || !emp) return null;
  const fromName = d.holderName;
  d.holderId = emp.id;
  d.holderName = emp.name;
  d.dept = emp.dept;
  d.status = "Đang sử dụng";
  if (condition) d.condition = condition;
  d.history = d.history || [];
  d.history.unshift({
    date: new Date().toISOString(), type: "dieu_chuyen", label: "Điều chuyển thiết bị",
    from: fromName, to: emp.name, dept: emp.dept, condition: d.condition, by: byEmail || "—", note: note || ""
  });
  return d;
}

export function retireDevice(deviceId, note, byEmail) {
  const d = state.devices.find(x => x.id === deviceId);
  if (!d) return null;
  d.status = "Thanh lý";
  d.holderId = null;
  d.holderName = null;
  d.dept = null;
  d.history = d.history || [];
  d.history.unshift({
    date: new Date().toISOString(), type: "thanh_ly", label: "Thanh lý thiết bị",
    by: byEmail || "—", note: note || ""
  });
  return d;
}

function seedDefaults() {
  state.employees = [
    { id: "NV001", name: "Bùi Văn Hòa", dept: "IT", position: "Trưởng nhóm IT", email: "hoa.bui@jeanicgarment.com", phone: "0900000001", status: "Đang làm việc" },
    { id: "NV002", name: "Nguyễn Thị Hải", dept: "Plan (Kế hoạch)", position: "Nhân viên Kế hoạch", email: "hai.nguyen@jeanicgarment.com", phone: "0900000002", status: "Đang làm việc" }
  ];
  state.devices = [
    {
      id: "TB001", type: "Chuột không dây", brand: "EBLUE", specs: "EMS816B Mouse", condition: "Tốt",
      status: "Đang sử dụng", holderId: "NV002", holderName: "Nguyễn Thị Hải", dept: "Plan (Kế hoạch)",
      importDate: "2025-01-10", note: "", purchaseDate: "2025-01-08", purchasePrice: 250000, vendor: "Phong Vũ", invoiceNo: "HD-2025-0012",
      warrantyMonths: 12, usefulLifeYears: 2, salvageValue: 0, repairs: [],
      history: [{ date: "2025-01-10T09:00:00.000Z", type: "ban_giao", label: "Bàn giao cho nhân viên", to: "Nguyễn Thị Hải", dept: "Plan (Kế hoạch)", condition: "Tốt", by: "Bùi Văn Hòa", note: "Nhập kho và bàn giao" }]
    },
    {
      id: "TB002", type: 'Laptop 15" + Sạc', brand: "Dell", specs: "Dell Inspiron 15, i5-1355U, RAM 16GB, SSD 512GB", condition: "Tốt",
      status: "Trong kho", holderId: null, holderName: null, dept: null,
      importDate: "2025-01-10", note: "", purchaseDate: "2025-01-05", purchasePrice: 18500000, vendor: "Thế Giới Di Động", invoiceNo: "HD-2025-0007",
      warrantyMonths: 24, usefulLifeYears: 3, salvageValue: 1000000,
      repairs: [], history: []
    }
  ];
  state.licenses = [
    {
      id: "LIC001", name: "Microsoft 365 Business Standard", vendor: "Microsoft",
      type: "Thuê bao theo năm (Subscription)", licenseKey: "XXXXX-XXXXX-XXXXX-XXXXX",
      maxSeats: 5, purchaseDate: "2026-01-10", expiryDate: "2027-01-10", cost: 6000000,
      note: "Gói 5 user dùng chung cho phòng Kế hoạch", assignments: [
        { assignId: "A1", employeeId: "NV002", employeeName: "Nguyễn Thị Hải", dept: "Plan (Kế hoạch)", deviceId: null, deviceLabel: null, assignedDate: "2026-01-10", note: "" }
      ],
      history: [{ date: "2026-01-10T09:00:00.000Z", type: "them_moi", label: "Thêm mới bản quyền vào hệ thống", by: "Bùi Văn Hòa", note: "" }]
    }
  ];
  state.meta = { deviceSeq: 3, employeeSeq: 3, licenseSeq: 2 };
  state.settings = { ...DEFAULT_SETTINGS };
}

export async function loadAll() {
  const [d, e, m, s, l] = await Promise.all([
    Store.get("devices"), Store.get("employees"), Store.get("meta"), Store.get("settings"), Store.get("licenses")
  ]);
  
  if (d && e && m) {
    state.devices = JSON.parse(d.value);
    state.employees = JSON.parse(e.value);
    state.meta = JSON.parse(m.value);
    state.meta.licenseSeq = state.meta.licenseSeq || 1;
    state.settings = s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s.value) } : { ...DEFAULT_SETTINGS };
    state.licenses = l ? JSON.parse(l.value) : [];
  } else {
    seedDefaults();
    await persistAll();
  }
  state.loaded = true;
}

export async function saveGlobalLog(opType, deviceId, logEntry, printPayload, currentUserEmail) {
  const globalLog = {
    deviceId: deviceId,
    type: opType,
    date: new Date().toISOString(),
    by: currentUserEmail || "local",
    detail: logEntry,
    printData: printPayload || null
  };
  
  if (Store.mode === "cloud" && db) {
    try {
      await db.collection("jeanic_audit_logs").add(globalLog);
    } catch (e) {
      console.error("Lỗi lưu global log:", e);
    }
  } else {
    let localLogs = [];
    try {
      const stored = localStorage.getItem("jeanic-global-logs");
      if (stored) localLogs = JSON.parse(stored);
    } catch (e) {}
    localLogs.unshift(globalLog);
    localStorage.setItem("jeanic-global-logs", JSON.stringify(localLogs));
  }
}
