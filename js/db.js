import { db, useFirebase } from './firebase-config.js';

export const DEPARTMENTS = ["Ban Giám đốc","IT","Nhân sự (HR)","Kế toán","Kinh doanh","Plan (Kế hoạch)","Cắt (Cutting)","May (Sewing)","Hoàn thiện (Finishing)","QA/QC","Kho (Warehouse)","Bảo trì (Maintenance)","Xuất nhập khẩu","Khác"];
export const CONDITIONS = ["Mới","Tốt","Khá","Trung bình","Hỏng nhẹ","Hỏng nặng"];
export const DEVICE_TYPES = [
  // Danh mục tài sản
  "Desktop","Laptop","Laptop + Sạc","Màn hình","Máy in","Router/Switch","Điện thoại",
  // Phụ kiện
  "Bàn phím","Chuột không dây","Chuột có dây","Combo Bàn phím + Chuột","Tai nghe","Loa","Webcam","Camera",
  "Balo/Túi laptop","Sạc/Cáp","Cổng chuyển đổi (Hub/Adapter)","Đế tản nhiệt laptop",
  // Linh kiện & Vật tư tiêu hao
  "Mực in/Hộp mực","USB/Ổ cứng di động","Thẻ nhớ","RAM","Ổ cứng SSD/HDD (lắp trong)","Nguồn (PSU)","Quạt tản nhiệt/Quạt chip",
  "Khác"
];
export const BRANDS = ["Dell","HP","Lenovo","Asus","Acer","Apple","Logitech","EBLUE","Samsung","LG","Canon","TP-Link","HIKVision","Kingston","Western Digital","Seagate","Corsair","Xiaomi","Khác"];

// ---------- Asset Groups & Categories ----------
// 3 nhóm lớn theo cách phân loại vận hành thực tế của công ty:
//  - Danh mục tài sản: tài sản cố định / công cụ dụng cụ chính, giá trị lớn, quản lý theo mã định danh, có khấu hao.
//  - Phụ kiện: cấp phát kèm theo người dùng để vận hành/hỗ trợ, giá trị vừa phải, tái sử dụng được cho người sau.
//  - Linh kiện & Vật tư tiêu hao: tính vào chi phí tiêu hao trực tiếp hoặc lắp cố định vào tài sản chính, hết là thay mới.
export const ASSET_GROUPS = [
  { id: "danh_muc_tai_san", label: "Danh mục tài sản", sub: "Tài sản cố định / công cụ dụng cụ chính", ico: "ph-desktop-tower" },
  { id: "phu_kien", label: "Phụ kiện", sub: "Đi kèm để vận hành hoặc hỗ trợ người dùng", ico: "ph-headset" },
  { id: "linh_kien_vat_tu", label: "Linh kiện & Vật tư tiêu hao", sub: "Tiêu hao trực tiếp hoặc lắp cố định vào tài sản chính", ico: "ph-cpu" }
];

export const ASSET_CATEGORIES = [
  // ---- Danh mục tài sản ----
  { id: "computers", group: "danh_muc_tai_san", label: "Máy tính (Desktop/Laptop)", ico: "ph-desktop-tower", types: ["Desktop", "Laptop", "Laptop + Sạc"] },
  { id: "monitors", group: "danh_muc_tai_san", label: "Màn hình", ico: "ph-monitor", types: ["Màn hình"] },
  { id: "printers", group: "danh_muc_tai_san", label: "Máy in", ico: "ph-printer", types: ["Máy in"] },
  { id: "network", group: "danh_muc_tai_san", label: "Thiết bị mạng", ico: "ph-network", types: ["Router/Switch"] },
  { id: "phones", group: "danh_muc_tai_san", label: "Điện thoại", ico: "ph-device-mobile", types: ["Điện thoại"] },

  // ---- Phụ kiện ----
  { id: "peripherals", group: "phu_kien", label: "Thiết bị ngoại vi", ico: "ph-mouse", types: ["Bàn phím", "Chuột không dây", "Chuột có dây", "Combo Bàn phím + Chuột", "Tai nghe", "Loa", "Webcam", "Camera"] },
  { id: "mobile-accessories", group: "phu_kien", label: "Phụ kiện di động / văn phòng", ico: "ph-bag", types: ["Balo/Túi laptop", "Sạc/Cáp", "Cổng chuyển đổi (Hub/Adapter)", "Đế tản nhiệt laptop"] },

  // ---- Linh kiện & Vật tư tiêu hao ----
  { id: "cartridges", group: "linh_kien_vat_tu", label: "Mực in / Vật tư in", ico: "ph-drop", types: ["Mực in/Hộp mực"] },
  { id: "storage-media", group: "linh_kien_vat_tu", label: "Thiết bị lưu trữ nhỏ", ico: "ph-usb", types: ["USB/Ổ cứng di động", "Thẻ nhớ"] },
  { id: "internal-parts", group: "linh_kien_vat_tu", label: "Linh kiện thay thế bên trong", ico: "ph-cpu", types: ["RAM", "Ổ cứng SSD/HDD (lắp trong)", "Nguồn (PSU)", "Quạt tản nhiệt/Quạt chip"] },

  // Không thuộc nhóm rõ ràng nào — xếp tạm vào Phụ kiện làm mục "khác"
  { id: "others", group: "phu_kien", label: "Khác", ico: "ph-question", types: ["Khác"] }
];

