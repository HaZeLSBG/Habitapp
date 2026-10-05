import { apiGet, apiPost } from "./api.js";

const $ = id => document.getElementById(id);
let allUsers = [];

async function init() {
  try {
    await loadAllUsers();
  } catch (err) {
    if (err.status === 401) { location.href = "index.html"; return; }
    if (err.status === 403) {
      showToast("No tienes permisos de administrador");
      setTimeout(() => location.href = "dashboard.html", 1200);
      return;
    }
    showToast(err.message);
  }
}

$("btn-logout")?.addEventListener("click", async () => {
  try { await apiPost("auth", "logout"); } finally { location.href = "index.html"; }
});
$("close-detail")?.addEventListener("click", () => $("user-detail-overlay").classList.add("hidden"));
$("user-detail-overlay")?.addEventListener("click", e => { if (e.target.id === "user-detail-overlay") e.currentTarget.classList.add("hidden"); });

async function loadAllUsers() {
  const r = await apiGet("admin", "users");
  allUsers = r.users;
  $("stat-users").textContent = r.stats.users;
  $("stat-activities").textContent = r.stats.activities;
  $("stat-xp").textContent = r.stats.xp;
  renderUsers(filterUsers());
}

function filterUsers() {
  const term = ($("search-users")?.value || "").toLowerCase().trim();
  return allUsers.filter(u =>
    (u.displayName || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term));
}

function renderUsers(list) {
  const c = $("users-list");
  c.innerHTML = "";
  if (!list.length) {
    c.innerHTML = `<div class="empty-state"><div>👤</div><h3>No hay usuarios todavía.</h3></div>`;
    return;
  }
  list.forEach(u => {
    const row = document.createElement("article");
    row.className = "admin-user-card";
    row.innerHTML = `
      <div class="admin-user-main">
        <img src="${escapeAttr(u.photoURL || 'img/avatar-default.png')}" class="avatar" alt="">
        <div class="admin-user-id">
          <strong>${escapeHtml(u.displayName || "Sin nombre")}${u.role === "admin" ? ' <span class="admin-tag">ADMIN</span>' : ""}</strong>
          <span class="admin-user-email">${escapeHtml(u.email || "")}</span>
        </div>
      </div>
      <div class="admin-user-chips">
        <span class="xp-chip">Nivel ${u.level}</span>
        <span class="xp-chip">${u.totalXp} XP</span>
        <span class="xp-chip">${u.activityCount} elemento${u.activityCount === 1 ? "" : "s"}</span>
      </div>
      <button class="primary-btn admin-view-btn"><span>Ver detalle</span><span>→</span></button>`;
    row.querySelector(".admin-view-btn").addEventListener("click", () => openUserDetail(u.id));
    c.appendChild(row);
  });
}

$("search-users")?.addEventListener("input", () => renderUsers(filterUsers()));

