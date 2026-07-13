import { state, STATUS_META, DEPARTMENTS, CONDITIONS, DEVICE_TYPES, BRANDS, ASSET_CATEGORIES, ASSET_GROUPS, CATEGORY_FIELDS, getCategoryId, getCategoryMeta } from './db.js';
import { fmtVND, fmtDate, fmtDateTime, computeAlerts, computeDepreciation, warrantyInfo, repairTotal, esc } from './helpers.js';
import { emptyState } from './ui.js';

export function renderDashboard() {
  const total = state.devices.length;
  const byStatus = {};
  state.devices.forEach(d => byStatus[d.status] = (byStatus[d.status] || 0) + 1);
  
  const recent = [];
  state.devices.forEach(d => (d.history || []).forEach(h => recent.push({ ...h, deviceId: d.id, deviceType: d.type })));
  recent.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let totalInvested = 0, totalBookValue = 0;
  state.devices.forEach(d => {
    const dep = computeDepreciation(d);
    if (dep.hasData) {
      totalInvested += dep.price;
      totalBookValue += dep.bookValue;
    }
  });
  
  const alerts = computeAlerts();

  return `
    <div class="grid-stats">
      <div class="stat-card">
        <div class="n">${total}</div>
        <div class="l">Tổng thiết bị</div>
      </div>
      <div class="stat-card accent-success">
        <div class="n">${byStatus["Đang sử dụng"] || 0}</div>
        <div class="l">Đang sử dụng</div>
      </div>
      <div class="stat-card accent-brand">
        <div class="n">${byStatus["Trong kho"] || 0}</div>
        <div class="l">Trong kho</div>
      </div>
      <div class="stat-card accent-warning">
        <div class="n">${byStatus["Bảo trì"] || 0}</div>
        <div class="l">Đang bảo trì</div>
      </div>
      <div class="stat-card accent-danger">
        <div class="n">${byStatus["Thanh lý"] || 0}</div>
        <div class="l">Đã thanh lý</div>
      </div>
    </div>
    
    <div class="grid-stats" style="grid-template-columns: repeat(3, 1fr);">
      <div class="stat-card accent-brand">
        <div class="n" style="font-size: 24px;">${fmtVND(totalInvested)}</div>
        <div class="l">Tổng giá trị đầu tư</div>
      </div>
      <div class="stat-card accent-success">
        <div class="n" style="font-size: 24px;">${fmtVND(totalBookValue)}</div>
        <div class="l">Giá trị còn lại ước tính</div>
      </div>
      <div class="stat-card ${alerts.length ? 'accent-danger' : 'accent-success'}">
        <div class="n">${alerts.length}</div>
        <div class="l">Thiết bị cần chú ý</div>
      </div>
    </div>
    
    <div class="panel">
      <div class="panel-head">
        <h3><i class="ph ph-warning-circle"></i> Cần chú ý</h3>
        <button class="btn btn-sm btn-ghost" onclick="app.setView('finance')">Tài chính & Khấu hao <i class="ph ph-arrow-right"></i></button>
      </div>
      ${alerts.length === 0 ? emptyState("Không có cảnh báo", "Hệ thống đang hoạt động ổn định.") : `
      <div class="table-responsive">
        <table class="data">
          <tr><th>Thiết bị</th><th>Cảnh báo</th></tr>
          ${alerts.slice(0, 8).map(a => `
            <tr class="rowclick" onclick="app.setView('device','${a.device.id}')">
              <td>
                <div class="cell-title">${esc(a.device.id)}</div>
                <div class="cell-sub">${esc(a.device.type)}</div>
              </td>
              <td>
                <span class="pill ${a.kind === 'warranty' ? 'pill-warning' : a.kind === 'warranty-expired' ? 'pill-danger' : a.kind === 'depreciation' ? 'pill-slate' : 'pill-danger'}">
                  ${esc(a.text)}
                </span>
              </td>
            </tr>`).join("")}
        </table>
      </div>`}
    </div>
    
    <div class="panel">
      <div class="panel-head">
        <h3><i class="ph ph-clock-counter-clockwise"></i> Hoạt động gần đây</h3>
        <button class="btn btn-sm btn-ghost" onclick="app.setView('history')">Xem tất cả <i class="ph ph-arrow-right"></i></button>
      </div>
      ${recent.length === 0 ? emptyState("Chưa có hoạt động nào", "Các sự kiện bàn giao, thu hồi sẽ hiển thị ở đây.") : `
      <div class="table-responsive">
        <table class="data">
          <tr><th>Ngày</th><th>Thiết bị</th><th>Sự kiện</th><th>Chi tiết</th></tr>
          ${recent.slice(0, 8).map(h => `
            <tr>
              <td style="font-family: var(--font-mono); font-size: 12px;">${fmtDateTime(h.date)}</td>
              <td>
                <div class="cell-title">${esc(h.deviceId)}</div>
                <div class="cell-sub">${esc(h.deviceType || "")}</div>
              </td>
              <td>${esc(h.label)}</td>
              <td class="cell-sub">${esc(h.to ? h.to : (h.note || "—"))}</td>
            </tr>`).join("")}
        </table>
      </div>`}
    </div>
  `;
}

function categoryTabsHTML(activeCat) {
  const current = activeCat || "all";
  const groupBlocks = ASSET_GROUPS.map(g => {
    const cats = ASSET_CATEGORIES.filter(c => c.group === g.id);
    if (cats.length === 0) return "";
    return `
      <span class="cat-group-divider" title="${esc(g.sub || '')}">${esc(g.label)}</span>
      ${cats.map(c => `
        <button class="cat-tab ${current === c.id ? 'active' : ''}" onclick="app.setDeviceCategory('${c.id}')">
          <i class="ph ${c.ico}"></i> ${esc(c.label)}
        </button>
      `).join("")}
    `;
  }).join("");

  return `
    <div class="cat-tabs">
      <button class="cat-tab ${current === 'all' ? 'active' : ''}" onclick="app.setDeviceCategory('all')">
        <i class="ph ph-squares-four"></i> Tất cả
      </button>
      ${groupBlocks}
    </div>
  `;
}

