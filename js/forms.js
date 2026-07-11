import { state, DEPARTMENTS, CONDITIONS, DEVICE_TYPES, BRANDS, STATUS_META, ASSET_CATEGORIES, ASSET_GROUPS, CATEGORY_FIELDS, getCategoryId, getCategoryMeta } from './db.js';
import {
  addDeviceRecord, updateDeviceRecord, addEmployeeRecord, updateEmployeeRecord,
  handoverDevice, returnDevice, transferDevice, retireDevice, addRepairRecord,
  persistDevices, persistEmployees, persistMeta, saveGlobalLog,
  findDuplicateEmployee, findDuplicateDevice, deleteDeviceRecord, deleteEmployeeRecord
} from './db.js';
import { nextDeviceId, nextEmployeeId, todayISO, esc, fmtVND } from './helpers.js';
import { openModal, closeModal, toast } from './ui.js';
import { currentUser } from './auth.js';
import { openReceiptPreview } from './print.js';

function opt(list, selected) {
  return list.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join("");
}

function typeOptionsGrouped(selected) {
  return ASSET_GROUPS.map(g => {
    const cats = ASSET_CATEGORIES.filter(c => c.group === g.id);
    return cats.map(c => `
      <optgroup label="${esc(g.label)} — ${esc(c.label)}">
        ${c.types.map(t => `<option value="${esc(t)}" ${t === selected ? 'selected' : ''}>${esc(t)}</option>`).join("")}
      </optgroup>
    `).join("");
  }).join("");
}

function attrFieldsHTML(type, attrs) {
  const catId = getCategoryId(type);
  const fields = CATEGORY_FIELDS[catId] || [];
  if (fields.length === 0) {
    return `<div class="attrs-empty">Nhóm tài sản này không có thông số chuyên biệt.</div>`;
  }
  return `
    <label class="attrs-label">Thông số chuyên biệt — ${esc(getCategoryMeta(catId)?.label || "")}</label>
    <div class="field-row" style="flex-wrap:wrap;">
      ${fields.map(f => `
        <div class="field" style="min-width:180px; flex:1;">
          <label>${esc(f.label)}</label>
          <input type="text" data-attr-key="${f.key}" class="attr-input" value="${esc((attrs && attrs[f.key]) || '')}">
        </div>
      `).join("")}
    </div>
  `;
}

