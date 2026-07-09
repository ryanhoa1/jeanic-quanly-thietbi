import { auth, useFirebase } from './firebase-config.js';
import {
  resolveRole, login, signup, logout,
  setLocalUser, currentUser, currentRole, setCurrentUser,
  listAccounts, setAccountRole, setAccountActive
} from './auth.js';
import { loadAll, state, persistSettings, ASSET_CATEGORIES, getCategoryMeta } from './db.js';
import {
  renderDashboard, renderDevices, renderDeviceDetail,
  renderEmployees, renderOps, renderReports, renderHistoryTable, renderSettings, renderAccountsTable
} from './views.js';
import { toast, openModal, closeModal } from './ui.js';
import {
  openDeviceForm, submitDeviceForm, updateDeviceFormAttrs,
  openEmployeeForm, submitEmployeeForm,
  openOpsForm, submitOpsForm,
  openRepairForm, submitRepairForm
} from './forms.js';
import {
  printAssetLabel, openReceiptPreview, closeReceiptPreview,
  printReceiptNow, exportReceiptPDF
} from './print.js';
import {
  exportDevicesExcel, exportEmployeesExcel, exportHistoryExcel,
  exportInventoryChecklist, exportFullReport
} from './export.js';

// Setup global app object for inline HTML event handlers (onclick="app.xyz()")
window.app = {};

const NAV = [
  { grp: "Tổng quan", items: [{ id: "dashboard", label: "Bảng điều khiển", ico: "ph-squares-four" }] },
  { grp: "Tài sản", items: [
    { id: "devices", label: "Tất cả tài sản", ico: "ph-squares-four", cat: "all" },
    ...ASSET_CATEGORIES.map(c => ({ id: "devices", label: c.label, ico: c.ico, cat: c.id }))
  ]},
  { grp: "Nhân sự", items: [{ id: "employees", label: "Nhân viên", ico: "ph-users" }] },
  { grp: "Nghiệp vụ", items: [
    { id: "ops", label: "Nghiệp vụ", ico: "ph-arrows-left-right" },
    { id: "reports", label: "Báo cáo & Kiểm kê", ico: "ph-file-xls" }
  ]},
  { grp: "Hệ thống", admin: true, items: [
    { id: "settings", label: "Cài đặt", ico: "ph-gear" }
  ]}
];

const PAGE_META = {
  dashboard: ["Bảng điều khiển", "Tình trạng thiết bị CNTT toàn công ty"],
  devices: ["Tất cả tài sản", "Sổ quản lý tài sản CNTT — vòng đời từng thiết bị"],
  device: ["Chi tiết thiết bị", "Thông tin, lịch sử và tài chính của thiết bị"],
  employees: ["Nhân viên", "Danh sách nhân viên"],
  ops: ["Nghiệp vụ", "Bàn giao, thu hồi, điều chuyển thiết bị"],
  reports: ["Báo cáo & Kiểm kê", "Xuất danh sách Excel để báo cáo và kiểm kê thiết bị"],
  settings: ["Cài đặt", "Cấu hình hệ thống"]
};

let deviceFilter = { q: "", status: "all", dept: "all", category: "all" };
let employeeFilter = { q: "", dept: "all" };

// --- Auth UI Logic ---
window.app.login = async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  const errBox = document.getElementById("loginErr");
  const successBox = document.getElementById("loginSuccess");

  errBox.classList.remove("show");
  successBox.classList.remove("show");

  if (!email || !pass) {
    errBox.textContent = "Vui lòng nhập đầy đủ email và mật khẩu.";
    errBox.classList.add("show");
    return;
  }

  if (!useFirebase) {
    toast("Đang chạy offline. Chọn 'Vào thẳng'.", "err");
    return;
  }

  try {
    const res = await login(email, pass);
    if (!res.success) {
      errBox.textContent = res.message;
      errBox.classList.add("show");
    }
  } catch (err) {
    console.error("[JEANIC IT] Lỗi không xác định khi đăng nhập:", err);
    errBox.textContent = "Lỗi không xác định: " + (err && err.message ? err.message : err);
    errBox.classList.add("show");
  }
};

window.app.signup = async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  const errBox = document.getElementById("loginErr");
  const successBox = document.getElementById("loginSuccess");

  errBox.classList.remove("show");
  successBox.classList.remove("show");

  if (!email || !pass) {
    errBox.textContent = "Vui lòng nhập đầy đủ email và mật khẩu.";
    errBox.classList.add("show");
    return;
  }

  if (!useFirebase) {
    toast("Đang chạy offline.", "err");
    return;
  }

  if (pass.length < 6) {
    errBox.textContent = "Mật khẩu phải có ít nhất 6 ký tự.";
    errBox.classList.add("show");
    return;
  }

  try {
    const res = await signup(email, pass);
    if (!res.success) {
      errBox.textContent = res.message;
      errBox.classList.add("show");
    } else {
      successBox.textContent = res.message;
      successBox.classList.add("show");
    }
  } catch (err) {
    console.error("[JEANIC IT] Lỗi không xác định khi tạo tài khoản:", err);
    errBox.textContent = "Lỗi không xác định: " + (err && err.message ? err.message : err);
    errBox.classList.add("show");
  }
};