export function getAssetGroupMeta(groupId) {
  return ASSET_GROUPS.find(g => g.id === groupId) || null;
}

export function getCategoryId(type) {
  const cat = ASSET_CATEGORIES.find(c => c.types.includes(type));
  return cat ? cat.id : "others";
}

export function getCategoryMeta(catId) {
  return ASSET_CATEGORIES.find(c => c.id === catId) || null;
}

export function devicesInCategory(catId) {
  if (!catId || catId === "all") return state.devices;
  return state.devices.filter(d => getCategoryId(d.type) === catId);
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
  "mobile-accessories": [
    { key: "connectType", label: "Chuẩn cổng / kết nối" },
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
  "storage-media": [
    { key: "capacity", label: "Dung lượng" },
    { key: "connectType", label: "Chuẩn kết nối (USB-A/USB-C/…)" },
    { key: "serial", label: "Số Serial" }
  ],
  "internal-parts": [
    { key: "capacity", label: "Dung lượng / Công suất" },
    { key: "compatibleDevice", label: "Lắp cho thiết bị (Mã TB máy chính)" },
    { key: "serial", label: "Số Serial" }
  ],
  others: []
};

export const STATUS_META = {
  "Đang sử dụng": { pill: "pill-success" },
  "Trong kho": { pill: "pill-brand" },
  "Bảo trì": { pill: "pill-warning" },
  "Thanh lý": { pill: "pill-danger" }
};

export const DEFAULT_SETTINGS = {
  usefulLifeYears: 3,
  warrantyMonths: 12,
  depreciationWarnPercent: 15,
  warrantyWarnDays: 30,
  repairCostWarnPercent: 30,
  companyName: "Công ty TNHH Jeanic Garment",
  companyAddress: "",
  companyDept: "Phòng Công nghệ thông tin"
};

export const state = {
  devices: [],
  employees: [],
  meta: { deviceSeq: 1, employeeSeq: 1 },
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
    holderId: d.holderId || null,
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

export async function persistAll() {
  await Promise.all([persistDevices(), persistEmployees(), persistMeta(), persistSettings()]);
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

export function deleteDeviceRecord(id) {
  const idx = state.devices.findIndex(x => x.id === id);
  if (idx === -1) return { ok: false, reason: "Không tìm thấy thiết bị." };
  state.devices.splice(idx, 1);
  return { ok: true };
}

// ---------- Employee CRUD ----------
export function addEmployeeRecord(empData) {
  const emp = { ...empData };
  state.employees.push(emp);
  state.meta.employeeSeq += 1;
  return emp;
}

// Quét lại toàn bộ thiết bị và đồng bộ tên/bộ phận người giữ theo đúng hồ sơ
// nhân viên hiện tại (dựa theo holderId — nguồn dữ liệu đáng tin cậy nhất).
// Dùng để sửa các bản ghi cũ bị lệch tên do đổi tên nhân viên TRƯỚC KHI có
// tính năng tự đồng bộ (updateEmployeeRecord ở trên chỉ xử lý cho các lần
// đổi tên SAU khi tính năng này tồn tại).
export function resyncHolderNamesFromEmployees() {
  let devicesTouched = 0;

  state.devices.forEach(d => {
    if (d.holderId) {
      const emp = state.employees.find(x => x.id === d.holderId);
      if (emp) {
        let touched = false;
        if (d.holderName !== emp.name) { d.holderName = emp.name; touched = true; }
        if (d.dept !== emp.dept) { d.dept = emp.dept; touched = true; }
        if (touched) devicesTouched++;
      }
    }
  });

  // Lịch sử bàn giao/thu hồi/điều chuyển cũ không lưu Mã NV kèm theo (chỉ lưu
  // tên dạng chuỗi), nên không thể tự đối chiếu an toàn ở đây — nếu có dòng
  // lịch sử cũ còn hiển thị tên sai, vui lòng sửa tên nhân viên một lần nữa
  // (đổi rồi đổi lại) để kích hoạt việc tự đồng bộ theo tên.
  return { devicesTouched };
}

export function updateEmployeeRecord(id, patch) {
  const e = state.employees.find(x => x.id === id);
  if (!e) return null;

  const oldName = e.name;
  const oldDept = e.dept;
  Object.assign(e, patch);

  const nameChanged = patch.name !== undefined && patch.name !== oldName;
  const deptChanged = patch.dept !== undefined && patch.dept !== oldDept;
  let devicesTouched = 0;

  // Đồng bộ tên/bộ phận đã đổi xuống dữ liệu thiết bị: thiết bị đang được
  // nhân viên này giữ (holderName/dept hiện tại), và các dòng lịch sử
  // bàn giao/thu hồi/điều chuyển trước đây (to/from) — vì các nơi này lưu
  // tên dạng chuỗi tại thời điểm phát sinh, không tự cập nhật theo hồ sơ
  // nhân viên. Lưu ý: nếu có 2 nhân viên trùng tên hệt nhau trước khi đổi,
  // lịch sử của cả hai đều có thể bị đổi tên theo do chỉ so khớp theo tên.
  if (nameChanged || deptChanged) {
    state.devices.forEach(d => {
      let touched = false;
      // Khớp theo holderId là chính, nhưng nếu vì lý do gì đó holderId của
      // thiết bị bị lệch/thiếu (không trỏ đúng nhân viên), vẫn nhận diện
      // được qua tên cũ đang lưu ở holderName, để tự "chữa" luôn liên kết.
      const matchesHolder = d.holderId === id || (oldName && d.holderName === oldName);
      if (matchesHolder) {
        if (d.holderId !== id) d.holderId = id; // tự sửa liên kết bị lệch
        if (nameChanged) { d.holderName = e.name; touched = true; }
        if (deptChanged) { d.dept = e.dept; touched = true; }
      }
      if (nameChanged && Array.isArray(d.history)) {
        d.history.forEach(h => {
          if (h.to === oldName) { h.to = e.name; touched = true; }
          if (h.from === oldName) { h.from = e.name; touched = true; }
        });
      }
      if (touched) devicesTouched++;
    });
  }

  return { employee: e, devicesTouched };
}

export function deleteEmployeeRecord(id) {
  const idx = state.employees.findIndex(x => x.id === id);
  if (idx === -1) return { ok: false, reason: "Không tìm thấy nhân viên." };
  const holding = state.devices.filter(d => d.holderId === id && d.status === "Đang sử dụng");
  if (holding.length > 0) {
    return {
      ok: false,
      reason: `Không thể xoá — nhân viên đang giữ ${holding.length} thiết bị (${holding.map(d => d.id).join(", ")}). Vui lòng thu hồi thiết bị trước khi xoá nhân viên.`
    };
  }
  state.employees.splice(idx, 1);
  return { ok: true };
}

// ---------- Duplicate detection ----------
// Chuẩn hoá chuỗi để so sánh không phân biệt hoa/thường và khoảng trắng thừa.
function normKey(s) {
  return (s === undefined || s === null) ? "" : String(s).trim().toLowerCase();
}
function normPhone(s) {
  return (s === undefined || s === null) ? "" : String(s).replace(/\D/g, "");
}

// Kiểm tra trùng lặp nhân viên theo Email, Số điện thoại (các định danh duy nhất),
// và theo cặp Họ tên + Bộ phận (rất có thể là nhập trùng cùng một người).
// excludeId: bỏ qua chính bản ghi đang sửa (trường hợp cập nhật).
export function findDuplicateEmployee(payload, excludeId) {
  const name = normKey(payload.name);
  const dept = normKey(payload.dept);
  const email = normKey(payload.email);
  const phone = normPhone(payload.phone);

  for (const e of state.employees) {
    if (excludeId && e.id === excludeId) continue;

    if (email && normKey(e.email) === email) {
      return { record: e, field: "email", message: `Email "${payload.email}" đã được dùng cho nhân viên ${e.id} — ${e.name}.` };
    }
    const ePhone = normPhone(e.phone);
    if (phone && ePhone && ePhone === phone) {
      return { record: e, field: "phone", message: `Số điện thoại "${payload.phone}" đã được dùng cho nhân viên ${e.id} — ${e.name}.` };
    }
    if (name && dept && normKey(e.name) === name && normKey(e.dept) === dept) {
      return { record: e, field: "name", message: `Nhân viên "${payload.name}" — bộ phận "${payload.dept}" đã tồn tại (mã ${e.id}). Có thể bạn đã nhập trùng.` };
    }
  }
  return null;
}

// Kiểm tra trùng lặp thiết bị theo các định danh duy nhất trong "Thông số chuyên biệt"
// (Số Serial / IMEI / MAC — tuỳ nhóm tài sản), và theo Số hoá đơn + Thông số kỹ thuật
// giống hệt (rất có thể là nhập trùng cùng một lần mua).
export function findDuplicateDevice(payload, excludeId) {
  const uniqueAttrKeys = ["serial", "imei", "mac"];
  const attrs = payload.attrs || {};

  for (const key of uniqueAttrKeys) {
    const val = normKey(attrs[key]);
    if (!val) continue;
    for (const d of state.devices) {
      if (excludeId && d.id === excludeId) continue;
      if (normKey(d.attrs && d.attrs[key]) === val) {
        const labelMap = { serial: "Số Serial", imei: "IMEI", mac: "Địa chỉ MAC" };
        return { record: d, field: key, message: `${labelMap[key]} "${attrs[key]}" đã tồn tại ở thiết bị ${d.id} — ${d.type}.` };
      }
    }
  }

  const invoiceNo = normKey(payload.invoiceNo);
  const specs = normKey(payload.specs);
  if (invoiceNo && specs) {
    const type = normKey(payload.type);
    const brand = normKey(payload.brand);
    const payloadHasUniqueId = uniqueAttrKeys.some(k => normKey(attrs[k]));
    for (const d of state.devices) {
      if (excludeId && d.id === excludeId) continue;
      if (normKey(d.invoiceNo) === invoiceNo && normKey(d.specs) === specs && normKey(d.type) === type && normKey(d.brand) === brand) {
        // Nếu thiết bị mới có Serial/IMEI/MAC riêng (khác với thiết bị đang so sánh), đây là
        // một đơn vị hợp lệ mua cùng đợt (VD: nhiều bàn phím/chuột giống hệt cùng 1 hoá đơn),
        // không phải nhập trùng — bỏ qua thiết bị này và tiếp tục kiểm tra các thiết bị khác.
        if (payloadHasUniqueId) {
          const distinguishable = uniqueAttrKeys.some(k => {
            const pv = normKey(attrs[k]);
            const dv = normKey(d.attrs && d.attrs[k]);
            return pv && dv && pv !== dv;
          });
          if (distinguishable) continue;
        }
        return { record: d, field: "invoice", message: `Thiết bị với Số hoá đơn "${payload.invoiceNo}" và thông số kỹ thuật giống hệt đã tồn tại (mã ${d.id}). Có thể bạn đã nhập trùng.` };
      }
    }
  }
  return null;
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
  state.meta = { deviceSeq: 3, employeeSeq: 3 };
  state.settings = { ...DEFAULT_SETTINGS };
}

export async function loadAll() {
  const [d, e, m, s] = await Promise.all([
    Store.get("devices"), Store.get("employees"), Store.get("meta"), Store.get("settings")
  ]);
  
  if (d && e && m) {
    state.devices = JSON.parse(d.value);
    state.employees = JSON.parse(e.value);
    state.meta = JSON.parse(m.value);
    state.settings = s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s.value) } : { ...DEFAULT_SETTINGS };
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
