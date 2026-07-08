import { state, DEPARTMENTS, CONDITIONS, DEVICE_TYPES, BRANDS, STATUS_META } from './db.js';
import {
  addDeviceRecord, updateDeviceRecord, addEmployeeRecord, updateEmployeeRecord,
  handoverDevice, returnDevice, transferDevice, retireDevice, addRepairRecord,
  persistDevices, persistEmployees, persistMeta, saveGlobalLog
} from './db.js';
import { nextDeviceId, nextEmployeeId, todayISO, esc, fmtVND } from './helpers.js';
import { openModal, closeModal, toast } from './ui.js';
import { currentUser } from './auth.js';

function opt(list, selected) {
  return list.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join("");
}

// ---------- Device Form (Add / Edit) ----------
export function openDeviceForm(id, refresh) {
  const editing = !!id;
  const d = editing ? state.devices.find(x => x.id === id) : null;
  if (editing && !d) { toast("Không tìm thấy thiết bị", "err"); return; }

  const body = `
    <div class="field-row">
      <div class="field">
        <label>Loại thiết bị</label>
        <select id="fType">
          ${opt(DEVICE_TYPES, d?.type)}
        </select>
      </div>
      <div class="field">
        <label>Thương hiệu</label>
        <select id="fBrand">
          ${opt(BRANDS, d?.brand)}
        </select>
      </div>
    </div>
    <div class="field">
      <label>Thông số kỹ thuật</label>
      <textarea id="fSpecs" placeholder="VD: Dell Inspiron 15, i5-1355U, RAM 16GB, SSD 512GB">${esc(d?.specs || "")}</textarea>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Tình trạng</label>
        <select id="fCondition">${opt(CONDITIONS, d?.condition || "Mới")}</select>
      </div>
      <div class="field">
        <label>Ngày nhập kho</label>
        <input type="date" id="fImportDate" value="${d?.importDate || todayISO()}">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Ngày mua</label>
        <input type="date" id="fPurchaseDate" value="${d?.purchaseDate || todayISO()}">
      </div>
      <div class="field">
        <label>Giá mua (₫)</label>
        <input type="number" id="fPrice" value="${d?.purchasePrice || ''}" min="0">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Nhà cung cấp</label>
        <input type="text" id="fVendor" value="${esc(d?.vendor || '')}">
      </div>
      <div class="field">
        <label>Số hoá đơn</label>
        <input type="text" id="fInvoice" value="${esc(d?.invoiceNo || '')}">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Bảo hành (tháng)</label>
        <input type="number" id="fWarranty" value="${d?.warrantyMonths ?? state.settings.warrantyMonths}" min="0">
      </div>
      <div class="field">
        <label>Vòng đời sử dụng (năm)</label>
        <input type="number" id="fLife" value="${d?.usefulLifeYears ?? state.settings.usefulLifeYears}" min="0.5" step="0.5">
      </div>
    </div>
    <div class="field">
      <label>Giá trị thanh lý ước tính (₫)</label>
      <input type="number" id="fSalvage" value="${d?.salvageValue ?? 0}" min="0">
    </div>
    <div class="field">
      <label>Ghi chú</label>
      <textarea id="fNote">${esc(d?.note || "")}</textarea>
    </div>
  `;

  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" onclick="app.submitDeviceForm(${editing ? `'${id}'` : 'null'})"><i class="ph ph-floppy-disk"></i> Lưu</button>
  `;

  openModal(editing ? `Sửa thiết bị — ${esc(id)}` : "Thêm thiết bị mới", body, foot);
  window.__deviceFormRefresh = refresh;
}

export async function submitDeviceForm(id) {
  const payload = {
    type: document.getElementById("fType").value,
    brand: document.getElementById("fBrand").value,
    specs: document.getElementById("fSpecs").value.trim(),
    condition: document.getElementById("fCondition").value,
    importDate: document.getElementById("fImportDate").value,
    purchaseDate: document.getElementById("fPurchaseDate").value,
    purchasePrice: Number(document.getElementById("fPrice").value) || 0,
    vendor: document.getElementById("fVendor").value.trim(),
    invoiceNo: document.getElementById("fInvoice").value.trim(),
    warrantyMonths: Number(document.getElementById("fWarranty").value) || 0,
    usefulLifeYears: Number(document.getElementById("fLife").value) || 1,
    salvageValue: Number(document.getElementById("fSalvage").value) || 0,
    note: document.getElementById("fNote").value.trim()
  };

  const byEmail = currentUser?.email;

  if (id) {
    updateDeviceRecord(id, payload, byEmail, "Cập nhật thông tin thiết bị");
    await persistDevices();
    toast("Đã cập nhật thiết bị");
  } else {
    const newDevice = { id: nextDeviceId(), status: "Trong kho", holderId: null, holderName: null, dept: null, ...payload };
    addDeviceRecord(newDevice, byEmail);
    await persistDevices();
    await persistMeta();
    toast("Đã thêm thiết bị mới");
  }
  closeModal();
  if (window.__deviceFormRefresh) window.__deviceFormRefresh();
}

// ---------- Employee Form (Add / Edit) ----------
export function openEmployeeForm(id, refresh) {
  const editing = !!id;
  const e = editing ? state.employees.find(x => x.id === id) : null;
  if (editing && !e) { toast("Không tìm thấy nhân viên", "err"); return; }

  const body = `
    <div class="field">
      <label>Họ và tên</label>
      <input type="text" id="fName" value="${esc(e?.name || '')}">
    </div>
    <div class="field-row">
      <div class="field">
        <label>Bộ phận</label>
        <select id="fDept">${opt(DEPARTMENTS, e?.dept)}</select>
      </div>
      <div class="field">
        <label>Chức vụ</label>
        <input type="text" id="fPosition" value="${esc(e?.position || '')}">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Email</label>
        <input type="email" id="fEmail" value="${esc(e?.email || '')}">
      </div>
      <div class="field">
        <label>Số điện thoại</label>
        <input type="text" id="fPhone" value="${esc(e?.phone || '')}">
      </div>
    </div>
    <div class="field">
      <label>Trạng thái</label>
      <select id="fStatus">
        ${opt(["Đang làm việc", "Đã nghỉ việc"], e?.status || "Đang làm việc")}
      </select>
    </div>
  `;

  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" onclick="app.submitEmployeeForm(${editing ? `'${id}'` : 'null'})"><i class="ph ph-floppy-disk"></i> Lưu</button>
  `;

  openModal(editing ? `Sửa nhân viên — ${esc(id)}` : "Thêm nhân viên mới", body, foot);
  window.__employeeFormRefresh = refresh;
}

