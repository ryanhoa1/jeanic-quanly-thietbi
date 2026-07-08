import { state, STATUS_META, DEPARTMENTS, CONDITIONS, DEVICE_TYPES, BRANDS } from './db.js';
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

export function renderDevices(filter) {
  const q = filter.q.toLowerCase();
  const list = state.devices.filter(d => {
    if (filter.status !== "all" && d.status !== filter.status) return false;
    if (filter.dept !== "all" && d.dept !== filter.dept) return false;
    if (q && !(`${d.id} ${d.type} ${d.brand} ${d.holderName || ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
  
  const alertIds = new Set(computeAlerts().map(a => a.device.id));

  let html = `
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
              <td>${esc(d.condition)}</td>
              <td><span class="pill ${STATUS_META[d.status]?.pill || 'pill-slate'}">${esc(d.status)}</span></td>
              <td>${esc(d.holderName || "—")}</td>
              <td>${esc(d.dept || "—")}</td>
              <td>${alertIds.has(d.id) ? '<span class="pill pill-danger"><i class="ph ph-warning"></i> Chú ý</span>' : ""}</td>
              <td onclick="event.stopPropagation();">
                <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabel('${d.id}')" title="In tem">
                  <i class="ph ph-qr-code"></i>
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
              <button class="btn btn-sm btn-ghost" onclick="app.printAssetLabel('${d.id}')"><i class="ph ph-qr-code"></i> In tem</button>
            </div>
          </div>
          <div class="kv"><b>Mã thiết bị</b><span style="font-family:var(--font-mono);">${esc(d.id)}</span></div>
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
        </div>

        <div class="panel">
          <div class="panel-head"><h3><i class="ph ph-clock-counter-clockwise"></i> Lịch sử thiết bị</h3></div>
          ${history.length === 0 ? emptyState("Chưa có lịch sử", "") : `
          <div class="timeline">
            ${history.map(h => `
              <div class="tl-item">
                <div class="tl-date">${fmtDateTime(h.date)}</div>
                <div class="tl-label">${esc(h.label)}</div>
                <div class="tl-detail">
                  ${h.from ? `Từ: ${esc(h.from)}<br>` : ""}
                  ${h.to ? `Đến: ${esc(h.to)}${h.dept ? " — " + esc(h.dept) : ""}<br>` : ""}
                  ${h.condition ? `Tình trạng: ${esc(h.condition)}<br>` : ""}
                  ${h.note ? esc(h.note) + "<br>" : ""}
                  <span style="color:var(--text-muted);">Bởi: ${esc(h.by || "—")}</span>
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
export function renderEmployees(filter) {
  const q = (filter.q || "").toLowerCase();
  const list = state.employees.filter(e => {
    if (filter.dept && filter.dept !== "all" && e.dept !== filter.dept) return false;
    if (q && !(`${e.id} ${e.name} ${e.email || ""} ${e.position || ""}`.toLowerCase().includes(q))) return false;
    return true;
  });

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
            <tr>
              <td><b style="color:#fff; font-family: var(--font-mono);">${esc(e.id)}</b></td>
              <td class="cell-title">${esc(e.name)}</td>
              <td>${esc(e.dept || "—")}</td>
              <td>${esc(e.position || "—")}</td>
              <td class="cell-sub">${esc(e.email || "—")}<br>${esc(e.phone || "")}</td>
              <td><span class="pill ${e.status === 'Đang làm việc' ? 'pill-success' : 'pill-slate'}">${esc(e.status || "—")}</span></td>
              <td>${deviceCountOf(e.id)}</td>
              <td><button class="btn btn-sm btn-ghost" onclick="app.openEmployeeForm('${e.id}')"><i class="ph ph-pencil-simple"></i></button></td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }
  html += `</div>`;
  return html;
}

// ---------- Operations (Nghiệp vụ) ----------
export function renderOps() {
  const inKho = state.devices.filter(d => d.status === "Trong kho").length;
  const inUse = state.devices.filter(d => d.status === "Đang sử dụng").length;

  return `
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

// ---------- Settings ----------
export function renderSettings() {
  const s = state.settings;
  return `
    <div class="detail-grid">
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
        <div class="panel-head"><h3><i class="ph ph-users-three"></i> Quản lý tài khoản</h3></div>
        <div id="accountsBox">${emptyState("Đang tải...", "")}</div>
      </div>
    </div>
  `;
}

export function renderAccountsTable(accResult, currentUserEmail) {
  if (!accResult.supported) {
    return emptyState("Không khả dụng", "Quản lý tài khoản chỉ hoạt động khi kết nối Firebase (chế độ online).");
  }
  if (accResult.accounts.length === 0) {
    return emptyState("Chưa có tài khoản nào", accResult.error ? ("Lỗi: " + accResult.error) : "");
  }
  return `
    <div class="table-responsive">
      <table class="data">
        <tr><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr>
        ${accResult.accounts.map(a => `
          <tr>
            <td class="cell-title">${esc(a.email)}${a.email === currentUserEmail ? ' <span class="pill pill-brand">Bạn</span>' : ''}</td>
            <td>
              <select onchange="app.changeAccountRole('${a.uid}', this.value)" ${a.email === currentUserEmail ? 'disabled' : ''}>
                <option value="user" ${a.role !== 'admin' ? 'selected' : ''}>Nhân viên</option>
                <option value="admin" ${a.role === 'admin' ? 'selected' : ''}>Quản trị viên</option>
              </select>
            </td>
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