export function updateDeviceFormAttrs() {
  const typeEl = document.getElementById("fType");
  const wrap = document.getElementById("fAttrsWrap");
  if (!typeEl || !wrap) return;
  wrap.innerHTML = attrFieldsHTML(typeEl.value, null);
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
        <select id="fType" onchange="app.updateDeviceFormAttrs()">
          ${typeOptionsGrouped(d?.type)}
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
    <div class="field attrs-block" id="fAttrsWrap">
      ${attrFieldsHTML(d?.type || DEVICE_TYPES[0], d?.attrs)}
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
  const attrs = {};
  document.querySelectorAll('#fAttrsWrap .attr-input').forEach(inp => {
    const key = inp.dataset.attrKey;
    if (key) attrs[key] = inp.value.trim();
  });

  const payload = {
    type: document.getElementById("fType").value,
    brand: document.getElementById("fBrand").value,
    specs: document.getElementById("fSpecs").value.trim(),
    attrs,
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

  const dup = findDuplicateDevice(payload, id || null);
  if (dup) { toast(`⚠️ Trùng dữ liệu: ${dup.message}`, "err"); return; }

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

// ---------- Device Delete ----------
export async function deleteDevice(id, refresh) {
  const d = state.devices.find(x => x.id === id);
  if (!d) { toast("Không tìm thấy thiết bị", "err"); return; }

  const body = `
    <p>Bạn có chắc chắn muốn <b>xoá vĩnh viễn</b> thiết bị <b>${esc(d.id)} — ${esc(d.type)}</b> (${esc(d.brand)})?</p>
    <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">
      Toàn bộ lịch sử bàn giao, sửa chữa của thiết bị này sẽ bị xoá và không thể khôi phục.
      ${d.status === "Đang sử dụng" ? `<br><b style="color:#F87171;">Lưu ý: thiết bị này đang được bàn giao cho ${esc(d.holderName || "")}.</b>` : ""}
    </p>
  `;
  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-danger" onclick="app.confirmDeleteDevice('${id}')"><i class="ph ph-trash"></i> Xoá vĩnh viễn</button>
  `;
  openModal("Xác nhận xoá thiết bị", body, foot);
  window.__deviceFormRefresh = refresh;
}

export async function confirmDeleteDevice(id) {
  const result = deleteDeviceRecord(id);
  if (!result.ok) { toast(result.reason, "err"); closeModal(); return; }
  await persistDevices();
  toast("Đã xoá thiết bị");
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

  const dup = findDuplicateEmployee(payload, id || null);
  if (dup) { toast(`⚠️ Trùng dữ liệu: ${dup.message}`, "err"); return; }

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

// ---------- Employee Delete ----------
export async function deleteEmployee(id, refresh) {
  const e = state.employees.find(x => x.id === id);
  if (!e) { toast("Không tìm thấy nhân viên", "err"); return; }

  const holding = state.devices.filter(d => d.holderId === id && d.status === "Đang sử dụng");

  const body = `
    <p>Bạn có chắc chắn muốn <b>xoá vĩnh viễn</b> nhân viên <b>${esc(e.id)} — ${esc(e.name)}</b>?</p>
    ${holding.length > 0 ? `
      <p style="color:#F87171; font-size:13px; margin-top:8px;">
        Nhân viên này đang giữ ${holding.length} thiết bị (${holding.map(d => esc(d.id)).join(", ")}).
        Vui lòng <b>thu hồi thiết bị</b> trước khi xoá nhân viên.
      </p>
    ` : `
      <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Hành động này không thể khôi phục.</p>
    `}
  `;
  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-danger" ${holding.length > 0 ? "disabled" : ""} onclick="app.confirmDeleteEmployee('${id}')"><i class="ph ph-trash"></i> Xoá vĩnh viễn</button>
  `;
  openModal("Xác nhận xoá nhân viên", body, foot);
  window.__employeeFormRefresh = refresh;
}

export async function confirmDeleteEmployee(id) {
  const result = deleteEmployeeRecord(id);
  if (!result.ok) { toast(result.reason, "err"); closeModal(); return; }
  await persistEmployees();
  toast("Đã xoá nhân viên");
  closeModal();
  if (window.__employeeFormRefresh) window.__employeeFormRefresh();
}

// ---------- Operations Form (handover / return / transfer / retire) ----------
// Hỗ trợ chọn NHIỀU thiết bị cùng lúc cho 1 người (VD: bàn giao laptop + màn hình +
// combo bàn phím chuột trong 1 lần thao tác, in ra 1 biên bản duy nhất liệt kê đủ thiết bị).
const OPS_META = {
  handover: { title: "Bàn giao thiết bị", verb: "Bàn giao" },
  return: { title: "Thu hồi thiết bị", verb: "Thu hồi" },
  transfer: { title: "Điều chuyển thiết bị", verb: "Điều chuyển" },
  retire: { title: "Thanh lý thiết bị", verb: "Thanh lý" }
};

function opsDeviceOptions(type, holderId) {
  let list;
  if (type === "handover") {
    list = state.devices.filter(d => d.status === "Trong kho");
  } else if (type === "return" || type === "transfer") {
    list = state.devices.filter(d => d.status === "Đang sử dụng");
    if (holderId) list = list.filter(d => d.holderId === holderId);
  } else {
    list = state.devices.filter(d => d.status !== "Thanh lý");
  }
  return list;
}

function deviceChecklistRowHTML(d, withCondition) {
  const searchKey = `${d.id} ${d.type} ${d.brand} ${d.holderName || ""}`.toLowerCase();
  return `
    <label class="device-check-row" data-search="${esc(searchKey)}">
      <input type="checkbox" class="op-device-chk" value="${esc(d.id)}">
      <div class="device-check-info">
        <div class="cell-title">${esc(d.id)} — ${esc(d.type)}</div>
        <div class="cell-sub">${esc(d.brand)}${d.holderName ? " · " + esc(d.holderName) : ""}${d.dept ? " · " + esc(d.dept) : ""}</div>
      </div>
      ${withCondition ? `
        <select class="op-device-condition" data-device-id="${esc(d.id)}" onclick="event.stopPropagation()">
          ${opt(CONDITIONS, d.condition || "Tốt")}
        </select>` : ""}
    </label>
  `;
}

function deviceChecklistHTML(list, withCondition) {
  if (list.length === 0) {
    return `<div class="attrs-empty">Không có thiết bị phù hợp.</div>`;
  }
  return `
    <div class="device-checklist-toolbar">
      <div class="input-wrap" style="flex:1;">
        <i class="ph ph-magnifying-glass"></i>
        <input type="search" placeholder="Tìm theo mã TB, loại, thương hiệu…" oninput="app.filterOpsDeviceList(this.value)">
      </div>
      <label class="select-all-chk">
        <input type="checkbox" onchange="app.toggleAllOpsDevices(this.checked)"> Chọn tất cả
      </label>
    </div>
    <div class="device-checklist">
      ${list.map(d => deviceChecklistRowHTML(d, withCondition)).join("")}
    </div>
  `;
}

// Dựng lại danh sách checklist khi người dùng đổi nhân viên nguồn (thu hồi/điều chuyển)
export function refreshOpsDeviceChecklist(type) {
  const holderSel = document.getElementById("opSourceEmployee");
  const holderId = holderSel ? holderSel.value : null;
  const list = opsDeviceOptions(type, holderId || null);
  const wrap = document.getElementById("opsDeviceListWrap");
  if (wrap) wrap.innerHTML = deviceChecklistHTML(list, type !== "retire");
}

export function filterOpsDeviceList(q) {
  q = (q || "").toLowerCase();
  document.querySelectorAll("#opsDeviceListWrap .device-check-row").forEach(row => {
    const hay = row.dataset.search || "";
    row.style.display = hay.includes(q) ? "" : "none";
  });
}

export function toggleAllOpsDevices(checked) {
  document.querySelectorAll('#opsDeviceListWrap .device-check-row').forEach(row => {
    if (row.style.display === "none") return;
    const cb = row.querySelector(".op-device-chk");
    if (cb) cb.checked = checked;
  });
}

export function openOpsForm(type, refresh) {
  const meta = OPS_META[type];
  if (!meta) return;

  const activeEmployees = state.employees.filter(e => e.status !== "Đã nghỉ việc");
  const holdersWithDevices = (type === "return" || type === "transfer")
    ? activeEmployees.filter(e => state.devices.some(d => d.holderId === e.id && d.status === "Đang sử dụng"))
    : activeEmployees;

  const employeeSelect = (label, elId, list, extraAttrs) => `
    <div class="field">
      <label>${label}</label>
      <select id="${elId}" ${extraAttrs || ""}>
        ${list.map(e => `<option value="${e.id}">${esc(e.id)} — ${esc(e.name)} (${esc(e.dept || "")})</option>`).join("")}
      </select>
    </div>
  `;

  let body = "";

  if (type === "handover") {
    body += employeeSelect("Bàn giao cho nhân viên", "opEmployee", activeEmployees);
  } else if (type === "return" || type === "transfer") {
    if (holdersWithDevices.length === 0) {
      toast("Không có nhân viên nào đang giữ thiết bị để thực hiện nghiệp vụ này", "err");
      return;
    }
    body += employeeSelect(
      type === "return" ? "Thu hồi từ nhân viên" : "Điều chuyển từ nhân viên (bên giao)",
      "opSourceEmployee", holdersWithDevices, `onchange="app.refreshOpsDeviceChecklist('${type}')"`
    );
  }

  const initialHolderId = (type === "return" || type === "transfer") ? holdersWithDevices[0]?.id : null;
  const initialList = opsDeviceOptions(type, initialHolderId);

  if ((type === "return" || type === "transfer") && initialList.length === 0) {
    toast("Nhân viên này hiện không có thiết bị đang sử dụng", "err");
  }

  body += `
    <div class="field">
      <label>Thiết bị (có thể chọn nhiều — VD: laptop + màn hình + combo bàn phím chuột)</label>
      <div id="opsDeviceListWrap">${deviceChecklistHTML(initialList, type !== "retire")}</div>
    </div>
  `;

  if (type === "transfer") {
    body += employeeSelect("Chuyển đến nhân viên (bên nhận)", "opEmployee", activeEmployees);
  }

  body += `
    <div class="field">
      <label>Ghi chú chung (áp dụng cho toàn bộ thiết bị đã chọn)</label>
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

function getSelectedOpsDevices() {
  const boxes = Array.from(document.querySelectorAll("#opsDeviceListWrap .op-device-chk:checked"));
  return boxes.map(cb => {
    const condSel = document.querySelector(`#opsDeviceListWrap .op-device-condition[data-device-id="${CSS.escape(cb.value)}"]`);
    return { id: cb.value, condition: condSel ? condSel.value : null };
  });
}