export async function submitEmployeeForm(id) {
  const name = document.getElementById("fName").value.trim();
  if (!name) { toast("Vui lòng nhập họ tên", "err"); return; }

  const payload = {
    name,
    dept: document.getElementById("fDept").value,
    position: document.getElementById("fPosition").value.trim(),
    email: document.getElementById("fEmail").value.trim(),
    phone: document.getElementById("fPhone").value.trim(),
    status: document.getElementById("fStatus").value
  };

  if (id) {
    updateEmployeeRecord(id, payload);
    await persistEmployees();
    toast("Đã cập nhật nhân viên");
  } else {
    const newEmp = { id: nextEmployeeId(), ...payload };
    addEmployeeRecord(newEmp);
    await persistEmployees();
    await persistMeta();
    toast("Đã thêm nhân viên mới");
  }
  closeModal();
  if (window.__employeeFormRefresh) window.__employeeFormRefresh();
}

// ---------- Operations Form (handover / return / transfer / retire) ----------
const OPS_META = {
  handover: { title: "Bàn giao thiết bị", verb: "Bàn giao" },
  return: { title: "Thu hồi thiết bị", verb: "Thu hồi" },
  transfer: { title: "Điều chuyển thiết bị", verb: "Điều chuyển" },
  retire: { title: "Thanh lý thiết bị", verb: "Thanh lý" }
};

