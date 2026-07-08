import { state } from './db.js';
import { esc, fmtDate } from './helpers.js';
import { toast } from './ui.js';

export function printAssetLabel(id) {
  const d = state.devices.find(x => x.id === id);
  if (!d) { toast("Không tìm thấy thiết bị", "err"); return; }

  const area = document.getElementById("print-area");
  area.innerHTML = `
    <div class="label-sheet">
      <div class="ls-head">JEANIC GARMENT — TEM TÀI SẢN CNTT</div>
      <div class="label-grid">
        <div class="label-card">
          <div class="lc-id">${esc(d.id)}</div>
          <div class="lc-name">${esc(d.type)} — ${esc(d.brand)}</div>
          <div class="lc-codes">
            <svg id="barcode-${d.id}"></svg>
            <div id="qrcode-${d.id}"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    if (window.JsBarcode) {
      window.JsBarcode(`#barcode-${d.id}`, d.id, { format: "CODE128", width: 2, height: 40, fontSize: 12, margin: 4 });
    }
    if (window.QRCode) {
      new window.QRCode(document.getElementById(`qrcode-${d.id}`), { text: d.id, width: 90, height: 90 });
    }
  } catch (e) {
    console.error("Lỗi tạo mã vạch/QR:", e);
  }

  setTimeout(() => window.print(), 300);
}

export function printHandoverReceipt(device, employee, type, note, byEmail) {
  const area = document.getElementById("print-area");
  const typeLabel = { handover: "BIÊN BẢN BÀN GIAO THIẾT BỊ", return: "BIÊN BẢN THU HỒI THIẾT BỊ", transfer: "BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ" }[type] || "BIÊN BẢN";

  area.innerHTML = `
    <div class="bb-page">
      <div class="bb-head">
        <div class="co">Công ty TNHH Jeanic Garment</div>
        <div class="dept">Phòng Công nghệ thông tin</div>
        <h1>${typeLabel}</h1>
        <div>Ngày ${fmtDate(new Date().toISOString())}</div>
      </div>
      <div class="bb-block">
        <h4>Thông tin thiết bị</h4>
        <div class="bb-row"><b>Mã thiết bị:</b> ${esc(device.id)}</div>
        <div class="bb-row"><b>Loại / Thương hiệu:</b> ${esc(device.type)} — ${esc(device.brand)}</div>
        <div class="bb-row"><b>Tình trạng:</b> ${esc(device.condition)}</div>
      </div>
      <div class="bb-block">
        <h4>Thông tin nhân viên</h4>
        <div class="bb-row"><b>Họ tên:</b> ${esc(employee?.name || "—")}</div>
        <div class="bb-row"><b>Bộ phận:</b> ${esc(employee?.dept || "—")}</div>
      </div>
      ${note ? `<div class="bb-block"><h4>Ghi chú</h4><div class="bb-row">${esc(note)}</div></div>` : ""}
      <div class="bb-terms">Hai bên xác nhận đã kiểm tra tình trạng thiết bị và đồng ý với nội dung trên.</div>
      <div class="bb-sign">
        <div><div class="cap">Người bàn giao</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>
        <div><div class="cap">Người nhận</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>
      </div>
    </div>
  `;

  setTimeout(() => window.print(), 300);
}
