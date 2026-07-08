import { db, useFirebase } from './firebase-config.js';

export const DEPARTMENTS = ["Ban Giám đốc","IT","Nhân sự (HR)","Kế toán","Kinh doanh","Plan (Kế hoạch)","Cắt (Cutting)","May (Sewing)","Hoàn thiện (Finishing)","QA/QC","Kho (Warehouse)","Bảo trì (Maintenance)","Xuất nhập khẩu","Khác"];
export const CONDITIONS = ["Mới","Tốt","Khá","Trung bình","Hỏng nhẹ","Hỏng nặng"];
export const DEVICE_TYPES = ["Laptop","Laptop + Sạc","Màn hình","Bàn phím","Chuột không dây","Chuột có dây","Tai nghe","Webcam","Máy in","Router/Switch","USB/Ổ cứng di động","Balo/Túi laptop","Sạc/Cáp","Khác"];
export const BRANDS = ["Dell","HP","Lenovo","Asus","Acer","Apple","Logitech","EBLUE","Samsung","LG","Canon","TP-Link","Khác"];

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
  repairCostWarnPercent: 30
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

export async function persistDevices() { await Store.set("devices", JSON.stringify(state.devices)); }
export async function persistEmployees() { await Store.set("employees", JSON.stringify(state.employees)); }
export async function persistMeta() { await Store.set("meta", JSON.stringify(state.meta)); }
export async function persistSettings() { await Store.set("settings", JSON.stringify(state.settings)); }

export async function persistAll() {
  await Promise.all([persistDevices(), persistEmployees(), persistMeta(), persistSettings()]);
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
