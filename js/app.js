import { auth, useFirebase } from './firebase-config.js';
import {
  resolveRole, login, signup, logout,
  setLocalUser, currentUser, currentRole, currentAccount, setCurrentUser,
  listAccounts, setAccountRole, setAccountActive, setAccountEmployeeLink,
  startMfaEnrollment, confirmMfaEnrollment, disableMfa, verifyMfaLoginToken
} from './auth.js';
import { loadAll, state, persistSettings, ASSET_CATEGORIES, ASSET_GROUPS, devicesInScope, scopeMeta } from './db.js';
import {
  renderDashboard, renderDevices, renderDeviceDetail,
  renderEmployees, renderEmployeeDetail, renderOps, renderReports, renderHistoryTable, renderSettings, renderAccountsTable,
  renderMyDevices, renderMyAccount
} from './views.js';
import {
  downloadDeviceImportTemplate, triggerImportFilePicker, handleImportFileSelected, confirmDeviceImport
} from './import.js';
import { toast, openModal, closeModal } from './ui.js';
import {
  openDeviceForm, submitDeviceForm, updateDeviceFormAttrs,
  openEmployeeForm, submitEmployeeForm,
  openOpsForm, submitOpsForm,
  refreshOpsDeviceChecklist, filterOpsDeviceList, toggleAllOpsDevices,
  openRepairForm, submitRepairForm
} from './forms.js';
import {
  printAssetLabel, printAssetLabelMini, openReceiptPreview, closeReceiptPreview,
  printReceiptNow, exportReceiptPDF
} from './print.js';
import {
  exportDevicesExcel, exportEmployeesExcel, exportHistoryExcel,
  exportInventoryChecklist, exportFullReport
} from './export.js';

// Setup global app object for inline HTML event handlers (onclick="app.xyz()")
window.app = {};

const NAV = [
  { grp: "Tổng quan", roles: ["admin"], items: [{ id: "dashboard", label: "Bảng điều khiển", ico: "ph-squares-four" }] },
  { grp: "Tài sản", roles: ["admin"], items: [
    { id: "devices", label: "Tất cả tài sản", ico: "ph-squares-four", cat: "all" },
    ...ASSET_GROUPS.map(g => ({ id: "devices", label: g.label, ico: g.ico, cat: "grp:" + g.id })),
    ...ASSET_CATEGORIES.map(c => ({ id: "devices", label: c.label, ico: c.ico, cat: c.id, indent: true }))
  ]},
  { grp: "Nhân sự", roles: ["admin"], items: [{ id: "employees", label: "Nhân viên", ico: "ph-users" }] },
  { grp: "Nghiệp vụ", roles: ["admin"], items: [
    { id: "ops", label: "Nghiệp vụ", ico: "ph-arrows-left-right" },
    { id: "reports", label: "Báo cáo & Kiểm kê", ico: "ph-file-xls" }
  ]},
  { grp: "Cá nhân", roles: ["admin", "user"], items: [
    { id: "mydevices", label: "Thiết bị của tôi", ico: "ph-laptop" },
    { id: "myaccount", label: "Tài khoản của tôi", ico: "ph-user-circle" }
  ]},
  { grp: "Hệ thống", admin: true, items: [
    { id: "settings", label: "Cài đặt", ico: "ph-gear" }
  ]}
];

// Views a non-admin ("user") account is allowed to open. Everything else
// (company-wide inventory, employee list, ops, reports, settings) is
// admin-only; regular employees only get their own self-service portal.
const USER_ALLOWED_VIEWS = ["mydevices", "myaccount"];

const PAGE_META = {
  dashboard: ["Bảng điều khiển", "Tình trạng thiết bị CNTT toàn công ty"],
  devices: ["Tất cả tài sản", "Sổ quản lý tài sản CNTT — vòng đời từng thiết bị"],
  device: ["Chi tiết thiết bị", "Thông tin, lịch sử và tài chính của thiết bị"],
  employees: ["Nhân viên", "Danh sách nhân viên"],
  ops: ["Nghiệp vụ", "Bàn giao, thu hồi, điều chuyển thiết bị"],
  reports: ["Báo cáo & Kiểm kê", "Xuất danh sách Excel để báo cáo và kiểm kê thiết bị"],
  settings: ["Cài đặt", "Cấu hình hệ thống"],
  mydevices: ["Thiết bị của tôi", "Danh sách thiết bị bạn đang được bàn giao"],
  myaccount: ["Tài khoản của tôi", "Thông tin tài khoản và bảo mật đăng nhập"]
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
  setView("dashboard"); // local/offline mode is always a single admin session
};

