import { db, useFirebase } from './firebase-config.js';
import { PUBLIC_LOOKUP_COLLECTION } from './db.js';

const CATEGORY_ICONS = {
  computers: "ph-desktop-tower", monitors: "ph-monitor", peripherals: "ph-mouse",
  printers: "ph-printer", network: "ph-network", phones: "ph-device-mobile",
  cartridges: "ph-drop", consumables: "ph-package", others: "ph-question"
};

const STATUS_PILL = {
  "Đang sử dụng": "pill-success",
  "Trong kho": "pill-brand",
  "Bảo trì": "pill-warning",
  "Thanh lý": "pill-danger"
};

function esc(s) {
  return (s === undefined || s === null) ? "" : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function renderState(html) {
  document.getElementById("lookupCard").innerHTML = html;
}

function renderStateBox(icon, title, sub) {
  renderState(`
    <div class="state-box">
      <i class="ph ${icon}"></i>
      <div style="color:var(--text-primary); font-weight:600; margin-bottom:6px;">${esc(title)}</div>
      <div style="font-size:13px;">${sub || ""}</div>
    </div>
  `);
}

function deviceMiniRowHTML(d) {
  return `
    <div class="device-mini-row">
      <div class="dmr-id mono">${esc(d.id)}</div>
      <div class="dmr-info">
        <div class="dmr-type">${esc(d.type || "—")}${d.brand ? " — " + esc(d.brand) : ""}</div>
        ${d.condition ? `<div class="dmr-cond">Tình trạng: ${esc(d.condition)}</div>` : ""}
      </div>
    </div>
  `;
}

function renderOtherDevices(list) {
  if (!list || list.length === 0) return "";
  return `
    <div class="other-devices-box">
      <div class="lbl" style="margin-bottom:10px;"><i class="ph ph-stack"></i> Các thiết bị khác nhân viên này đang giữ (${list.length})</div>
      ${list.map(deviceMiniRowHTML).join("")}
    </div>
  `;
}

function renderDevice(d, otherDevices) {
  const statusPill = STATUS_PILL[d.status] || "pill-brand";
  const holderBlock = d.holderName
    ? `
      <div class="holder-box">
        <div class="lbl"><i class="ph ph-user-circle"></i> Người đang quản lý / sử dụng</div>
        <div class="name">${esc(d.holderName)}</div>
        ${d.holderDept ? `<div class="dept">${esc(d.holderDept)}</div>` : ""}
      </div>`
    : `
      <div class="holder-box">
        <div class="lbl"><i class="ph ph-warehouse"></i> Đơn vị quản lý</div>
        <div class="name">Phòng Công nghệ thông tin (đang lưu kho)</div>
      </div>`;

  renderState(`
    <h2>${esc(d.id)}</h2>
    <div class="sub">${esc(d.type || "—")}${d.brand ? " — " + esc(d.brand) : ""}</div>
    <div class="kv"><b>Trạng thái</b><span class="pill ${statusPill}">${esc(d.status || "—")}</span></div>
    <div class="kv"><b>Tình trạng</b><span>${esc(d.condition || "—")}</span></div>
    ${d.specs ? `<div class="kv"><b>Thông số</b><span>${esc(d.specs)}</span></div>` : ""}
    <div class="kv"><b>Cập nhật lúc</b><span class="mono">${fmtDateTime(d.updatedAt)}</span></div>
    ${holderBlock}
    ${renderOtherDevices(otherDevices)}
  `);
}

async function loadLocalDevices() {
  // Chỉ hoạt động nếu trang được mở TRÊN CHÍNH trình duyệt/máy đã lưu dữ liệu cục bộ
  // (chế độ Local / offline, chưa bật Cloud). Hữu ích khi IT tự kiểm tra tại chỗ,
  // nhưng KHÔNG dùng được khi người khác quét QR từ điện thoại của họ.
  try {
    const raw = localStorage.getItem("jeanic-devices");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Lấy các thiết bị KHÁC (trừ thiết bị đang xem) mà cùng 1 nhân viên (holderId) đang giữ,
// để khi quét QR 1 thiết bị, người dùng thấy được toàn bộ combo thiết bị người đó đang cầm
// (VD: quét mã bàn phím thấy luôn màn hình, chuột, laptop... cùng người đang giữ).
async function fetchOtherDevicesForHolder(holderId, excludeId) {
  if (!holderId) return [];

  if (useFirebase && db) {
    try {
      const snap = await db.collection(PUBLIC_LOOKUP_COLLECTION).where("holderId", "==", holderId).get();
      return snap.docs.map(doc => doc.data()).filter(d => d.id !== excludeId);
    } catch (e) {
      console.error("Lỗi tra cứu các thiết bị khác của nhân viên:", e);
      return [];
    }
  }

  const localList = await loadLocalDevices();
  if (!localList) return [];
  return localList
    .filter(d => d.holderId === holderId && d.id !== excludeId)
    .map(d => ({ id: d.id, type: d.type, brand: d.brand, condition: d.condition }));
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get("id") || "").trim();

  if (!id) {
    renderStateBox("ph-qr-code", "Thiếu mã thiết bị", "Vui lòng quét lại mã QR trên tem thiết bị.");
    return;
  }

  if (useFirebase && db) {
    try {
      const doc = await db.collection(PUBLIC_LOOKUP_COLLECTION).doc(id).get();
      if (doc.exists) {
        const data = doc.data();
        const others = await fetchOtherDevicesForHolder(data.holderId, id);
        renderDevice(data, others);
        return;
      }
    } catch (e) {
      console.error("Lỗi tra cứu thiết bị:", e);
      renderStateBox(
        "ph-warning-circle",
        "Không thể tải dữ liệu",
        "Có thể hệ thống chưa cấu hình cho phép tra cứu công khai (Firestore Security Rules). Vui lòng liên hệ Phòng CNTT."
      );
      return;
    }
  }

  // Fallback: chế độ Local hoặc không tìm thấy trên Cloud
  const localList = await loadLocalDevices();
  const local = localList ? localList.find(x => x.id === id) : null;
  if (local) {
    const others = localList
      .filter(d => d.holderId === local.holderId && local.holderId && d.id !== local.id)
      .map(d => ({ id: d.id, type: d.type, brand: d.brand, condition: d.condition }));
    renderDevice({
      id: local.id, type: local.type, brand: local.brand, specs: local.specs,
      condition: local.condition, status: local.status,
      holderName: local.holderName, holderDept: local.dept,
      updatedAt: new Date().toISOString()
    }, others);
    return;
  }

  renderStateBox(
    "ph-magnifying-glass",
    `Không tìm thấy thiết bị "${id}"`,
    "Mã thiết bị không tồn tại, hoặc hệ thống đang chạy ở chế độ cục bộ (offline) nên không tra cứu được từ thiết bị khác."
  );
}

init();