export async function submitOpsForm(type) {
  const selected = getSelectedOpsDevices();
  if (selected.length === 0) { toast("Vui lòng chọn ít nhất 1 thiết bị", "err"); return; }

  const note = document.getElementById("opNote").value.trim();
  const byEmail = currentUser?.email;

  let empId = null, emp = null;
  if (type === "handover" || type === "transfer") {
    empId = document.getElementById("opEmployee").value;
    emp = state.employees.find(x => x.id === empId);
    if (!emp) { toast("Không tìm thấy nhân viên", "err"); return; }
  }

  const opType = { handover: "ban_giao", return: "thu_hoi", transfer: "dieu_chuyen", retire: "thanh_ly" }[type];
  const receiptDevices = [];
  let from = null, to = null;
  let okCount = 0;

  for (const sel of selected) {
    const deviceBefore = state.devices.find(x => x.id === sel.id);
    if (!deviceBefore) continue;

    let result = null;
    let devFrom = null, devTo = null;

    if (type === "handover") {
      result = handoverDevice(sel.id, empId, sel.condition, note, byEmail);
      devTo = { name: emp.name, dept: emp.dept, position: emp.position };
      to = devTo;
    } else if (type === "return") {
      const fromEmp = state.employees.find(x => x.id === deviceBefore.holderId);
      devFrom = deviceBefore.holderName ? { name: deviceBefore.holderName, dept: deviceBefore.dept, position: fromEmp?.position } : null;
      result = returnDevice(sel.id, sel.condition, note, byEmail);
      from = devFrom;
    } else if (type === "transfer") {
      const fromEmp = state.employees.find(x => x.id === deviceBefore.holderId);
      devFrom = deviceBefore.holderName ? { name: deviceBefore.holderName, dept: deviceBefore.dept, position: fromEmp?.position } : null;
      devTo = { name: emp.name, dept: emp.dept, position: emp.position };
      result = transferDevice(sel.id, empId, sel.condition, note, byEmail);
      from = devFrom; to = devTo;
    } else if (type === "retire") {
      devFrom = deviceBefore.holderName ? { name: deviceBefore.holderName, dept: deviceBefore.dept } : null;
      result = retireDevice(sel.id, note, byEmail);
      from = devFrom;
    }

    if (!result) continue;
    okCount++;
    receiptDevices.push({ device: result, condition: sel.condition });
    await saveGlobalLog(opType, sel.id, result.history[0], null, byEmail);
  }

  if (okCount === 0) { toast("Có lỗi xảy ra, vui lòng thử lại", "err"); return; }

  await persistDevices();

  toast(`${OPS_META[type].verb} thành công — ${okCount} thiết bị`);
  closeModal();
  if (window.__opsFormRefresh) window.__opsFormRefresh();

  if (type !== "retire") {
    openReceiptPreview({ type, devices: receiptDevices, from, to, note, date: new Date().toISOString(), byEmail });
  }
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
