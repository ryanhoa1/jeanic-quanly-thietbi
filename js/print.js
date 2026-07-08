import { state } from './db.js';
import { esc, fmtDate, fmtDateVN } from './helpers.js';
import { toast } from './ui.js';

const TYPE_LABEL = {
  handover: "BIÊN BẢN BÀN GIAO THIẾT BỊ",
  return: "BIÊN BẢN THU HỒI THIẾT BỊ",
  transfer: "BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ",
  retire: "BIÊN BẢN THANH LÝ THIẾT BỊ"
};

function partyBlock(title, person) {
  if (!person) return "";
  return `
    <div class="bb-block">
      <h4>${esc(title)}</h4>
      <div class="bb-row"><b>Họ tên:</b> ${esc(person.name || "—")}</div>
      ${person.dept ? `<div class="bb-row"><b>Bộ phận:</b> ${esc(person.dept)}</div>` : ""}
      ${person.position ? `<div class="bb-row"><b>Chức vụ:</b> ${esc(person.position)}</div>` : ""}
    </div>
  `;
}

function signBlock(label) {
  return `<div><div class="cap">${esc(label)}</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>`;
}

function signatureRow(type) {
  if (type === "handover") return `${signBlock("Người bàn giao (IT)")}${signBlock("Người nhận thiết bị")}`;
  if (type === "return") return `${signBlock("Người bàn giao lại (nhân viên)")}${signBlock("Người tiếp nhận (IT)")}`;
  if (type === "transfer") return `${signBlock("Bên giao (nhân viên cũ)")}${signBlock("Bên nhận (nhân viên mới)")}${signBlock("Xác nhận (IT)")}`;
  return `${signBlock("Người lập biên bản (IT)")}${signBlock("Đại diện Ban Giám đốc")}`;
}

// payload = { type, device, from: {name,dept,position}|null, to: {...}|null, condition, note, date, byEmail }
export function buildReceiptHTML(payload) {
  const { type, device, from, to, condition, note, date, byEmail } = payload;
  const typeLabel = TYPE_LABEL[type] || "BIÊN BẢN";
  const s = state.settings || {};
  const refCode = `${(type || "bb").toUpperCase()}-${esc(device.id)}-${new Date(date || Date.now()).getTime().toString().slice(-6)}`;

  const fromTitle = type === "transfer" ? "Bên giao (nhân viên cũ)" : (type === "return" ? "Nhân viên bàn giao lại" : "Bên giao");
  const toTitle = type === "transfer" ? "Bên nhận (nhân viên mới)" : "Bên nhận / Người sử dụng";

  return `
    <div class="bb-page">
      <div class="bb-head">
        <div class="co">${esc(s.companyName || "Công ty TNHH Jeanic Garment")}</div>
        ${s.companyAddress ? `<div class="dept">${esc(s.companyAddress)}</div>` : ""}
        <div class="dept">${esc(s.companyDept || "Phòng Công nghệ thông tin")}</div>
        <h1>${typeLabel}</h1>
        <div>${fmtDateVN(date)}</div>
      </div>

      <div class="bb-block">
        <h4>Thông tin thiết bị</h4>
        <div class="bb-row"><b>Mã thiết bị:</b> ${esc(device.id)}</div>
        <div class="bb-row"><b>Loại / Thương hiệu:</b> ${esc(device.type)} — ${esc(device.brand)}</div>
        ${device.specs ? `<div class="bb-row"><b>Thông số:</b> ${esc(device.specs)}</div>` : ""}
        <div class="bb-row"><b>Tình trạng bàn giao:</b> ${esc(condition || device.condition)}</div>
      </div>

      ${partyBlock(fromTitle, from)}
      ${partyBlock(toTitle, to)}

      ${note ? `<div class="bb-block"><h4>Ghi chú</h4><div class="bb-row">${esc(note)}</div></div>` : ""}

      <div class="bb-terms">Các bên xác nhận đã kiểm tra tình trạng thiết bị và đồng ý với nội dung biên bản trên. Biên bản được lập thành các bản có giá trị như nhau, mỗi bên liên quan giữ 01 bản.</div>

      <div class="bb-sign">
        ${signatureRow(type)}
      </div>

      <div class="bb-meta-foot">Người lập phiếu: ${esc(byEmail || "—")} &nbsp;·&nbsp; Mã tham chiếu: ${refCode} &nbsp;·&nbsp; Ngày lập: ${fmtDate(date)}</div>
    </div>
  `;
}

function ensurePaperVisible() {
  const area = document.getElementById("print-area");
  area.classList.add("preview-open");
  return area;
}

export function openReceiptPreview(payload) {
  const area = document.getElementById("print-area");
  const html = buildReceiptHTML(payload);
  const filenameHint = `${payload.type || "bien-ban"}-${payload.device?.id || ""}`;
  area.dataset.pdfName = filenameHint;
  area.innerHTML = `
    <div class="print-toolbar">
      <button class="btn btn-ghost" onclick="app.closeReceiptPreview()"><i class="ph ph-x"></i> Đóng</button>
      <button class="btn btn-brand" onclick="app.printReceiptNow()"><i class="ph ph-printer"></i> In biên bản</button>
      <button class="btn btn-brand" onclick="app.exportReceiptPDF()"><i class="ph ph-file-pdf"></i> Xuất PDF</button>
    </div>
    ${html}
  `;
  ensurePaperVisible();
}

export function closeReceiptPreview() {
  const area = document.getElementById("print-area");
  area.classList.remove("preview-open");
  area.innerHTML = "";
}

export function printReceiptNow() {
  window.print();
}

export function exportReceiptPDF() {
  const area = document.getElementById("print-area");
  const paper = area.querySelector(".bb-page, .label-sheet");
  if (!paper || !window.html2pdf) { toast("Không thể xuất PDF (thiếu thư viện html2pdf)", "err"); return; }
  const filename = (area.dataset.pdfName || "bien-ban") + ".pdf";
  window.html2pdf().set({
    margin: 10,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(paper).save();
}

export function printAssetLabel(id) {
  const d = state.devices.find(x => x.id === id);
  if (!d) { toast("Không tìm thấy thiết bị", "err"); return; }

  const area = document.getElementById("print-area");
  area.dataset.pdfName = `tem-${d.id}`;
  area.innerHTML = `
    <div class="print-toolbar">
      <button class="btn btn-ghost" onclick="app.closeReceiptPreview()"><i class="ph ph-x"></i> Đóng</button>
      <button class="btn btn-brand" onclick="app.printReceiptNow()"><i class="ph ph-printer"></i> In tem</button>
      <button class="btn btn-brand" onclick="app.exportReceiptPDF()"><i class="ph ph-file-pdf"></i> Xuất PDF</button>
    </div>
    <div class="label-sheet">
      <div class="ls-head">${esc((state.settings || {}).companyName || "JEANIC GARMENT")} — TEM TÀI SẢN CNTT</div>
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
  ensurePaperVisible();

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
}
