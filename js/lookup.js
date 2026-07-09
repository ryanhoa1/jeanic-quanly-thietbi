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

function renderDevice(d) {
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
  `);
}

async function tryLocalFallback(id) {
  // Chỉ hoạt động nếu trang được mở TRÊN CHÍNH trình duyệt/máy đã lưu dữ liệu cục bộ
  // (chế độ Local / offline, chưa bật Cloud). Hữu ích khi IT tự kiểm tra tại chỗ,
  // nhưng KHÔNG dùng được khi người khác quét QR từ điện thoại của họ.
  try {
    const raw = localStorage.getItem("jeanic-devices");
    if (!raw) return null;
    const list = JSON.parse(raw);
    return list.find(x => x.id === id) || null;
  } catch (e) {
    return null;
  }
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
        renderDevice(doc.data());
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
  const local = await tryLocalFallback(id);
  if (local) {
    renderDevice({
      id: local.id, type: local.type, brand: local.brand, specs: local.specs,
      condition: local.condition, status: local.status,
      holderName: local.holderName, holderDept: local.dept,
      updatedAt: new Date().toISOString()
    });
    return;
  }

  renderStateBox(
    "ph-magnifying-glass",
    `Không tìm thấy thiết bị "${id}"`,
    "Mã thiết bị không tồn tại, hoặc hệ thống đang chạy ở chế độ cục bộ (offline) nên không tra cứu được từ thiết bị khác."
  );
}

init();
