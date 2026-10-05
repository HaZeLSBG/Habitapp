import { apiGet, apiPost } from "./api.js";
import { playComplete, playLevelUp, playClick } from "./sounds.js";

const $ = id => document.getElementById(id);
let dateKey = null;              // "hoy" lo define el servidor (zona horaria America/Bogota)
let userData = {}, activities = [], categories = [];
let currentFilter = "all", categoryFilter = "all";

function prettyDate(key) {
  if (!key) return "Sin fecha";
  const d = new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(/^./, c => c.toUpperCase());
}

const motivations = [
  "Convierte tus intenciones en acciones pequeñas y medibles.",
  "No necesitas hacerlo perfecto. Necesitas hacerlo hoy.",
  "La constancia se construye con acciones repetidas.",
  "Haz primero la siguiente acción pequeña."
];

function updateProfile(u) {
  userData = u || {};
  const per = u.xpPerLevel || 100, xp = u.totalXp || 0, level = u.level, into = xp % per;
  $("name-display").textContent = u.displayName || "Usuario";
  $("hero-name").textContent = (u.displayName || "tú").split(" ")[0];
  $("level-number").textContent = level;
  $("level-mini").textContent = `Nivel ${level}`;
  $("total-xp").textContent = `${xp} XP`;
  $("xp-label").textContent = `${into} / ${per} XP`;
  $("xp-percent").textContent = `${Math.round(into / per * 100)}%`;
  $("xp-bar-fill").style.width = `${into / per * 100}%`;
  $("motivation").textContent = motivations[(level - 1) % motivations.length];
  if (u.photoURL) $("avatar-display").src = u.photoURL;
  if (u.role === "admin") $("btn-admin")?.classList.remove("hidden");
}

function renderCategoryControls() {
  const select = $("activity-category"), filter = $("category-filter");
  const opts = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  select.innerHTML = opts;
  filter.innerHTML = `<option value="all">Todas las categorías</option>` + opts;
  filter.value = categoryFilter;
}

async function loadCategories() {
  const r = await apiGet("categories", "list");
  categories = r.categories;
  renderCategoryControls();
}

async function loadActivities() {
  const r = await apiGet("activities", "list");
  dateKey = r.today;
  activities = r.activities;
  updateProfile(r.user);
  renderActivities();
}

function getFiltered() {
  return activities.filter(a => {
    const typeOk = currentFilter === "all" || a.type === currentFilter;
    const catOk = categoryFilter === "all" || String(a.categoryId) === categoryFilter;
    return typeOk && catOk;
  });
}

function renderActivities() {
  const list = $("activities-list"), filtered = getFiltered();
  list.innerHTML = "";
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div>✦</div><h3>No hay elementos aquí.</h3><p>Crea una tarea o hábito para empezar.</p></div>`;
  } else {
    filtered.forEach(a => list.appendChild(activityCard(a)));
  }
  updateStats();
  $("list-title").textContent = currentFilter === "task" ? "Tareas" : currentFilter === "habit" ? "Hábitos" : "Para hoy";
}

function priorityName(p) { return ({ low: "Baja", medium: "Media", high: "Alta" }[p] || "Media"); }

function activityCard(a) {
  const el = document.createElement("article");
  el.className = `habit-card activity-card ${a.type === "task" ? "task-card" : "habit-type-card"}`;
  const doneToday = a.doneToday;
  const due = a.dueDate || a.startDate;
  const overdue = a.type === "task" && !doneToday && due && due < dateKey;
  const icon = a.type === "task" ? "✓" : "✦";
  const priorityClass = `priority-${a.priority || "medium"}`;
  el.innerHTML = `
    <div class="habit-main">
      <div class="habit-icon">${icon}</div>
      <div class="habit-info">
        <div class="habit-title-row"><h3>${escapeHtml(a.name)}</h3>
          <span class="type-chip">${a.type === "task" ? "TAREA" : "HÁBITO"}</span>
        </div>
        ${a.description ? `<p class="activity-description">${escapeHtml(a.description)}</p>` : ""}
        <div class="habit-meta"><span>${escapeHtml(a.categoryName || "Sin categoría")}</span><i>•</i>
          <span class="${priorityClass}">${priorityName(a.priority)}</span><i>•</i>
          <span>${prettyDate(due)}</span>${overdue ? `<i>•</i><span class="overdue">Vencida</span>` : ""}</div>
        <div class="habit-streak">
          ${a.type === "habit"
            ? `<span>🔥 ${a.currentStreak} días</span><span>Mejor ${a.bestStreak}</span>`
            : `<span>${doneToday ? "✓ Completada" : "○ Pendiente"}</span><span>+${a.xpReward} XP</span>`}
        </div>
      </div>
    </div>
    <div class="activity-actions">
      <button class="complete-btn ${doneToday ? "done" : ""}" ${doneToday ? "disabled" : ""}
        title="${doneToday ? "Completado" : "Marcar como completado"}">${doneToday ? "✓" : "○"}</button>
      <button class="delete-activity" title="Eliminar">×</button>
    </div>`;
  el.querySelector(".complete-btn").addEventListener("click", () => completeActivity(a));
  el.querySelector(".delete-activity").addEventListener("click", () => removeActivity(a));
  return el;
}

async function completeActivity(a) {
  try {
    const r = await apiPost("activities", "complete", { id: a.id });
    playComplete(); playClick();
    showToast(`+${r.xpEarned} XP · ${a.name}`);
    if (r.leveledUp) { playLevelUp(); setTimeout(() => showToast(`Subiste a nivel ${r.level}`), 1500); }
    await loadActivities();
  } catch (err) {
    console.error(err); showToast(err.message || "No se pudo completar el elemento");
  }
}

async function removeActivity(a) {
  if (!confirm(`¿Eliminar "${a.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await apiPost("activities", "delete", { id: a.id });
    showToast("Elemento eliminado");
    await loadActivities();
  } catch (err) { console.error(err); showToast("No se pudo eliminar"); }
}