export function openOpsForm(type, refresh) {
  const meta = OPS_META[type];
  if (!meta) return;

  let deviceOptions;
  if (type === "handover") {
    deviceOptions = state.devices.filter(d => d.status === "Trong kho");
  } else if (type === "return" || type === "transfer") {
    deviceOptions = state.devices.filter(d => d.status === "Đang sử dụng");
  } else {
    deviceOptions = state.devices.filter(d => d.status !== "Thanh lý");
  }

  if (deviceOptions.length === 0) {
    toast("Không có thiết bị phù hợp cho nghiệp vụ này", "err");
    return;
  }

  const activeEmployees = state.employees.filter(e => e.status !== "Đã nghỉ việc");

  const deviceSelect = `
    <div class="field">
      <label>Thiết bị</label>
      <select id="opDevice">
        ${deviceOptions.map(d => `<option value="${d.id}">${esc(d.id)} — ${esc(d.type)} (${esc(d.holderName || "Trong kho")})</option>`).join("")}
      </select>
    </div>
  `;

  const employeeSelect = (label, elId) => `
    <div class="field">
      <label>${label}</label>
      <select id="${elId}">
        ${activeEmployees.map(e => `<option value="${e.id}">${esc(e.id)} — ${esc(e.name)} (${esc(e.dept || "")})</option>`).join("")}
      </select>
    </div>
  `;

  let body = deviceSelect;
  if (type === "handover") body += employeeSelect("Bàn giao cho nhân viên", "opEmployee");
  if (type === "transfer") body += employeeSelect("Chuyển đến nhân viên", "opEmployee");

  if (type !== "retire") {
    body += `
      <div class="field">
        <label>Tình trạng thiết bị</label>
        <select id="opCondition">${opt(CONDITIONS, "Tốt")}</select>
      </div>
    `;
  }

  body += `
    <div class="field">
      <label>Ghi chú</label>
      <textarea id="opNote" placeholder="Ghi chú thêm (không bắt buộc)"></textarea>
    </div>
  `;

  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" onclick="app.submitOpsForm('${type}')"><i class="ph ph-check"></i> ${meta.verb}</button>
  `;

  openModal(meta.title, body, foot);
  window.__opsFormRefresh = refresh;
}

export async function submitOpsForm(type) {
  const deviceId = document.getElementById("opDevice").value;
  const note = document.getElementById("opNote").value.trim();
  const byEmail = currentUser?.email;
  let result = null;
  let printPayload = null;

  if (type === "handover") {
    const empId = document.getElementById("opEmployee").value;
    const condition = document.getElementById("opCondition").value;
    result = handoverDevice(deviceId, empId, condition, note, byEmail);
  } else if (type === "return") {
    const condition = document.getElementById("opCondition").value;
    result = returnDevice(deviceId, condition, note, byEmail);
  } else if (type === "transfer") {
    const empId = document.getElementById("opEmployee").value;
    const condition = document.getElementById("opCondition").value;
    result = transferDevice(deviceId, empId, condition, note, byEmail);
  } else if (type === "retire") {
    result = retireDevice(deviceId, note, byEmail);
  }

  if (!result) { toast("Có lỗi xảy ra, vui lòng thử lại", "err"); return; }

  await persistDevices();
  const opType = { handover: "ban_giao", return: "thu_hoi", transfer: "dieu_chuyen", retire: "thanh_ly" }[type];
  await saveGlobalLog(opType, deviceId, result.history[0], printPayload, byEmail);

  toast(`${OPS_META[type].verb} thành công — ${deviceId}`);
  closeModal();
  if (window.__opsFormRefresh) window.__opsFormRefresh();
}

// ---------- Repair Form ----------
export function openRepairForm(deviceId, refresh) {
  const body = `
    <div class="field">
      <label>Ngày sửa chữa</label>
      <input type="date" id="rDate" value="${todayISO()}">
    </div>
    <div class="field">
      <label>Nội dung sửa chữa</label>
      <textarea id="rDesc" placeholder="VD: Thay pin, vệ sinh quạt tản nhiệt…"></textarea>
    </div>
    <div class="field">
      <label>Chi phí (₫)</label>
      <input type="number" id="rCost" value="0" min="0">
    </div>
  `;
  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" onclick="app.submitRepairForm('${deviceId}')"><i class="ph ph-floppy-disk"></i> Lưu</button>
  `;
  openModal("Ghi nhận sửa chữa", body, foot);
  window.__repairFormRefresh = refresh;
}

export async function submitRepairForm(deviceId) {
  const date = document.getElementById("rDate").value;
  const desc = document.getElementById("rDesc").value.trim();
  const cost = Number(document.getElementById("rCost").value) || 0;
  if (!desc) { toast("Vui lòng nhập nội dung sửa chữa", "err"); return; }

  addRepairRecord(deviceId, { date, desc, cost }, currentUser?.email);
  await persistDevices();
  toast("Đã ghi nhận sửa chữa");
  closeModal();
  if (window.__repairFormRefresh) window.__repairFormRefresh();
}