export function renderDevices(filter) {
  const q = filter.q.toLowerCase();
  const activeCat = filter.category || "all";
  const extraFields = activeCat !== "all" ? (CATEGORY_FIELDS[activeCat] || []) : [];

  const list = state.devices.filter(d => {
    if (activeCat !== "all" && getCategoryId(d.type) !== activeCat) return false;
    if (filter.status !== "all" && d.status !== filter.status) return false;
    if (filter.dept !== "all" && d.dept !== filter.dept) return false;
    if (q && !(`${d.id} ${d.type} ${d.brand} ${d.holderName || ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
  
  const alertIds = new Set(computeAlerts().map(a => a.device.id));

  let html = categoryTabsHTML(activeCat);

  html += `
    <div class="toolbar">
      <div class="input-wrap" style="flex:1; min-width: 250px;">
        <i class="ph ph-magnifying-glass"></i>
        <input type="search" placeholder="Tìm theo mã TB, loại, thương hiệu, người dùng…" value="${esc(filter.q)}" oninput="app.setDeviceFilter('q', this.value)">
      </div>
      <select onchange="app.setDeviceFilter('status', this.value)">
        <option value="all">Tất cả trạng thái</option>
        ${Object.keys(STATUS_META).map(s => `<option value="${s}" ${filter.status === s ? 'selected' : ''}>${s}</option>`).join("")}
      </select>
      <select onchange="app.setDeviceFilter('dept', this.value)">
        <option value="all">Tất cả bộ phận</option>
        ${DEPARTMENTS.map(dp => `<option value="${dp}" ${filter.dept === dp ? 'selected' : ''}>${dp}</option>`).join("")}
      </select>
      <button class="btn btn-ghost" onclick="app.exportDevicesForCategory('${activeCat}')" title="Xuất ${activeCat === 'all' ? 'toàn bộ danh sách' : 'nhóm này'} ra Excel">
        <i class="ph ph-file-xls"></i> Xuất Excel
      </button>
      <button class="btn btn-ghost" onclick="app.downloadDeviceImportTemplate('${activeCat}')" title="Tải file mẫu để điền và nhập thiết bị">
        <i class="ph ph-file-arrow-down"></i> Tải mẫu
      </button>
      <button class="btn btn-brand" onclick="app.triggerImportFilePicker('${activeCat}')" title="Nhập nhiều thiết bị cùng lúc từ file Excel">
        <i class="ph ph-file-arrow-up"></i> Nhập Excel
      </button>
      <button class="btn btn-ghost" onclick="app.triggerGlpiImportFilePicker()" title="Đồng bộ thiết bị từ file Excel xuất ra từ GLPI (Computers/Monitors/Peripherals...)">
        <i class="ph ph-arrows-clockwise"></i> Đồng bộ GLPI
      </button>
    </div>
    
    <div class="panel">
  `;

  if (list.length === 0) {
    html += emptyState("Không tìm thấy thiết bị", "Thử đổi bộ lọc hoặc thêm thiết bị mới.");
  } else {
    html += `
      <div class="table-responsive">
        <table class="data">
          <tr>
            <th>Mã TB</th>
            <th>Loại / Thương hiệu</th>
            ${extraFields.map(f => `<th>${esc(f.label)}</th>`).join("")}
            <th>Tình trạng</th>
            <th>Trạng thái</th>
            <th>Người dùng</th>
            <th>Bộ phận</th>
            <th>Cảnh báo</th>
            <th></th>
          </tr>
          ${list.map(d => `
            <tr class="rowclick" onclick="app.setView('device','${d.id}')">
              <td><b style="color:#fff; font-family: var(--font-mono);">${esc(d.id)}</b></td>
              <td><div class="cell-title">${esc(d.type)}</div><div class="cell-sub">${esc(d.brand)}</div></td>
              ${extraFields.map(f => `<td class="cell-sub">${esc((d.attrs && d.attrs[f.key]) || "—")}</td>`).join("")}
              <td>${esc(d.condition)}</td>
              <td><span class="pill ${STATUS_META[d.status]?.pill || 'pill-slate'}">${esc(d.status)}</span></td>
              <td>${esc(d.holderName || "—")}</td>
              <td>${esc(d.dept || "—")}</td>
              <td>${alertIds.has(d.id) ? '<span class="pill pill-danger"><i class="ph ph-warning"></i> Chú ý</span>' : ""}</td>
              <td onclick="event.stopPropagation();">
                <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabel('${d.id}')" title="In tem (khổ A4)">
                  <i class="ph ph-qr-code"></i>
                </button>
                <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabelMini('${d.id}')" title="In tem nhỏ 20×20mm">
                  <i class="ph ph-tag-simple"></i>
                </button>
                <button class="btn btn-sm btn-ghost" onclick="app.duplicateDeviceForm('${d.id}')" title="Nhân đôi — tạo thiết bị mới từ thông tin thiết bị này">
                  <i class="ph ph-copy"></i>
                </button>
                <button class="btn btn-sm btn-ghost btn-danger-ghost" onclick="app.deleteDevice('${d.id}')" title="Xoá thiết bị">
                  <i class="ph ph-trash"></i>
                </button>
              </td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}

// ---------- Device Detail ----------
export function renderDeviceDetail(id) {
  const d = state.devices.find(x => x.id === id);
  if (!d) return emptyState("Không tìm thấy thiết bị", "Thiết bị có thể đã bị xoá.");

  const dep = computeDepreciation(d);
  const war = warrantyInfo(d);
  const rTotal = repairTotal(d);
  const history = d.history || [];
  const catId = getCategoryId(d.type);
  const catMeta = getCategoryMeta(catId);
  const attrFields = (CATEGORY_FIELDS[catId] || []).filter(f => d.attrs && d.attrs[f.key]);

  return `
    <div style="margin-bottom:16px;">
      <button class="btn btn-sm btn-ghost" onclick="app.setView('devices')"><i class="ph ph-arrow-left"></i> Quay lại danh sách</button>
    </div>
    <div class="detail-grid">
      <div>
        <div class="panel">
          <div class="panel-head">
            <h3><i class="ph ph-laptop"></i> ${esc(d.id)} — ${esc(d.type)}</h3>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm btn-ghost" onclick="app.openDeviceForm('${d.id}')"><i class="ph ph-pencil-simple"></i> Sửa</button>
              <button class="btn btn-sm btn-ghost" onclick="app.duplicateDeviceForm('${d.id}')" title="Tạo thiết bị mới từ thông tin thiết bị này"><i class="ph ph-copy"></i> Nhân đôi</button>
              <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabel('${d.id}')"><i class="ph ph-qr-code"></i> In tem (A4)</button>
              <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabelMini('${d.id}')"><i class="ph ph-tag-simple"></i> In tem 20×20mm</button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteDevice('${d.id}')"><i class="ph ph-trash"></i> Xoá</button>
            </div>
          </div>
          <div class="kv"><b>Mã thiết bị</b><span style="font-family:var(--font-mono);">${esc(d.id)}</span></div>
          <div class="kv"><b>Nhóm tài sản</b><span class="pill pill-slate"><i class="ph ${catMeta?.ico || 'ph-question'}"></i> ${esc(catMeta?.label || "Khác")}</span></div>
          <div class="kv"><b>Loại</b><span>${esc(d.type)}</span></div>
          <div class="kv"><b>Thương hiệu</b><span>${esc(d.brand)}</span></div>
          <div class="kv"><b>Tình trạng</b><span>${esc(d.condition)}</span></div>
          <div class="kv"><b>Trạng thái</b><span class="pill ${STATUS_META[d.status]?.pill || 'pill-slate'}">${esc(d.status)}</span></div>
          <div class="kv"><b>Người dùng</b><span>${esc(d.holderName || "—")}</span></div>
          <div class="kv"><b>Bộ phận</b><span>${esc(d.dept || "—")}</span></div>
          <div class="kv"><b>Ngày nhập</b><span>${fmtDate(d.importDate)}</span></div>
          <div style="margin-top:16px;">
            <b style="font-size:12.5px; color:var(--text-muted); display:block; margin-bottom:8px;">Thông số kỹ thuật</b>
            <div class="specs-box">${esc(d.specs || "—")}</div>
          </div>
          ${attrFields.length > 0 ? `
          <div style="margin-top:16px;">
            <b style="font-size:12.5px; color:var(--text-muted); display:block; margin-bottom:8px;">Thông số chuyên biệt (${esc(catMeta?.label || "")})</b>
            ${attrFields.map(f => `<div class="kv"><b>${esc(f.label)}</b><span>${esc(d.attrs[f.key])}</span></div>`).join("")}
          </div>` : ""}
        </div>

        <div class="panel">
          <div class="panel-head"><h3><i class="ph ph-clock-counter-clockwise"></i> Lịch sử thiết bị</h3></div>
          ${history.length === 0 ? emptyState("Chưa có lịch sử", "") : `
          <div class="timeline">
            ${history.map((h, idx) => `
              <div class="tl-item">
                <div class="tl-date">${fmtDateTime(h.date)}</div>
                <div class="tl-label">${esc(h.label)}</div>
                <div class="tl-detail">
                  ${h.from ? `Từ: ${esc(h.from)}<br>` : ""}
                  ${h.to ? `Đến: ${esc(h.to)}${h.dept ? " — " + esc(h.dept) : ""}<br>` : ""}
                  ${h.condition ? `Tình trạng: ${esc(h.condition)}<br>` : ""}
                  ${h.note ? esc(h.note) + "<br>" : ""}
                  <span style="color:var(--text-muted);">Bởi: ${esc(h.by || "—")}</span>
                  ${["ban_giao", "thu_hoi", "dieu_chuyen"].includes(h.type) ? `
                    <div style="margin-top:8px;">
                      <button class="btn btn-sm btn-ghost" onclick="app.reprintHistoryReceipt('${d.id}', ${idx})">
                        <i class="ph ph-printer"></i> In biên bản
                      </button>
                    </div>` : ""}
                </div>
              </div>
            `).join("")}
          </div>`}
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-head"><h3><i class="ph ph-coins"></i> Tài chính</h3></div>
          <div class="kv"><b>Giá mua</b><span>${fmtVND(d.purchasePrice)}</span></div>
          <div class="kv"><b>Ngày mua</b><span>${fmtDate(d.purchaseDate)}</span></div>
          <div class="kv"><b>Nhà cung cấp</b><span>${esc(d.vendor || "—")}</span></div>
          <div class="kv"><b>Số hoá đơn</b><span>${esc(d.invoiceNo || "—")}</span></div>
          ${dep.hasData ? `
          <div class="kv"><b>Giá trị còn lại</b><span>${fmtVND(dep.bookValue)}</span></div>
          <div class="kv"><b>Đã khấu hao</b><span>${dep.percentUsed}%</span></div>
          ` : `<div class="kv"><b>Khấu hao</b><span>Chưa đủ dữ liệu</span></div>`}
        </div>

        <div class="panel">
          <div class="panel-head"><h3><i class="ph ph-shield-check"></i> Bảo hành</h3></div>
          ${war.hasData ? `
          <div class="kv"><b>Hết hạn</b><span>${fmtDate(war.endISO)}</span></div>
          <div class="kv"><b>Còn lại</b><span>${war.expired ? `Đã hết ${Math.abs(war.daysLeft)} ngày` : `${war.daysLeft} ngày`}</span></div>
          ` : `<div class="kv"><b>Bảo hành</b><span>Chưa có dữ liệu</span></div>`}
        </div>

        <div class="panel">
          <div class="panel-head">
            <h3><i class="ph ph-wrench"></i> Sửa chữa</h3>
            <button class="btn btn-sm btn-brand" onclick="app.openRepairForm('${d.id}')"><i class="ph ph-plus"></i></button>
          </div>
          ${(!d.repairs || d.repairs.length === 0) ? emptyState("Chưa có sửa chữa", "") : `
          <div class="table-responsive">
            <table class="data">
              <tr><th>Ngày</th><th>Nội dung</th><th>Chi phí</th></tr>
              ${d.repairs.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.desc)}</td><td>${fmtVND(r.cost)}</td></tr>`).join("")}
              <tr><td colspan="2"><b>Tổng</b></td><td><b>${fmtVND(rTotal)}</b></td></tr>
            </table>
          </div>`}
        </div>
      </div>
    </div>
  `;
}

// ---------- Employees ----------
export function filterEmployeesList(filter) {
  const q = (filter.q || "").toLowerCase();
  return state.employees.filter(e => {
    if (filter.dept && filter.dept !== "all" && e.dept !== filter.dept) return false;
    if (q && !(`${e.id} ${e.name} ${e.email || ""} ${e.position || ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

export function renderEmployees(filter) {
  const list = filterEmployeesList(filter);

  let html = `
    <div class="toolbar">
      <div class="input-wrap" style="flex:1; min-width:250px;">
        <i class="ph ph-magnifying-glass"></i>
        <input type="search" placeholder="Tìm theo mã NV, tên, email…" value="${esc(filter.q || "")}" oninput="app.setEmployeeFilter('q', this.value)">
      </div>
      <select onchange="app.setEmployeeFilter('dept', this.value)">
        <option value="all">Tất cả bộ phận</option>
        ${DEPARTMENTS.map(dp => `<option value="${dp}" ${filter.dept === dp ? 'selected' : ''}>${dp}</option>`).join("")}
      </select>
      <button class="btn btn-ghost" onclick="app.exportEmployeesExcel()" title="Xuất danh sách nhân viên ra Excel">
        <i class="ph ph-file-xls"></i> Xuất Excel
      </button>
      <button class="btn btn-ghost" onclick="app.downloadEmployeeImportTemplate()" title="Tải file mẫu để điền và nhập nhân viên">
        <i class="ph ph-file-arrow-down"></i> Tải mẫu
      </button>
      <button class="btn btn-brand" onclick="app.triggerEmployeeImportFilePicker()" title="Nhập nhiều nhân viên cùng lúc từ file Excel">
        <i class="ph ph-file-arrow-up"></i> Nhập Excel
      </button>
      <button class="btn btn-ghost" onclick="app.printInventoryChecklist()" title="In danh sách tài sản từng nhân viên đang giữ, phục vụ kiểm kê hàng năm">
        <i class="ph ph-printer"></i> In kiểm kê
      </button>
    </div>
    <div class="panel">
  `;

  if (list.length === 0) {
    html += emptyState("Không tìm thấy nhân viên", "Thử đổi bộ lọc hoặc thêm nhân viên mới.");
  } else {
    const deviceCountOf = (empId) => state.devices.filter(d => d.holderId === empId).length;
    html += `
      <div class="table-responsive">
        <table class="data">
          <tr>
            <th>Mã NV</th><th>Họ tên</th><th>Bộ phận</th><th>Chức vụ</th><th>Liên hệ</th><th>Trạng thái</th><th>Thiết bị</th><th></th>
          </tr>
          ${list.map(e => `
            <tr class="rowclick" onclick="app.setView('employee','${e.id}')">
              <td><b style="color:#fff; font-family: var(--font-mono);">${esc(e.id)}</b></td>
              <td class="cell-title">${esc(e.name)}</td>
              <td>${esc(e.dept || "—")}</td>
              <td>${esc(e.position || "—")}</td>
              <td class="cell-sub">${esc(e.email || "—")}<br>${esc(e.phone || "")}</td>
              <td><span class="pill ${e.status === 'Đang làm việc' ? 'pill-success' : 'pill-slate'}">${esc(e.status || "—")}</span></td>
              <td>${deviceCountOf(e.id)}</td>
              <td onclick="event.stopPropagation();">
                <button class="btn btn-sm btn-ghost" onclick="app.openEmployeeForm('${e.id}')" title="Sửa"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn btn-sm btn-ghost btn-danger-ghost" onclick="app.deleteEmployee('${e.id}')" title="Xoá"><i class="ph ph-trash"></i></button>
              </td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }
  html += `</div>`;
  return html;
}

// ---------- Self-service portal (per-account) ----------
// Resolves which employee record an account "belongs to": first by the
// explicit employeeId link set by an admin, falling back to a case-insensitive
// email match so accounts work out of the box before an admin gets to link them.
export function resolveMyEmployee(account, email) {
  if (account && account.employeeId) {
    const e = state.employees.find(x => x.id === account.employeeId);
    if (e) return e;
  }
  if (email) {
    const lower = email.toLowerCase();
    return state.employees.find(x => (x.email || "").toLowerCase() === lower) || null;
  }
  return null;
}

export function renderMyDevices(account, email) {
  const emp = resolveMyEmployee(account, email);

  if (!emp) {
    return `
      <div class="panel">
        ${emptyState(
          "Chưa liên kết hồ sơ nhân viên",
          "Tài khoản của bạn chưa được gắn với một hồ sơ nhân viên trong hệ thống, nên chưa thể hiển thị danh sách thiết bị. Vui lòng liên hệ Phòng Công nghệ thông tin để được liên kết tài khoản."
        )}
      </div>
    `;
  }

  const currentDevices = state.devices.filter(d => d.holderId === emp.id);
  const relatedHistory = [];
  state.devices.forEach(d => (d.history || []).forEach(h => {
    if (h.to === emp.name || h.from === emp.name) {
      relatedHistory.push({ ...h, deviceId: d.id, deviceType: d.type });
    }
  }));
  relatedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  return `
    <div class="detail-grid">
      <div>
        <div class="panel">
          <div class="panel-head"><h3><i class="ph ph-user"></i> Thông tin của bạn</h3></div>
          <div class="kv"><b>Mã nhân viên</b><span style="font-family:var(--font-mono);">${esc(emp.id)}</span></div>
          <div class="kv"><b>Họ tên</b><span>${esc(emp.name)}</span></div>
          <div class="kv"><b>Bộ phận</b><span>${esc(emp.dept || "—")}</span></div>
          <div class="kv"><b>Chức vụ</b><span>${esc(emp.position || "—")}</span></div>
          <div class="kv"><b>Trạng thái</b><span class="pill ${emp.status === 'Đang làm việc' ? 'pill-success' : 'pill-slate'}">${esc(emp.status || "—")}</span></div>
        </div>

        ${relatedHistory.length > 0 ? `
        <div class="panel">
          <div class="panel-head"><h3><i class="ph ph-clock-counter-clockwise"></i> Lịch sử bàn giao / thu hồi của bạn</h3></div>
          <div class="table-responsive">
            <table class="data">
              <tr><th>Ngày</th><th>Thiết bị</th><th>Sự kiện</th><th>Chi tiết</th></tr>
              ${relatedHistory.slice(0, 30).map(h => `
                <tr>
                  <td style="font-family: var(--font-mono); font-size: 12px;">${fmtDateTime(h.date)}</td>
                  <td><div class="cell-title">${esc(h.deviceId)}</div><div class="cell-sub">${esc(h.deviceType || "")}</div></td>
                  <td>${esc(h.label)}</td>
                  <td class="cell-sub">${esc(h.to ? ("→ " + h.to) : (h.from ? ("từ " + h.from) : (h.note || "—")))}</td>
                </tr>`).join("")}
            </table>
          </div>
        </div>` : ""}
      </div>

      <div>
        <div class="panel">
          <div class="panel-head">
            <h3><i class="ph ph-laptop"></i> Thiết bị bạn đang được bàn giao (${currentDevices.length})</h3>
          </div>
          ${currentDevices.length === 0 ? emptyState("Chưa được bàn giao thiết bị nào", "Hiện bạn không được giao thiết bị nào trong hệ thống.") : `
          <div class="table-responsive">
            <table class="data">
              <tr><th>Mã TB</th><th>Loại / Thương hiệu</th><th>Tình trạng</th><th>Trạng thái</th></tr>
              ${currentDevices.map(d => `
                <tr>
                  <td><b style="color:#fff; font-family: var(--font-mono);">${esc(d.id)}</b></td>
                  <td><div class="cell-title">${esc(d.type)}</div><div class="cell-sub">${esc(d.brand)}</div></td>
                  <td>${esc(d.condition)}</td>
                  <td><span class="pill ${STATUS_META[d.status]?.pill || 'pill-slate'}">${esc(d.status)}</span></td>
                </tr>
              `).join("")}
            </table>
          </div>`}
        </div>
      </div>
    </div>
  `;
}

export function renderMyAccount(email, role, account, useFirebase) {
  const emp = resolveMyEmployee(account, email);
  const mfaOn = !!(account && account.mfaEnabled);

  return `
    <div class="detail-grid">
      <div class="panel">
        <div class="panel-head"><h3><i class="ph ph-identification-card"></i> Thông tin tài khoản</h3></div>
        <div class="kv"><b>Email</b><span>${esc(email || "—")}</span></div>
        <div class="kv"><b>Vai trò</b><span class="pill pill-brand">${role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</span></div>
        <div class="kv"><b>Hồ sơ nhân viên liên kết</b><span>${emp ? `${esc(emp.name)} (${esc(emp.id)})` : 'Chưa liên kết — liên hệ IT'}</span></div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3><i class="ph ph-shield-check"></i> Xác thực 2 lớp (MFA)</h3></div>
        ${!useFirebase ? `
          ${emptyState("Không khả dụng ở chế độ offline", "MFA chỉ hoạt động khi ứng dụng kết nối Firebase (chế độ online).")}
        ` : `
          <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
            Khi bật, mỗi lần đăng nhập bạn sẽ cần nhập thêm mã 6 số từ ứng dụng xác thực
            (Google Authenticator, Microsoft Authenticator, Authy…) sau khi nhập đúng mật khẩu.
            Việc này giúp bảo vệ tài khoản ngay cả khi mật khẩu bị lộ.
          </p>
          <div class="kv"><b>Trạng thái</b><span class="pill ${mfaOn ? 'pill-success' : 'pill-slate'}">${mfaOn ? 'Đã bật' : 'Chưa bật'}</span></div>
          ${mfaOn
            ? `<button class="btn btn-ghost" onclick="app.openDisableMfaModal()"><i class="ph ph-shield-slash"></i> Tắt MFA</button>`
            : `<button class="btn btn-brand" onclick="app.startMfaSetup()"><i class="ph ph-shield-plus"></i> Bật MFA</button>`
          }
        `}
      </div>
    </div>
  `;
}

// ---------- Employee Detail ----------
export function renderEmployeeDetail(id) {
  const e = state.employees.find(x => x.id === id);
  if (!e) return emptyState("Không tìm thấy nhân viên", "Nhân viên có thể đã bị xoá.");

  // Thiết bị đang được nhân viên này nắm giữ
  const currentDevices = state.devices.filter(d => d.holderId === e.id);

  // Lịch sử liên quan đến nhân viên này (đã từng nhận/trả/điều chuyển) dựa vào tên xuất hiện trong lịch sử thiết bị
  const relatedHistory = [];
  state.devices.forEach(d => (d.history || []).forEach(h => {
    if (h.to === e.name || h.from === e.name) {
      relatedHistory.push({ ...h, deviceId: d.id, deviceType: d.type });
    }
  }));
  relatedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  return `
    <div style="margin-bottom:16px;">
      <button class="btn btn-sm btn-ghost" onclick="app.setView('employees')"><i class="ph ph-arrow-left"></i> Quay lại danh sách</button>
    </div>
    <div class="detail-grid">
      <div>
        <div class="panel">
          <div class="panel-head">
            <h3><i class="ph ph-user"></i> ${esc(e.name)}</h3>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm btn-ghost" onclick="app.printInventoryChecklistFor('${e.id}')"><i class="ph ph-printer"></i> In kiểm kê</button>
              <button class="btn btn-sm btn-ghost" onclick="app.openEmployeeForm('${e.id}')"><i class="ph ph-pencil-simple"></i> Sửa</button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteEmployee('${e.id}')"><i class="ph ph-trash"></i> Xoá</button>
            </div>
          </div>
          <div class="kv"><b>Mã nhân viên</b><span style="font-family:var(--font-mono);">${esc(e.id)}</span></div>
          <div class="kv"><b>Bộ phận</b><span>${esc(e.dept || "—")}</span></div>
          <div class="kv"><b>Chức vụ</b><span>${esc(e.position || "—")}</span></div>
          <div class="kv"><b>Email</b><span>${esc(e.email || "—")}</span></div>
          <div class="kv"><b>Điện thoại</b><span>${esc(e.phone || "—")}</span></div>
          <div class="kv"><b>Trạng thái</b><span class="pill ${e.status === 'Đang làm việc' ? 'pill-success' : 'pill-slate'}">${esc(e.status || "—")}</span></div>
        </div>

        ${relatedHistory.length > 0 ? `
        <div class="panel">
          <div class="panel-head"><h3><i class="ph ph-clock-counter-clockwise"></i> Lịch sử bàn giao / thu hồi liên quan</h3></div>
          <div class="table-responsive">
            <table class="data">
              <tr><th>Ngày</th><th>Thiết bị</th><th>Sự kiện</th><th>Chi tiết</th></tr>
              ${relatedHistory.slice(0, 30).map(h => `
                <tr class="rowclick" onclick="app.setView('device','${h.deviceId}')">
                  <td style="font-family: var(--font-mono); font-size: 12px;">${fmtDateTime(h.date)}</td>
                  <td><div class="cell-title">${esc(h.deviceId)}</div><div class="cell-sub">${esc(h.deviceType || "")}</div></td>
                  <td>${esc(h.label)}</td>
                  <td class="cell-sub">${esc(h.to ? ("→ " + h.to) : (h.from ? ("từ " + h.from) : (h.note || "—")))}</td>
                </tr>`).join("")}
            </table>
          </div>
        </div>` : ""}
      </div>

      <div>
        <div class="panel">
          <div class="panel-head">
            <h3><i class="ph ph-laptop"></i> Thiết bị đang sử dụng (${currentDevices.length})</h3>
          </div>
          ${currentDevices.length === 0 ? emptyState("Chưa giữ thiết bị nào", "Nhân viên này hiện không được giao thiết bị nào.") : `
          <div class="table-responsive">
            <table class="data">
              <tr><th>Mã TB</th><th>Loại / Thương hiệu</th><th>Tình trạng</th><th>Trạng thái</th><th></th></tr>
              ${currentDevices.map(d => `
                <tr class="rowclick" onclick="app.setView('device','${d.id}')">
                  <td><b style="color:#fff; font-family: var(--font-mono);">${esc(d.id)}</b></td>
                  <td><div class="cell-title">${esc(d.type)}</div><div class="cell-sub">${esc(d.brand)}</div></td>
                  <td>${esc(d.condition)}</td>
                  <td><span class="pill ${STATUS_META[d.status]?.pill || 'pill-slate'}">${esc(d.status)}</span></td>
                  <td onclick="event.stopPropagation();">
                    <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabel('${d.id}')" title="In tem (khổ A4)">
                      <i class="ph ph-qr-code"></i>
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabelMini('${d.id}')" title="In tem nhỏ 20×20mm">
                      <i class="ph ph-tag-simple"></i>
                    </button>
                  </td>
                </tr>
              `).join("")}
            </table>
          </div>`}
        </div>
      </div>
    </div>
  `;
}

// ---------- Operations (Nghiệp vụ) ----------
export function renderOps() {
  const inKho = state.devices.filter(d => d.status === "Trong kho").length;
  const inUse = state.devices.filter(d => d.status === "Đang sử dụng").length;

  return `
    <div class="toolbar" style="justify-content:flex-end;">
      <button class="btn btn-ghost" onclick="app.setView('reports')">
        <i class="ph ph-file-xls"></i> Báo cáo & Kiểm kê
      </button>
    </div>
    <div class="tiles">
      <button class="tile" onclick="app.openOpsForm('handover')">
        <div class="ico"><i class="ph ph-arrow-circle-right"></i></div>
        <h4>Bàn giao thiết bị</h4>
        <p>Giao thiết bị trong kho (${inKho}) cho nhân viên sử dụng, in biên bản bàn giao.</p>
      </button>
      <button class="tile" onclick="app.openOpsForm('return')">
        <div class="ico"><i class="ph ph-arrow-circle-left"></i></div>
        <h4>Thu hồi thiết bị</h4>
        <p>Thu hồi thiết bị đang sử dụng (${inUse}) về kho.</p>
      </button>
      <button class="tile" onclick="app.openOpsForm('transfer')">
        <div class="ico"><i class="ph ph-arrows-left-right"></i></div>
        <h4>Điều chuyển thiết bị</h4>
        <p>Chuyển thiết bị từ nhân viên này sang nhân viên khác.</p>
      </button>
      <button class="tile" onclick="app.openOpsForm('retire')">
        <div class="ico"><i class="ph ph-trash"></i></div>
        <h4>Thanh lý thiết bị</h4>
        <p>Đánh dấu thiết bị đã thanh lý, ngừng sử dụng.</p>
      </button>
    </div>

    <div class="panel" style="margin-top:24px;">
      <div class="panel-head"><h3><i class="ph ph-clock-counter-clockwise"></i> Lịch sử nghiệp vụ gần đây</h3></div>
      ${renderHistoryTable(20)}
    </div>
  `;
}

export function renderHistoryTable(limit) {
  const recent = [];
  state.devices.forEach(d => (d.history || []).forEach(h => recent.push({ ...h, deviceId: d.id, deviceType: d.type })));
  recent.sort((a, b) => new Date(b.date) - new Date(a.date));
  const rows = limit ? recent.slice(0, limit) : recent;

  if (rows.length === 0) return emptyState("Chưa có hoạt động nào", "Các sự kiện bàn giao, thu hồi sẽ hiển thị ở đây.");

  return `
    <div class="table-responsive">
      <table class="data">
        <tr><th>Ngày</th><th>Thiết bị</th><th>Sự kiện</th><th>Chi tiết</th><th>Người thực hiện</th></tr>
        ${rows.map(h => `
          <tr class="rowclick" onclick="app.setView('device','${h.deviceId}')">
            <td style="font-family: var(--font-mono); font-size: 12px;">${fmtDateTime(h.date)}</td>
            <td><div class="cell-title">${esc(h.deviceId)}</div><div class="cell-sub">${esc(h.deviceType || "")}</div></td>
            <td>${esc(h.label)}</td>
            <td class="cell-sub">${esc(h.to ? ("→ " + h.to) : (h.from ? ("từ " + h.from) : (h.note || "—")))}</td>
            <td class="cell-sub">${esc(h.by || "—")}</td>
          </tr>`).join("")}
      </table>
    </div>
  `;
}

// ---------- Reports & Exports (Báo cáo & Kiểm kê) ----------
export function renderReports() {
  const total = state.devices.length;
  const totalEmp = state.employees.length;

  return `
    <div class="panel">
      <div class="panel-head">
        <h3><i class="ph ph-upload-simple"></i> Nhập danh sách thiết bị từ Excel</h3>
      </div>
      <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
        Thêm nhiều thiết bị cùng lúc thay vì nhập tay từng cái. Các bước:
        <b>1)</b> Tải file mẫu, <b>2)</b> điền thông tin thiết bị vào sheet "Nhập thiết bị" (xem sheet "Danh mục tham chiếu" để lấy đúng mã nhân viên / giá trị hợp lệ),
        <b>3)</b> chọn lại file đó để hệ thống kiểm tra và nhập vào.
      </p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn btn-ghost" onclick="app.downloadDeviceImportTemplate()">
          <i class="ph ph-file-arrow-down"></i> 1. Tải file mẫu (Excel)
        </button>
        <button class="btn btn-brand" onclick="app.triggerImportFilePicker()">
          <i class="ph ph-file-arrow-up"></i> 2. Chọn file đã điền để nhập
        </button>
      </div>
    </div>

    <div class="panel" style="margin-top:24px;">
      <div class="panel-head">
        <h3><i class="ph ph-arrows-clockwise"></i> Đồng bộ thiết bị từ GLPI</h3>
      </div>
      <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
        Dùng cho GLPI triển khai nội bộ: trong GLPI vào <b>Assets → Computers / Monitors / Peripherals / Printers...</b>,
        chọn các thiết bị cần lấy rồi <b>Export → Export to file (xlsx)</b> (nên chọn thêm cột Manufacturer, Model,
        Serial number, Operating System - Name, Components - Processor, Alternate username nếu có). Sau đó tải file .xlsx
        đó lên đây — hệ thống sẽ tự nhận diện loại thiết bị (Desktop/Laptop/Màn hình/Bàn phím/Chuột...), tự dò người
        đang giữ theo email, và cho xem trước để bạn chỉnh lại người giữ trước khi ghi vào hệ thống. Chạy lại nhiều lần
        với file mới sẽ tự <b>cập nhật</b> thiết bị đã có (theo Serial number) thay vì tạo trùng.
      </p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn btn-brand" onclick="app.triggerGlpiImportFilePicker()">
          <i class="ph ph-file-arrow-up"></i> Chọn file export từ GLPI
        </button>
      </div>
    </div>

    <div class="panel" style="margin-top:24px;">
      <div class="panel-head">
        <h3><i class="ph ph-file-xls"></i> Xuất báo cáo tổng hợp</h3>
      </div>
      <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
        Xuất toàn bộ dữ liệu (thiết bị, nhân viên, lịch sử nghiệp vụ, phiếu kiểm kê) ra một file Excel duy nhất, nhiều sheet, dùng để báo cáo định kỳ.
      </p>
      <button class="btn btn-brand" onclick="app.exportFullReport()">
        <i class="ph ph-download-simple"></i> Xuất báo cáo tổng hợp (Excel — nhiều sheet)
      </button>
    </div>

    <div class="tiles" style="margin-top:24px;">
      <button class="tile" onclick="app.exportDevicesExcel()">
        <div class="ico"><i class="ph ph-laptop"></i></div>
        <h4>Danh sách thiết bị</h4>
        <p>Xuất toàn bộ ${total} thiết bị: loại, tình trạng, người giữ, giá trị, bảo hành… ra Excel.</p>
      </button>
      <button class="tile" onclick="app.exportEmployeesExcel()">
        <div class="ico"><i class="ph ph-users"></i></div>
        <h4>Danh sách nhân viên</h4>
        <p>Xuất ${totalEmp} nhân viên kèm số lượng thiết bị đang được giao ra Excel.</p>
      </button>
      <button class="tile" onclick="app.exportHistoryExcel()">
        <div class="ico"><i class="ph ph-clock-counter-clockwise"></i></div>
        <h4>Lịch sử nghiệp vụ</h4>
        <p>Toàn bộ lịch sử bàn giao, thu hồi, điều chuyển, thanh lý ra Excel.</p>
      </button>
      <button class="tile" onclick="app.exportInventoryChecklist()">
        <div class="ico"><i class="ph ph-clipboard-text"></i></div>
        <h4>Phiếu kiểm kê thiết bị</h4>
        <p>Danh sách thiết bị kèm cột trống để kiểm kê thực tế và ký xác nhận, in ra dùng khi kiểm kê định kỳ.</p>
      </button>
    </div>

    <div class="panel" style="margin-top:24px;">
      <div class="panel-head"><h3><i class="ph ph-printer"></i> In biên bản bàn giao / thu hồi / điều chuyển</h3></div>
      <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
        Biên bản được tự động mở để in hoặc xuất PDF ngay sau khi thực hiện nghiệp vụ tại mục
        <b>Nghiệp vụ</b>. Bạn cũng có thể in lại biên bản của một sự kiện cũ từ trang chi tiết thiết bị (mục Lịch sử thiết bị).
      </p>
      <button class="btn btn-ghost" onclick="app.setView('ops')"><i class="ph ph-arrow-right"></i> Đến trang Nghiệp vụ</button>
    </div>
  `;
}

// ---------- Settings ----------
export function renderSettings() {
  const s = state.settings;
  return `
    <div class="detail-grid">
      <div class="panel">
        <div class="panel-head"><h3><i class="ph ph-buildings"></i> Thông tin công ty (dùng trong biên bản)</h3></div>
        <div class="field">
          <label>Tên công ty</label>
          <input type="text" id="setCompanyName" value="${esc(s.companyName || "")}">
        </div>
        <div class="field">
          <label>Địa chỉ</label>
          <input type="text" id="setCompanyAddress" value="${esc(s.companyAddress || "")}">
        </div>
        <div class="field">
          <label>Phòng ban lập biên bản</label>
          <input type="text" id="setCompanyDept" value="${esc(s.companyDept || "")}">
        </div>
        <button class="btn btn-brand" onclick="app.saveSettings()"><i class="ph ph-floppy-disk"></i> Lưu cấu hình</button>
      </div>

      <div class="panel">
        <div class="panel-head"><h3><i class="ph ph-sliders"></i> Tham số hệ thống</h3></div>
        <div class="field">
          <label>Vòng đời sử dụng mặc định (năm)</label>
          <input type="number" id="setUsefulLife" value="${s.usefulLifeYears}" min="1" step="0.5">
        </div>
        <div class="field">
          <label>Bảo hành mặc định (tháng)</label>
          <input type="number" id="setWarrantyMonths" value="${s.warrantyMonths}" min="0">
        </div>
        <div class="field">
          <label>Cảnh báo khấu hao khi giá trị còn lại ≤ (%)</label>
          <input type="number" id="setDepWarn" value="${s.depreciationWarnPercent}" min="0" max="100">
        </div>
        <div class="field">
          <label>Cảnh báo bảo hành trước khi hết hạn (ngày)</label>
          <input type="number" id="setWarWarnDays" value="${s.warrantyWarnDays}" min="0">
        </div>
        <div class="field">
          <label>Cảnh báo khi chi phí sửa chữa ≥ (% giá mua)</label>
          <input type="number" id="setRepairWarn" value="${s.repairCostWarnPercent}" min="0" max="200">
        </div>
        <button class="btn btn-brand" onclick="app.saveSettings()"><i class="ph ph-floppy-disk"></i> Lưu cấu hình</button>
      </div>

      <div class="panel">
        <div class="panel-head"><h3><i class="ph ph-arrows-clockwise"></i> Bảo trì dữ liệu</h3></div>
        <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:16px;">
          Nếu bạn đã đổi tên hoặc bộ phận của một nhân viên <b>trước khi</b> có tính năng tự đồng bộ,
          các thiết bị họ đang giữ có thể vẫn hiển thị tên/bộ phận cũ. Bấm nút dưới đây để quét và
          cập nhật lại toàn bộ thiết bị theo đúng hồ sơ nhân viên hiện tại (dựa theo liên kết Mã NV).
        </p>
        <button class="btn btn-ghost" onclick="app.resyncHolderNames()"><i class="ph ph-arrows-clockwise"></i> Đồng bộ lại tên người dùng trên thiết bị</button>
      </div>

      <div class="panel">
        <div class="panel-head"><h3><i class="ph ph-users-three"></i> Quản lý tài khoản</h3></div>
        <div id="accountsBox">${emptyState("Đang tải...", "")}</div>
      </div>
    </div>
  `;
}

export function renderAccountsTable(accResult, currentUserEmail, employees) {
  if (!accResult.supported) {
    return emptyState("Không khả dụng", "Quản lý tài khoản chỉ hoạt động khi kết nối Firebase (chế độ online).");
  }
  if (accResult.accounts.length === 0) {
    return emptyState("Chưa có tài khoản nào", accResult.error ? ("Lỗi: " + accResult.error) : "");
  }
  const empList = employees || [];
  return `
    <div class="table-responsive">
      <table class="data">
        <tr><th>Email</th><th>Vai trò</th><th>Nhân viên liên kết</th><th>MFA</th><th>Trạng thái</th><th></th></tr>
        ${accResult.accounts.map(a => `
          <tr>
            <td class="cell-title">${esc(a.email)}${a.email === currentUserEmail ? ' <span class="pill pill-brand">Bạn</span>' : ''}</td>
            <td>
              <select onchange="app.changeAccountRole('${a.uid}', this.value)" ${a.email === currentUserEmail ? 'disabled' : ''}>
                <option value="user" ${a.role !== 'admin' ? 'selected' : ''}>Nhân viên</option>
                <option value="admin" ${a.role === 'admin' ? 'selected' : ''}>Quản trị viên</option>
              </select>
            </td>
            <td>
              <select onchange="app.changeAccountEmployee('${a.uid}', this.value)">
                <option value="">— Chưa liên kết —</option>
                ${empList.map(e => `<option value="${esc(e.id)}" ${a.employeeId === e.id ? 'selected' : ''}>${esc(e.id)} — ${esc(e.name)}</option>`).join("")}
              </select>
            </td>
            <td><span class="pill ${a.mfaEnabled ? 'pill-success' : 'pill-slate'}">${a.mfaEnabled ? 'Đã bật' : 'Chưa bật'}</span></td>
            <td><span class="pill ${a.active !== false ? 'pill-success' : 'pill-danger'}">${a.active !== false ? 'Hoạt động' : 'Đã khoá'}</span></td>
            <td>
              <button class="btn btn-sm btn-ghost" onclick="app.toggleAccountActive('${a.uid}', ${a.active !== false})" ${a.email === currentUserEmail ? 'disabled' : ''}>
                <i class="ph ${a.active !== false ? 'ph-lock' : 'ph-lock-open'}"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
}
