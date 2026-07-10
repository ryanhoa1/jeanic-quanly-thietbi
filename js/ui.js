export function toast(msg, type = "success") {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  
  let icon = "ph-info";
  if (type === "err") icon = "ph-warning-circle";
  if (type === "success") icon = "ph-check-circle";
  
  el.innerHTML = `<i class="ph ${icon}"></i> <span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function openModal(title, bodyHtml, footHtml, maxWidth) {
  const modalBox = document.getElementById("modalBox");
  modalBox.style.maxWidth = maxWidth || ""; // "" restores the default 650px from CSS
  modalBox.innerHTML = `
    <div class="modal-head">
      <h3>${title}</h3>
      <button class="x-close" id="modalCloseBtn"><i class="ph ph-x"></i></button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-foot">${footHtml}</div>
  `;
  document.getElementById("modal-root").classList.add("open");
  
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
}

export function closeModal() {
  document.getElementById("modal-root").classList.remove("open");
}

export function emptyState(title, sub) {
  return `
    <div class="empty">
      <i class="ph ph-folder-open"></i>
      <b>${title}</b>
      <p>${sub}</p>
    </div>
  `;
}
