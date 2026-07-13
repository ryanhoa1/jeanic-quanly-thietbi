import { state } from './db.js';
import { esc, fmtDate, fmtDateVN } from './helpers.js';
import { toast } from './ui.js';

const TYPE_LABEL = {
  handover: "BIÊN BẢN BÀN GIAO THIẾT BỊ",
  return: "BIÊN BẢN THU HỒI THIẾT BỊ",
  transfer: "BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ",
  retire: "BIÊN BẢN THANH LÝ THIẾT BỊ"
};

function signBlock(label) {
  return `<div><div class="cap">${esc(label)}</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>`;
}

function signatureRow(type) {
  if (type === "handover") return `${signBlock("Người bàn giao (IT)")}${signBlock("Người nhận thiết bị")}`;
  if (type === "return") return `${signBlock("Người bàn giao lại (nhân viên)")}${signBlock("Người tiếp nhận (IT)")}`;
  if (type === "transfer") return `${signBlock("Bên giao (nhân viên cũ)")}${signBlock("Bên nhận (nhân viên mới)")}${signBlock("Xác nhận (IT)")}`;
  return `${signBlock("Người lập biên bản (IT)")}${signBlock("Đại diện Ban Giám đốc")}`;
}

function partyFields(person, fallbackText) {
  if (person) {
    return `
      <div class="bb-row"><b>Họ tên:</b> ${esc(person.name || "—")}</div>
      ${person.dept ? `<div class="bb-row"><b>Bộ phận:</b> ${esc(person.dept)}</div>` : ""}
      ${person.position ? `<div class="bb-row"><b>Chức vụ:</b> ${esc(person.position)}</div>` : ""}
    `;
  }
  return `<div class="bb-row"><b>Đại diện:</b> ${esc(fallbackText)}</div>`;
}

function responsibilityAndCommitmentHTML() {
  return `
    <div class="bb-block bb-responsibility">
      <h4>III. QUY ĐỊNH TRÁCH NHIỆM CỦA NGƯỜI NHẬN (BÊN B)</h4>
      <div class="bb-sub"><b>1. Trách nhiệm quản lý và sử dụng:</b></div>
      <ul>
        <li>Sử dụng đúng mục đích công việc của công ty.</li>
        <li>Vận hành đúng kỹ thuật và vệ sinh định kỳ.</li>
        <li>Không tự ý thay đổi linh kiện, kết cấu thiết bị.</li>
        <li>Không cho người khác mượn khi chưa được phép.</li>
        <li>Báo cáo ngay cho bộ phận quản lý khi có sự cố.</li>
      </ul>
      <div class="bb-sub"><b>2. Xử lý khi hư hỏng, mất mát:</b></div>
      <ul>
        <li><b>Hao mòn tự nhiên / Bất khả kháng:</b> Công ty chịu chi phí sửa chữa, thay thế.</li>
        <li><b>Do lỗi cá nhân (cẩu thả, cố ý):</b> Nhân viên đền bù 100% chi phí sửa chữa hoặc giá trị tài sản.</li>
        <li><b>Làm mất thiết bị:</b> Nhân viên bồi thường thiết bị tương đương hoặc trừ tiền lương theo giá trị thị trường.</li>
        <li><b>Thời hạn báo cáo:</b> Phải thông báo bằng văn bản trong vòng 24 giờ kể từ khi xảy ra sự việc.</li>
      </ul>
    </div>

    <div class="bb-block bb-commit">
      <h4>IV. ĐIỀU KHOẢN CAM KẾT</h4>
      <ul>
        <li><b>Tự nguyện ký kết:</b> Hai bên đồng ý toàn bộ nội dung bàn giao và chịu trách nhiệm trước pháp luật.</li>
        <li><b>Cam kết bảo quản:</b> Người nhận cam kết quản lý, sử dụng thiết bị đúng quy định công ty.</li>
        <li><b>Chấp thuận đền bù:</b> Nếu làm mất hoặc hư hỏng do lỗi cá nhân, người nhận đồng ý bồi thường theo quyết định của công ty (hoặc trừ trực tiếp vào lương).</li>
        <li><b>Hiệu lực văn bản:</b> Biên bản có hiệu lực kể từ ngày ký và là căn cứ để thu hồi, điều chuyển thiết bị sau này.</li>
      </ul>
    </div>
  `;
}

