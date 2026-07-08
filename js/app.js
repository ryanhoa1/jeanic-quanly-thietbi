import { auth, useFirebase } from './firebase-config.js';
import { 
  resolveRole, login, signup, logout, 
  setLocalUser, currentUser, currentRole, setCurrentUser
} from './auth.js';
import { loadAll, state } from './db.js';
import { renderDashboard, renderDevices } from './views.js';
import { toast, openModal, closeModal } from './ui.js';

// Setup global app object for inline HTML event handlers (onclick="app.xyz()")
window.app = {};

const NAV = [
  { grp: "Tổng quan", items: [{ id: "dashboard", label: "Bảng điều khiển", ico: "ph-squares-four" }] },
  { grp: "Tài sản", items: [
    { id: "devices", label: "Thiết bị", ico: "ph-laptop" },
    { id: "employees", label: "Nhân viên", ico: "ph-users" }
  ]},
  { grp: "Nghiệp vụ", items: [{ id: "ops", label: "Nghiệp vụ", ico: "ph-arrows-left-right" }] },
  { grp: "Hệ thống", admin: true, items: [
    { id: "settings", label: "Cài đặt", ico: "ph-gear" }
  ]}
];

const PAGE_META = {
  dashboard: ["Bảng điều khiển", "Tình trạng thiết bị CNTT toàn công ty"],
  devices: ["Thiết bị", "Sổ quản lý tài sản CNTT — vòng đời từng thiết bị"],
  employees: ["Nhân viên", "Danh sách nhân viên"],
  ops: ["Nghiệp vụ", "Bàn giao, thu hồi, điều chuyển thiết bị"],
  settings: ["Cài đặt", "Cấu hình hệ thống"]
};

let deviceFilter = { q: "", status: "all", dept: "all" };

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
    ${g.items.map(it => `
      <button class="${state.view === it.id ? 'active' : ''}" onclick="app.setView('${it.id}')">
        <i class="ph ${it.ico}"></i> ${it.label}
      </button>
    `).join("")}
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
    content.innerHTML = renderDevices(deviceFilter);
  } else {
    content.innerHTML = `
      <div class="empty">
        <i class="ph ph-wrench"></i>
        <b>Đang phát triển</b>
        <p>Tính năng ${meta[0]} sẽ sớm ra mắt ở phiên bản module hóa tiếp theo.</p>
      </div>
    `;
  }
  window.scrollTo(0, 0);
}

window.app.setView = setView;
window.app.setDeviceFilter = (k, v) => { deviceFilter[k] = v; setView("devices"); };

// Exposed UI helpers
window.app.closeModal = closeModal;
window.app.toast = toast;

// Forms and interactions placeholders (to ensure JS runs without errors)
window.app.openDeviceForm = () => toast("Mở form thêm thiết bị (Đang phát triển)");
window.app.printAssetLabel = (id) => toast(`In tem thiết bị: ${id} (Đang phát triển)`);

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