window.app.logout = logout;

window.app.enterLocalMode = async () => {
  await setLocalUser();
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("shell").style.display = "flex";
  applyRoleUI();
  await loadAll();
  setView("dashboard");
};

function applyRoleUI() {
  document.getElementById("currentUserEmail").textContent = currentUser?.email || "";
  document.getElementById("currentUserRole").textContent = currentRole === "admin" ? "Quản trị viên" : "Nhân viên";
}

// --- Navigation ---
function renderNav() {
  const nav = document.getElementById("mainNav");
  nav.innerHTML = NAV.filter(g => !g.admin || currentRole === "admin").map(g => `
    <div class="grp-label">${g.grp}</div>
    ${g.items.map(it => {
      const isCat = it.cat !== undefined;
      const active = isCat
        ? (state.view === "devices" && (deviceFilter.category || "all") === it.cat)
        : (state.view === it.id);
      const onclick = isCat ? `app.setDeviceCategory('${it.cat}')` : `app.setView('${it.id}')`;
      return `
        <button class="${active ? 'active' : ''} ${isCat ? 'nav-sub' : ''}" onclick="${onclick}">
          <i class="ph ${it.ico}"></i> ${it.label}
        </button>
      `;
    }).join("")}
  `).join("");
}

function setView(view, arg) {
  if (NAV.some(g => g.admin && g.items.some(it => it.id === view)) && currentRole !== "admin") {
    toast("Chỉ quản trị viên mới truy cập được mục này", "err");
    view = "dashboard";
  }

  state.view = view;
  state.currentId = arg;
  renderNav();

  const meta = PAGE_META[view] || PAGE_META.devices;
  document.getElementById("pageTitle").textContent = meta[0];
  document.getElementById("pageDesc").textContent = meta[1];

  const content = document.getElementById("content");
  const actions = document.getElementById("topbarActions");
  actions.innerHTML = "";

  if (view === "dashboard") {
    content.innerHTML = renderDashboard();
  } else if (view === "devices") {
    actions.innerHTML = `<button class="btn btn-brand" onclick="app.openDeviceForm()"><i class="ph ph-plus"></i> Thêm thiết bị</button>`;
    const catMeta = deviceFilter.category && deviceFilter.category !== "all" ? getCategoryMeta(deviceFilter.category) : null;
    document.getElementById("pageTitle").textContent = catMeta ? catMeta.label : "Tất cả tài sản";
    document.getElementById("pageDesc").textContent = catMeta
      ? `Danh sách tài sản thuộc nhóm: ${catMeta.label}`
      : PAGE_META.devices[1];
    content.innerHTML = renderDevices(deviceFilter);
  } else if (view === "device") {
    content.innerHTML = renderDeviceDetail(arg);
  } else if (view === "employees") {
    actions.innerHTML = `<button class="btn btn-brand" onclick="app.openEmployeeForm()"><i class="ph ph-plus"></i> Thêm nhân viên</button>`;
    content.innerHTML = renderEmployees(employeeFilter);
  } else if (view === "ops") {
    content.innerHTML = renderOps();
  } else if (view === "reports") {
    content.innerHTML = renderReports();
  } else if (view === "settings") {
    content.innerHTML = renderSettings();
    loadAccountsBox();
  } else {
    content.innerHTML = `
      <div class="empty">
        <i class="ph ph-wrench"></i>
        <b>Đang phát triển</b>
        <p>Tính năng ${meta[0]} sẽ sớm ra mắt.</p>
      </div>
    `;
  }
  window.scrollTo(0, 0);
}

function refreshCurrentView() {
  setView(state.view, state.currentId);
}

window.app.setView = setView;
window.app.setDeviceFilter = (k, v) => { deviceFilter[k] = v; setView("devices"); };
window.app.setDeviceCategory = (catId) => { deviceFilter.category = catId; setView("devices"); };
window.app.setEmployeeFilter = (k, v) => { employeeFilter[k] = v; setView("employees"); };

// Exposed UI helpers
window.app.closeModal = closeModal;
window.app.toast = toast;