function terminationNoteHTML() {
  return `
    <div class="bb-block">
      <h4>III. XÁC NHẬN CHẤM DỨT TRÁCH NHIỆM</h4>
      <div class="bb-row">Kể từ thời điểm ký biên bản này, trách nhiệm quản lý, sử dụng và bồi thường (nếu có) của Bên A đối với thiết bị nêu trên được chuyển giao lại cho Công ty; Bên A không còn chịu trách nhiệm bảo quản thiết bị kể từ thời điểm bàn giao.</div>
    </div>
  `;
}

// payload = { type, devices: [{device, condition}], from: {name,dept,position}|null, to: {...}|null, note, date, byEmail }
// (Tương thích ngược: payload.device + payload.condition đơn lẻ vẫn được chấp nhận.)
export function buildReceiptHTML(payload) {
  const { type, from, to, note, date, byEmail } = payload;
  const devicesList = payload.devices && payload.devices.length
    ? payload.devices
    : (payload.device ? [{ device: payload.device, condition: payload.condition }] : []);
  const typeLabel = TYPE_LABEL[type] || "BIÊN BẢN";
  const s = state.settings || {};
  const deptFallback = s.companyDept || "Phòng Công nghệ thông tin";
  const firstId = devicesList[0]?.device?.id || "TB";
  const refCode = `${(type || "bb").toUpperCase()}-${esc(firstId)}${devicesList.length > 1 ? `-va-${devicesList.length - 1}-TB-khac` : ""}-${new Date(date || Date.now()).getTime().toString().slice(-6)}`;

  let partyATitle, partyAPerson, partyBTitle, partyBPerson;
  if (type === "handover") {
    partyATitle = "BÊN A — Bên giao (Phòng CNTT)"; partyAPerson = null;
    partyBTitle = "BÊN B — Bên nhận (Người sử dụng)"; partyBPerson = to;
  } else if (type === "return") {
    partyATitle = "BÊN A — Bên giao lại (Người sử dụng)"; partyAPerson = from;
    partyBTitle = "BÊN B — Bên nhận (Phòng CNTT)"; partyBPerson = null;
  } else if (type === "transfer") {
    partyATitle = "BÊN A — Bên giao (Nhân viên cũ)"; partyAPerson = from;
    partyBTitle = "BÊN B — Bên nhận (Nhân viên mới)"; partyBPerson = to;
  } else {
    partyATitle = "Người lập biên bản (Phòng CNTT)"; partyAPerson = null;
    partyBTitle = "Đại diện Ban Giám đốc"; partyBPerson = null;
  }

  const showResponsibility = type === "handover" || type === "transfer";

  return `
    <div class="bb-page">
      <div class="bb-head">
        <img class="bb-logo" src="assets/logo.jpg" alt="Logo">
        <div class="co">${esc(s.companyName || "Công ty TNHH Jeanic Garment")}</div>
        ${s.companyAddress ? `<div class="dept">${esc(s.companyAddress)}</div>` : ""}
        <div class="dept">${esc(deptFallback)}</div>
        <h1>${typeLabel}</h1>
        <div>${fmtDateVN(date)}</div>
      </div>

      <div class="bb-block">
        <h4>I. THÔNG TIN THIẾT BỊ (${devicesList.length} thiết bị)</h4>
        <table class="bb-table">
          <tr><th>STT</th><th>Mã TB</th><th>Loại / Thương hiệu</th><th>Thông số</th><th>Tình trạng</th></tr>
          ${devicesList.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(item.device.id)}</td>
              <td>${esc(item.device.type)} — ${esc(item.device.brand)}</td>
              <td>${esc(item.device.specs || "—")}</td>
              <td>${esc(item.condition || item.device.condition)}</td>
            </tr>
          `).join("")}
        </table>
      </div>

      <div class="bb-block">
        <h4>II. THÔNG TIN CÁC BÊN</h4>
        <div class="bb-party-grid">
          <div class="bb-party">
            <div class="bb-party-title">${esc(partyATitle)}</div>
            ${partyFields(partyAPerson, deptFallback)}
          </div>
          <div class="bb-party">
            <div class="bb-party-title">${esc(partyBTitle)}</div>
            ${partyFields(partyBPerson, deptFallback)}
          </div>
        </div>
      </div>

      ${showResponsibility ? responsibilityAndCommitmentHTML() : (type === "return" ? terminationNoteHTML() : "")}

      ${note ? `<div class="bb-block"><h4>Ghi chú</h4><div class="bb-row">${esc(note)}</div></div>` : ""}

      ${!showResponsibility ? `<div class="bb-terms">Các bên xác nhận đã kiểm tra tình trạng thiết bị và đồng ý với nội dung biên bản trên. Biên bản được lập thành các bản có giá trị như nhau, mỗi bên liên quan giữ 01 bản.</div>` : ""}

      <div class="bb-sign">
        ${signatureRow(type)}
      </div>

      <div class="bb-meta-foot">Người lập phiếu: ${esc(byEmail || "—")} &nbsp;·&nbsp; Mã tham chiếu: ${refCode} &nbsp;·&nbsp; Ngày lập: ${fmtDate(date)}</div>
    </div>
  `;
}

// ---------- Biên bản kiểm kê tài sản theo nhân viên (phục vụ kiểm kê hàng năm) ----------
function inventorySummaryPageHTML(rows, s) {
  const totalDevices = rows.reduce((sum, r) => sum + r.devices.length, 0);
  return `
    <div class="bb-page">
      <div class="bb-head">
        <img class="bb-logo" src="assets/logo.jpg" alt="Logo">
        <div class="co">${esc(s.companyName || "Công ty TNHH Jeanic Garment")}</div>
        ${s.companyAddress ? `<div class="dept">${esc(s.companyAddress)}</div>` : ""}
        <h1>DANH SÁCH KIỂM KÊ TÀI SẢN CNTT THEO NHÂN VIÊN</h1>
        <div>${fmtDateVN(new Date().toISOString())}</div>
      </div>

      <div class="bb-block">
        <h4>DANH SÁCH TỔNG HỢP (${rows.length} nhân viên)</h4>
        <table class="bb-table">
          <tr><th>STT</th><th>Mã NV</th><th>Họ tên</th><th>Bộ phận</th><th>Số TB</th><th>Đã kiểm kê</th></tr>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(r.emp.id)}</td>
              <td>${esc(r.emp.name)}</td>
              <td>${esc(r.emp.dept || "—")}</td>
              <td>${r.devices.length}</td>
              <td></td>
            </tr>
          `).join("")}
        </table>
      </div>

      <div class="bb-meta-foot">Tổng số nhân viên: ${rows.length} &nbsp;·&nbsp; Tổng số thiết bị đang bàn giao: ${totalDevices} &nbsp;·&nbsp; Ngày lập: ${fmtDate(new Date().toISOString())}</div>
    </div>
  `;
}