function updateStats() {
  const todayItems = activities.filter(a => {
    if (a.type === "habit") return true;
    return a.dueDate === dateKey || a.startDate === dateKey || (!a.completed && a.dueDate && a.dueDate < dateKey);
  });
  const done = todayItems.filter(a => a.doneToday).length;
  const streak = activities.reduce((m, a) => Math.max(m, a.type === "habit" ? a.currentStreak : 0), 0);
  $("today-progress").textContent = `${done} / ${todayItems.length}`;
  $("total-streak").textContent = `${streak} días`;
}

$("form-add-activity")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const type = $("activity-type").value;
  const name = $("activity-name").value.trim();
  if (!name) return;
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await apiPost("activities", "create", {
      type, name,
      description: $("activity-description").value.trim(),
      categoryId: $("activity-category").value,
      priority: $("activity-priority").value,
      startDate: $("activity-date").value || dateKey,
      xpReward: Number($("activity-xp").value || 10)
    });
    form.reset();
    $("activity-type").value = "habit";
    document.querySelectorAll(".type-btn").forEach(b => b.classList.toggle("active", b.dataset.type === "habit"));
    $("activity-date").previousElementSibling.textContent = "Fecha de inicio";
    $("activity-date").value = dateKey;
    $("activity-xp").value = "10";
    playClick(); showToast(type === "task" ? "Tarea creada" : "Hábito creado");
    await loadActivities();
  } catch (err) { console.error(err); showToast(err.message || "No se pudo crear"); }
  finally { btn.disabled = false; }
});

document.querySelectorAll(".type-btn").forEach(btn => btn.addEventListener("click", () => {
  const type = btn.dataset.type;
  $("activity-type").value = type;
  document.querySelectorAll(".type-btn").forEach(b => b.classList.toggle("active", b === btn));
  $("activity-date").previousElementSibling.textContent = type === "task" ? "Fecha límite" : "Fecha de inicio";
}));

document.querySelectorAll(".filter-btn").forEach(btn => btn.addEventListener("click", () => {
  currentFilter = btn.dataset.filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b === btn));
  renderActivities();
}));
$("category-filter")?.addEventListener("change", e => { categoryFilter = e.target.value; renderActivities(); });
$("btn-logout")?.addEventListener("click", async () => {
  try { await apiPost("auth", "logout"); } finally { location.href = "index.html"; }
});

function showToast(msg) {
  const t = $("toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show"); clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove("show"), 2600);
}
function escapeHtml(s = "") { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

(async function init() {
  try {
    await loadCategories();
    await loadActivities();
    $("today-label").textContent = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short" })
      .format(new Date(`${dateKey}T12:00:00`)).replace(/^./, c => c.toUpperCase());
    $("activity-date").value = dateKey;
    setTimeout(() => $("loading-screen")?.classList.add("hidden"), 400);
  } catch (err) {
    if (err.status === 401) { location.href = "index.html"; return; }
    $("loading-screen").querySelector("span").textContent = err.message;
  }
})();