async function openUserDetail(userId) {
  const overlay = $("user-detail-overlay"), content = $("user-detail-content");
  overlay.classList.remove("hidden");
  content.innerHTML = `<div class="admin-detail-loading">Cargando…</div>`;

  let r;
  try { r = await apiGet("admin", "user", { id: userId }); }
  catch (err) { content.innerHTML = `<div class="admin-detail-loading">${escapeHtml(err.message)}</div>`; return; }
  const { user, activities, isSelf } = r;

  content.innerHTML = `
    <div class="admin-detail-head">
      <img src="${escapeAttr(user.photoURL || 'img/avatar-default.png')}" class="avatar admin-detail-avatar" alt="">
      <div>
        <h2>${escapeHtml(user.displayName || "Sin nombre")}</h2>
        <p class="admin-user-email">${escapeHtml(user.email || "")}</p>
      </div>
    </div>

    <div class="admin-detail-stats">
      <div class="admin-mini-stat"><span>Nivel</span><strong>${user.level}</strong></div>
      <div class="admin-mini-stat"><span>XP</span><strong>${user.totalXp}</strong></div>
      <div class="admin-mini-stat"><span>Elementos</span><strong>${activities.length}</strong></div>
    </div>

    <div class="admin-section">
      <span class="eyebrow">EDITAR XP</span>
      <div class="admin-edit-row">
        <input type="number" id="edit-xp" min="0" value="${user.totalXp}">
        <button class="primary-btn admin-inline-btn" id="save-xp"><span>Guardar</span></button>
      </div>
    </div>

    <div class="admin-section">
      <span class="eyebrow">ROL DEL USUARIO${isSelf ? " (es tu cuenta)" : ""}</span>
      <div class="admin-edit-row">
        <select id="edit-role" ${isSelf ? "disabled" : ""}>
          <option value="user" ${user.role !== "admin" ? "selected" : ""}>Usuario</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrador</option>
        </select>
        <button class="primary-btn admin-inline-btn" id="save-role" ${isSelf ? "disabled" : ""}><span>Guardar</span></button>
      </div>
    </div>

    <div class="admin-section">
      <span class="eyebrow">RESTABLECER CONTRASEÑA</span>
      <div class="admin-edit-row">
        <input type="text" id="new-password" placeholder="Nueva contraseña (mín. 6)" autocomplete="off">
        <button class="primary-btn admin-inline-btn" id="save-password"><span>Cambiar</span></button>
      </div>
    </div>

    <div class="admin-section">
      <span class="eyebrow">TAREAS Y HÁBITOS (${activities.length})</span>
      <div id="admin-activities-list"></div>
    </div>

    <div class="admin-danger-zone">
      <span class="eyebrow">ZONA DE RIESGO</span>
      <div class="admin-edit-row">
        <button class="ghost-btn danger-btn" id="delete-user-data">Borrar todas las tareas y hábitos</button>
        ${isSelf ? "" : `<button class="ghost-btn danger-btn" id="delete-user">Eliminar usuario</button>`}
      </div>
    </div>`;

  const list = $("admin-activities-list");
  if (!activities.length) {
    list.innerHTML = `<p class="admin-user-email">Este usuario no tiene tareas ni hábitos todavía.</p>`;
  } else {
    activities.forEach(a => {
      const row = document.createElement("div");
      row.className = "admin-activity-row";
      row.innerHTML = `
        <div class="admin-activity-icon">${a.type === "task" ? "✓" : "🔥"}</div>
        <div class="admin-activity-info">
          <strong>${escapeHtml(a.name)}</strong>
          <span>${a.type === "task" ? "Tarea" : "Hábito"}${a.type === "habit" ? ` · ${a.currentStreak} días de racha` : ""}</span>
        </div>
        <button class="ghost-btn danger-btn admin-delete-one">Borrar</button>`;
      row.querySelector(".admin-delete-one").addEventListener("click", async () => {
        if (!confirm(`¿Borrar "${a.name}"? Esto no se puede deshacer.`)) return;
        await run(() => apiPost("admin", "delete_activity", { id: a.id }), "Elemento borrado");
        openUserDetail(userId); loadAllUsers();
      });
      list.appendChild(row);
    });
  }

  $("save-xp").addEventListener("click", async () => {
    await run(() => apiPost("admin", "set_xp", { id: userId, xp: parseInt($("edit-xp").value, 10) || 0 }), "XP actualizado");
    openUserDetail(userId); loadAllUsers();
  });
  $("save-role").addEventListener("click", async () => {
    await run(() => apiPost("admin", "set_role", { id: userId, role: $("edit-role").value }), "Rol actualizado");
    loadAllUsers();
  });
  $("save-password").addEventListener("click", async () => {
    const ok = await run(() => apiPost("admin", "reset_password", { id: userId, password: $("new-password").value }), "Contraseña actualizada");
    if (ok) $("new-password").value = "";
  });
  $("delete-user-data").addEventListener("click", async () => {
    if (!confirm("¿Borrar TODAS las tareas y hábitos de este usuario? Esto no se puede deshacer.")) return;
    await run(() => apiPost("admin", "delete_user_activities", { id: userId }), "Elementos eliminados");
    openUserDetail(userId); loadAllUsers();
  });
  $("delete-user")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar al usuario ${user.email} y todos sus datos? Esto no se puede deshacer.`)) return;
    const ok = await run(() => apiPost("admin", "delete_user", { id: userId }), "Usuario eliminado");
    if (ok) { overlay.classList.add("hidden"); loadAllUsers(); }
  });
}

/** Ejecuta una acción de la API mostrando un aviso de éxito o de error. */
async function run(fn, okMsg) {
  try { await fn(); showToast(okMsg); return true; }
  catch (err) { showToast(err.message); return false; }
}

let toastTimer = null;
function showToast(msg) {
  const t = $("toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function escapeHtml(str = "") { return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escapeAttr(s = "") { return escapeHtml(s); }

init();