function inventoryEmployeePageHTML(emp, devices, s) {
  return `
    <div class="bb-page">
      <div class="bb-head">
        <img class="bb-logo" src="assets/logo.jpg" alt="Logo">
        <div class="co">${esc(s.companyName || "Công ty TNHH Jeanic Garment")}</div>
        ${s.companyAddress ? `<div class="dept">${esc(s.companyAddress)}</div>` : ""}
        <h1>BIÊN BẢN KIỂM KÊ TÀI SẢN CNTT</h1>
        <div>${fmtDateVN(new Date().toISOString())}</div>
      </div>

      <div class="bb-block">
        <h4>I. THÔNG TIN NHÂN VIÊN</h4>
        <div class="bb-row"><b>Mã NV:</b> ${esc(emp.id)}</div>
        <div class="bb-row"><b>Họ tên:</b> ${esc(emp.name)}</div>
        <div class="bb-row"><b>Bộ phận:</b> ${esc(emp.dept || "—")}</div>
        ${emp.position ? `<div class="bb-row"><b>Chức vụ:</b> ${esc(emp.position)}</div>` : ""}
      </div>

      <div class="bb-block">
        <h4>II. DANH SÁCH THIẾT BỊ ĐANG NẮM GIỮ (${devices.length})</h4>
        <table class="bb-table">
          <tr><th>STT</th><th>Mã TB</th><th>Loại / Thương hiệu</th><th>Tình trạng (hệ thống)</th><th>Tình trạng thực tế</th><th>Ghi chú</th></tr>
          ${devices.map((d, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(d.id)}</td>
              <td>${esc(d.type)} — ${esc(d.brand)}</td>
              <td>${esc(d.condition)}</td>
              <td></td>
              <td></td>
            </tr>
          `).join("")}
        </table>
      </div>

      <div class="bb-terms">Nhân viên xác nhận đã kiểm tra và hiện đang giữ đầy đủ các thiết bị nêu trên, cam kết tiếp tục bảo quản theo đúng quy định của công ty. Mọi sai lệch (thiếu, hỏng, thất lạc) đã được ghi rõ ở cột "Ghi chú".</div>

      <div class="bb-sign">
        <div><div class="cap">Người kiểm kê (IT)</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>
        <div><div class="cap">Người xác nhận (Nhân viên)</div><div class="sub">(Ký, ghi rõ họ tên)</div></div>
      </div>
    </div>
  `;
}

// employees: danh sách nhân viên cần đưa vào báo cáo kiểm kê (vd: theo bộ lọc
// hiện tại của trang Nhân viên, hoặc toàn bộ). Mỗi nhân viên có thiết bị sẽ có
// 1 trang riêng để ký xác nhận; trang đầu là bảng tổng hợp toàn bộ danh sách.
export function buildInventoryChecklistHTML(employees) {
  const s = state.settings || {};
  const rows = employees.map(emp => ({ emp, devices: state.devices.filter(d => d.holderId === emp.id) }));
  let html = `<div class="bb-report">`;
  html += inventorySummaryPageHTML(rows, s);
  rows.forEach(row => {
    if (row.devices.length > 0) html += inventoryEmployeePageHTML(row.emp, row.devices, s);
  });
  html += `</div>`;
  return html;
}

export function openInventoryChecklistPreview(employees) {
  if (!employees || employees.length === 0) {
    toast("Không có nhân viên nào để in kiểm kê (kiểm tra lại bộ lọc)", "err");
    return;
  }
  const area = document.getElementById("print-area");
  const html = buildInventoryChecklistHTML(employees);
  const dateStamp = new Date().toISOString().slice(0, 10);
  area.dataset.pdfName = `kiem-ke-tai-san-${dateStamp}`;
  area.innerHTML = `
    <div class="print-toolbar">
      <button class="btn btn-ghost" onclick="app.closeReceiptPreview()"><i class="ph ph-x"></i> Đóng</button>
      <button class="btn btn-brand" onclick="app.printReceiptNow()"><i class="ph ph-printer"></i> In tất cả (${employees.length} nhân viên)</button>
      <button class="btn btn-brand" onclick="app.exportReceiptPDF()"><i class="ph ph-file-pdf"></i> Xuất PDF</button>
    </div>
    ${html}
  `;
  ensurePaperVisible();
}

function ensurePaperVisible() {
  const area = document.getElementById("print-area");
  area.classList.add("preview-open");
  return area;
}

export function openReceiptPreview(payload) {
  const area = document.getElementById("print-area");
  const html = buildReceiptHTML(payload);
  const list = payload.devices && payload.devices.length ? payload.devices : (payload.device ? [{ device: payload.device }] : []);
  const firstId = list[0]?.device?.id || "";
  const filenameHint = `${payload.type || "bien-ban"}-${firstId}${list.length > 1 ? `-va-${list.length - 1}-TB-khac` : ""}`;
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
  removeMiniLabelPageStyle();
}

export function printReceiptNow() {
  window.print();
}

export function exportReceiptPDF() {
  const area = document.getElementById("print-area");
  const paper = area.querySelector(".bb-report") || area.querySelector(".bb-page, .label-sheet");
  if (!paper || !window.html2pdf) { toast("Không thể xuất PDF (thiếu thư viện html2pdf)", "err"); return; }
  const filename = (area.dataset.pdfName || "bien-ban") + ".pdf";
  window.html2pdf().set({
    margin: 10,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  }).from(paper).save();
}

// Trang tra cứu công khai (không cần đăng nhập) — hiển thị ai đang quản lý thiết bị.
// Xem lookup.html + js/lookup.js. Cần bật chế độ Cloud (Firebase) để hoạt động khi
// quét từ điện thoại/máy khác; ở chế độ Local, link chỉ hiển thị được nếu mở trên
// đúng trình duyệt đã lưu dữ liệu.
export function buildLookupUrl(deviceId) {
  try {
    return new URL(`lookup.html?id=${encodeURIComponent(deviceId)}`, window.location.href).toString();
  } catch (e) {
    return `lookup.html?id=${encodeURIComponent(deviceId)}`;
  }
}

export function printAssetLabel(id) {
  const d = state.devices.find(x => x.id === id);
  if (!d) { toast("Không tìm thấy thiết bị", "err"); return; }

  const lookupUrl = buildLookupUrl(d.id);
  const area = document.getElementById("print-area");
  area.dataset.pdfName = `tem-${d.id}`;
  area.innerHTML = `
    <div class="print-toolbar">
      <button class="btn btn-ghost" onclick="app.closeReceiptPreview()"><i class="ph ph-x"></i> Đóng</button>
      <button class="btn btn-brand" onclick="app.printReceiptNow()"><i class="ph ph-printer"></i> In tem</button>
      <button class="btn btn-brand" onclick="app.exportReceiptPDF()"><i class="ph ph-file-pdf"></i> Xuất PDF</button>
    </div>
    <div class="label-sheet">
      <div class="ls-head"><img src="assets/logo.jpg" alt="Logo"> ${esc((state.settings || {}).companyName || "JEANIC GARMENT")} — TEM TÀI SẢN CNTT</div>
      <div class="label-grid">
        <div class="label-card">
          <div class="lc-id">${esc(d.id)}</div>
          <div class="lc-name">${esc(d.type)} — ${esc(d.brand)}</div>
          <div class="lc-holder">${d.holderName ? `Người quản lý: ${esc(d.holderName)}${d.dept ? " — " + esc(d.dept) : ""}` : "Đang trong kho — Phòng CNTT quản lý"}</div>
          <div class="lc-codes">
            <svg id="barcode-${d.id}"></svg>
            <div id="qrcode-${d.id}"></div>
          </div>
          <div class="lc-scan-hint">Quét mã QR để xem thông tin &amp; người quản lý hiện tại</div>
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
      // QR chứa LINK tới trang tra cứu công khai (không phải chỉ mã thiết bị),
      // để khi quét bằng điện thoại sẽ mở thẳng trang web hiển thị ai đang quản lý.
      new window.QRCode(document.getElementById(`qrcode-${d.id}`), { text: lookupUrl, width: 90, height: 90 });
    }
  } catch (e) {
    console.error("Lỗi tạo mã vạch/QR:", e);
  }
}