function applyRoleUI() {
  document.getElementById("currentUserEmail").textContent = currentUser?.email || "";
  document.getElementById("currentUserRole").textContent = currentRole === "admin" ? "Quản trị viên" : "Nhân viên";
}

// --- Navigation ---
function renderNav() {
  const nav = document.getElementById("mainNav");
  nav.innerHTML = NAV
    .filter(g => !g.admin || currentRole === "admin")
    .filter(g => !g.roles || g.roles.includes(currentRole))
    .map(g => `
    <div class="grp-label">${g.grp}</div>
    ${g.items.map(it => {
      const isCat = it.cat !== undefined;
      const active = isCat
        ? (state.view === "devices" && (deviceFilter.category || "all") === it.cat)
        : (state.view === it.id);
      const onclick = isCat ? `app.setDeviceCategory('${it.cat}')` : `app.setView('${it.id}')`;
      return `
        <button class="${active ? 'active' : ''} ${isCat ? 'nav-sub' : ''}" ${it.indent ? 'style="padding-left:34px; font-size:13px;"' : ''} onclick="${onclick}">
          <i class="ph ${it.ico}"></i> ${it.label}
        </button>
      `;
    }).join("")}
  `).join("");
}

function setView(view, arg) {
  if (NAV.some(g => g.admin && g.items.some(it => it.id === view)) && currentRole !== "admin") {
    toast("Chỉ quản trị viên mới truy cập được mục này", "err");
    view = "mydevices";
  }
  if (currentRole !== "admin" && !USER_ALLOWED_VIEWS.includes(view)) {
    toast("Tài khoản của bạn chỉ có thể xem thiết bị và tài khoản cá nhân", "err");
    view = "mydevices";
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
    const scope = scopeMeta(deviceFilter.category);
    document.getElementById("pageTitle").textContent = scope.kind === "all" ? "Tất cả tài sản" : scope.label;
    document.getElementById("pageDesc").textContent = scope.kind === "all"
      ? PAGE_META.devices[1]
      : `Danh sách tài sản thuộc nhóm: ${scope.label}`;
    content.innerHTML = renderDevices(deviceFilter);
  } else if (view === "device") {
    content.innerHTML = renderDeviceDetail(arg);
  } else if (view === "employees") {
    actions.innerHTML = `<button class="btn btn-brand" onclick="app.openEmployeeForm()"><i class="ph ph-plus"></i> Thêm nhân viên</button>`;
    content.innerHTML = renderEmployees(employeeFilter);
  } else if (view === "employee") {
    document.getElementById("pageTitle").textContent = "Chi tiết nhân viên";
    document.getElementById("pageDesc").textContent = "Thông tin nhân viên và thiết bị đang được giao.";
    content.innerHTML = renderEmployeeDetail(arg);
  } else if (view === "ops") {
    content.innerHTML = renderOps();
  } else if (view === "reports") {
    content.innerHTML = renderReports();
  } else if (view === "settings") {
    content.innerHTML = renderSettings();
    loadAccountsBox();
  } else if (view === "mydevices") {
    content.innerHTML = renderMyDevices(currentAccount, currentUser?.email);
  } else if (view === "myaccount") {
    content.innerHTML = renderMyAccount(currentUser?.email, currentRole, currentAccount, useFirebase);
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
window.__deviceImportRefresh = refreshCurrentView;

window.app.setView = setView;
window.app.downloadDeviceImportTemplate = downloadDeviceImportTemplate;
window.app.triggerImportFilePicker = triggerImportFilePicker;
window.app.handleImportFileSelected = handleImportFileSelected;
window.app.confirmDeviceImport = confirmDeviceImport;
window.app.exportDevicesForCategory = (scopeId) => {
  const scope = scopeMeta(scopeId);
  exportDevicesExcel(devicesInScope(scopeId), scope.kind === "all" ? null : scope.label);
};
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
window.app.printAssetLabelMini = (id) => printAssetLabelMini(id);
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
  openReceiptPreview({ type, devices: [{ device: d, condition: h.condition }], from, to, note: h.note, date: h.date, byEmail: h.by });
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
window.app.refreshOpsDeviceChecklist = (type) => refreshOpsDeviceChecklist(type);
window.app.filterOpsDeviceList = (q) => filterOpsDeviceList(q);
window.app.toggleAllOpsDevices = (checked) => toggleAllOpsDevices(checked);

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
  box.innerHTML = renderAccountsTable(result, currentUser?.email, state.employees);
}

window.app.changeAccountRole = async (uid, role) => {
  const ok = await setAccountRole(uid, role);
  if (ok) { toast("Đã cập nhật vai trò"); loadAccountsBox(); }
  else toast("Không thể cập nhật vai trò", "err");
};

window.app.changeAccountEmployee = async (uid, employeeId) => {
  const ok = await setAccountEmployeeLink(uid, employeeId || null);
  if (ok) { toast("Đã liên kết tài khoản với nhân viên"); loadAccountsBox(); }
  else toast("Không thể liên kết tài khoản", "err");
};

window.app.toggleAccountActive = async (uid, currentlyActive) => {
  const ok = await setAccountActive(uid, !currentlyActive);
  if (ok) { toast(currentlyActive ? "Đã khoá tài khoản" : "Đã mở khoá tài khoản"); loadAccountsBox(); }
  else toast("Không thể cập nhật trạng thái", "err");
};

function defaultViewForRole(role) {
  return role === "admin" ? "dashboard" : "mydevices";
}

// --- MFA: enable / disable from "Tài khoản của tôi" ---
window.app.startMfaSetup = async () => {
  if (!currentUser) return;
  const res = await startMfaEnrollment(currentUser.uid, currentUser.email);
  if (!res.success) { toast(res.message, "err"); return; }

  const body = `
    <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
      Quét mã QR bên dưới bằng ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, Authy…),
      sau đó nhập mã 6 số hiện ra để xác nhận và bật MFA.
    </p>
    <div style="display:flex; justify-content:center; margin-bottom:16px;">
      <div id="mfaQrBox" style="background:#fff; padding:12px; border-radius:12px;"></div>
    </div>
    <div class="field">
      <label>Mã khóa thủ công (nếu không quét được QR)</label>
      <input type="text" readonly value="${res.secret}" style="font-family:var(--font-mono); letter-spacing:0.05em;">
    </div>
    <div class="field">
      <label>Nhập mã 6 số để xác nhận</label>
      <input type="text" id="mfaEnrollCode" maxlength="6" inputmode="numeric" placeholder="000000" style="font-family:var(--font-mono); letter-spacing:0.3em; text-align:center; font-size:20px;">
    </div>
  `;
  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" onclick="app.confirmMfaSetup('${res.secret}')"><i class="ph ph-check"></i> Xác nhận & Bật MFA</button>
  `;
  openModal("Bật xác thực 2 lớp (MFA)", body, foot);

  setTimeout(() => {
    const box = document.getElementById("mfaQrBox");
    if (box && window.QRCode) {
      new window.QRCode(box, { text: res.otpauth, width: 180, height: 180 });
    }
  }, 30);
};

window.app.confirmMfaSetup = async (secret) => {
  const codeEl = document.getElementById("mfaEnrollCode");
  const token = codeEl ? codeEl.value.trim() : "";
  if (!token) { toast("Vui lòng nhập mã xác thực", "err"); return; }
  const res = await confirmMfaEnrollment(currentUser.uid, secret, token);
  if (!res.success) { toast(res.message, "err"); return; }
  currentAccount.mfaEnabled = true;
  currentAccount.mfaSecret = secret;
  closeModal();
  toast("Đã bật xác thực 2 lớp cho tài khoản");
  refreshCurrentView();
};

window.app.openDisableMfaModal = () => {
  const body = `
    <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
      Nhập mã 6 số hiện tại từ ứng dụng xác thực của bạn để tắt MFA.
    </p>
    <div class="field">
      <label>Mã xác thực</label>
      <input type="text" id="mfaDisableCode" maxlength="6" inputmode="numeric" placeholder="000000" style="font-family:var(--font-mono); letter-spacing:0.3em; text-align:center; font-size:20px;">
    </div>
  `;
  const foot = `
    <button class="btn btn-ghost" onclick="app.closeModal()">Huỷ</button>
    <button class="btn btn-brand" onclick="app.confirmDisableMfa()"><i class="ph ph-shield-slash"></i> Tắt MFA</button>
  `;
  openModal("Tắt xác thực 2 lớp (MFA)", body, foot);
};

window.app.confirmDisableMfa = async () => {
  const codeEl = document.getElementById("mfaDisableCode");
  const token = codeEl ? codeEl.value.trim() : "";
  if (!token) { toast("Vui lòng nhập mã xác thực", "err"); return; }
  const res = await disableMfa(currentUser.uid, currentAccount.mfaSecret, token);
  if (!res.success) { toast(res.message, "err"); return; }
  currentAccount.mfaEnabled = false;
  currentAccount.mfaSecret = null;
  closeModal();
  toast("Đã tắt xác thực 2 lớp");
  refreshCurrentView();
};

// --- MFA: verification step during login ---
let pendingMfaUser = null;
let pendingMfaAccount = null;

function showMfaScreen(user, account) {
  pendingMfaUser = user;
  pendingMfaAccount = account;
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("shell").style.display = "none";
  const mfaOverlay = document.getElementById("mfa-overlay");
  const errBox = document.getElementById("mfaLoginErr");
  const codeEl = document.getElementById("mfaLoginCode");
  if (errBox) errBox.classList.remove("show");
  if (codeEl) codeEl.value = "";
  if (mfaOverlay) mfaOverlay.style.display = "flex";
}

function hideMfaScreen() {
  pendingMfaUser = null;
  pendingMfaAccount = null;
  const mfaOverlay = document.getElementById("mfa-overlay");
  if (mfaOverlay) mfaOverlay.style.display = "none";
}

async function enterAppAfterAuth(user, account) {
  setCurrentUser(user, account.role, account);
  hideMfaScreen();
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("shell").style.display = "flex";
  applyRoleUI();
  await loadAll();
  setView(defaultViewForRole(account.role));
}

window.app.verifyMfaLogin = async () => {
  const codeEl = document.getElementById("mfaLoginCode");
  const errBox = document.getElementById("mfaLoginErr");
  const token = codeEl ? codeEl.value.trim() : "";
  if (errBox) errBox.classList.remove("show");

  if (!token) {
    if (errBox) { errBox.textContent = "Vui lòng nhập mã xác thực."; errBox.classList.add("show"); }
    return;
  }
  const ok = await verifyMfaLoginToken(pendingMfaAccount.mfaSecret, token);
  if (!ok) {
    if (errBox) { errBox.textContent = "Mã xác thực không đúng. Vui lòng thử lại."; errBox.classList.add("show"); }
    return;
  }
  await enterAppAfterAuth(pendingMfaUser, pendingMfaAccount);
};

window.app.cancelMfaLogin = async () => {
  hideMfaScreen();
  if (useFirebase && auth.currentUser) {
    await auth.signOut();
  }
  document.getElementById("login-overlay").style.display = "flex";
};

// --- Init ---
if (useFirebase) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const account = await resolveRole(user);
      if (!account.active) {
        toast("Tài khoản đã bị vô hiệu hoá.", "err");
        await auth.signOut();
        return;
      }
      const authUser = { uid: user.uid, email: user.email };
      if (account.mfaEnabled) {
        showMfaScreen(authUser, account);
        return;
      }
      await enterAppAfterAuth(authUser, account);
    } else {
      hideMfaScreen();
      document.getElementById("login-overlay").style.display = "flex";
      document.getElementById("shell").style.display = "none";
    }
  });
} else {
  document.getElementById("localModeNote").style.display = "flex";
}