// --- Devices ---
window.app.openDeviceForm = (id) => openDeviceForm(id, refreshCurrentView);
window.app.submitDeviceForm = (id) => submitDeviceForm(id);
window.app.updateDeviceFormAttrs = () => updateDeviceFormAttrs();
window.app.printAssetLabel = (id) => printAssetLabel(id);
window.app.closeReceiptPreview = () => closeReceiptPreview();
window.app.printReceiptNow = () => printReceiptNow();
window.app.exportReceiptPDF = () => exportReceiptPDF();
window.app.reprintHistoryReceipt = (deviceId, idx) => {
  const d = state.devices.find(x => x.id === deviceId);
  if (!d) { toast("Không tìm thấy thiết bị", "err"); return; }
  const h = (d.history || [])[idx];
  if (!h) { toast("Không tìm thấy sự kiện lịch sử", "err"); return; }
  const typeMap = { ban_giao: "handover", thu_hoi: "return", dieu_chuyen: "transfer", thanh_ly: "retire" };
  const type = typeMap[h.type];
  if (!type) { toast("Không thể tạo biên bản cho sự kiện này", "err"); return; }
  const from = h.from ? { name: h.from } : null;
  const to = h.to ? { name: h.to, dept: h.dept } : null;
  openReceiptPreview({ type, device: d, from, to, condition: h.condition, note: h.note, date: h.date, byEmail: h.by });
};

// --- Reports / Exports ---
window.app.exportDevicesExcel = () => exportDevicesExcel();
window.app.exportEmployeesExcel = () => exportEmployeesExcel();
window.app.exportHistoryExcel = () => exportHistoryExcel();
window.app.exportInventoryChecklist = () => exportInventoryChecklist();
window.app.exportFullReport = () => exportFullReport();
window.app.openRepairForm = (deviceId) => openRepairForm(deviceId, refreshCurrentView);
window.app.submitRepairForm = (deviceId) => submitRepairForm(deviceId);

// --- Employees ---
window.app.openEmployeeForm = (id) => openEmployeeForm(id, refreshCurrentView);
window.app.submitEmployeeForm = (id) => submitEmployeeForm(id);

// --- Operations ---
window.app.openOpsForm = (type) => openOpsForm(type, refreshCurrentView);
window.app.submitOpsForm = (type) => submitOpsForm(type);

// --- Settings ---
window.app.saveSettings = async () => {
  const companyNameEl = document.getElementById("setCompanyName");
  const companyAddressEl = document.getElementById("setCompanyAddress");
  const companyDeptEl = document.getElementById("setCompanyDept");
  if (companyNameEl) state.settings.companyName = companyNameEl.value.trim();
  if (companyAddressEl) state.settings.companyAddress = companyAddressEl.value.trim();
  if (companyDeptEl) state.settings.companyDept = companyDeptEl.value.trim();

  const usefulLifeEl = document.getElementById("setUsefulLife");
  const warrantyEl = document.getElementById("setWarrantyMonths");
  const depWarnEl = document.getElementById("setDepWarn");
  const warWarnEl = document.getElementById("setWarWarnDays");
  const repairWarnEl = document.getElementById("setRepairWarn");
  if (usefulLifeEl) state.settings.usefulLifeYears = Number(usefulLifeEl.value) || state.settings.usefulLifeYears;
  if (warrantyEl) state.settings.warrantyMonths = Number(warrantyEl.value) || state.settings.warrantyMonths;
  if (depWarnEl) state.settings.depreciationWarnPercent = Number(depWarnEl.value) || 0;
  if (warWarnEl) state.settings.warrantyWarnDays = Number(warWarnEl.value) || 0;
  if (repairWarnEl) state.settings.repairCostWarnPercent = Number(repairWarnEl.value) || 0;

  await persistSettings();
  toast("Đã lưu cấu hình hệ thống");
};

async function loadAccountsBox() {
  const box = document.getElementById("accountsBox");
  if (!box) return;
  const result = await listAccounts();
  box.innerHTML = renderAccountsTable(result, currentUser?.email);
}

window.app.changeAccountRole = async (uid, role) => {
  const ok = await setAccountRole(uid, role);
  if (ok) { toast("Đã cập nhật vai trò"); loadAccountsBox(); }
  else toast("Không thể cập nhật vai trò", "err");
};

window.app.toggleAccountActive = async (uid, currentlyActive) => {
  const ok = await setAccountActive(uid, !currentlyActive);
  if (ok) { toast(currentlyActive ? "Đã khoá tài khoản" : "Đã mở khoá tài khoản"); loadAccountsBox(); }
  else toast("Không thể cập nhật trạng thái", "err");
};

// --- Init ---
if (useFirebase) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const { role, active } = await resolveRole(user);
      if (!active) {
        toast("Tài khoản đã bị vô hiệu hoá.", "err");
        await auth.signOut();
        return;
      }
      setCurrentUser({ uid: user.uid, email: user.email }, role);
      document.getElementById("login-overlay").style.display = "none";
      document.getElementById("shell").style.display = "flex";
      applyRoleUI();
      await loadAll();
      setView("dashboard");
    } else {
      document.getElementById("login-overlay").style.display = "flex";
      document.getElementById("shell").style.display = "none";
    }
  });
} else {
  document.getElementById("localModeNote").style.display = "flex";
}