// Tem QR nhỏ dạng cuộn/khổ giấy 20x20mm — chỉ hiển thị mã QR + mã thiết bị, canh giữa trang in.
// Dùng cho máy in tem nhãn (label printer) nạp giấy khổ 20x20mm.
const MINI_LABEL_PAGE_STYLE_ID = "mini-label-page-style";

function ensureMiniLabelPageStyle() {
  if (document.getElementById(MINI_LABEL_PAGE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = MINI_LABEL_PAGE_STYLE_ID;
  style.textContent = `
    @media print {
      @page mini-label-page { size: 20mm 20mm; margin: 0; }
      .label-mini-page { page: mini-label-page; }
    }
  `;
  document.head.appendChild(style);
}

function removeMiniLabelPageStyle() {
  const el = document.getElementById(MINI_LABEL_PAGE_STYLE_ID);
  if (el) el.remove();
}

export function printAssetLabelMini(id) {
  const d = state.devices.find(x => x.id === id);
  if (!d) { toast("Không tìm thấy thiết bị", "err"); return; }

  const lookupUrl = buildLookupUrl(d.id);
  const area = document.getElementById("print-area");
  area.dataset.pdfName = `tem-nho-${d.id}`;
  area.innerHTML = `
    <div class="print-toolbar">
      <button class="btn btn-ghost" onclick="app.closeReceiptPreview()"><i class="ph ph-x"></i> Đóng</button>
      <button class="btn btn-brand" onclick="app.printReceiptNow()"><i class="ph ph-printer"></i> In tem 20×20mm</button>
      <button class="btn btn-brand" onclick="app.exportReceiptPDF()"><i class="ph ph-file-pdf"></i> Xuất PDF</button>
    </div>
    <div class="label-mini-wrap">
      <div class="label-mini-page">
        <div class="lmp-qr" id="qrcode-mini-${d.id}"></div>
        <div class="lmp-id">${esc(d.id)}</div>
      </div>
    </div>
  `;
  ensurePaperVisible();
  ensureMiniLabelPageStyle();

  try {
    if (window.QRCode) {
      // QR chứa link tra cứu, kích thước render cao (300px) rồi co lại vừa khổ 20x20mm bằng CSS để nét khi in.
      new window.QRCode(document.getElementById(`qrcode-mini-${d.id}`), {
        text: lookupUrl, width: 300, height: 300, correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined
      });
    }
  } catch (e) {
    console.error("Lỗi tạo mã QR (tem nhỏ):", e);
  }
}
