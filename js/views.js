import { state, STATUS_META, DEPARTMENTS } from './db.js';
import { fmtVND, fmtDateTime, computeAlerts, computeDepreciation, esc } from './helpers.js';
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
