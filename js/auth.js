import { apiGet, apiPost } from "./api.js";

const $ = (id) => document.getElementById(id);
const loginCard = $("login-card"), registerCard = $("register-card");
const loginError = $("error-box"), registerError = $("register-error");
const panel = document.querySelector(".auth-panel");
let mode = "user"; // "user" | "admin"

function clearErrors() { [loginError, registerError].forEach(e => { if (e) { e.style.display = "none"; e.classList.remove("success"); } }); }
function showError(el, msg) { el.textContent = msg; el.classList.remove("success"); el.style.display = "block"; }
function toggle(showRegister) {
  loginCard.classList.toggle("hidden", showRegister);
  registerCard.classList.toggle("hidden", !showRegister);
  clearErrors();
}
function setBusy(form, busy) {
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = busy; btn.classList.toggle("loading", busy);
  if (busy) btn.dataset.original = btn.innerHTML;
  btn.innerHTML = busy ? "<span>Procesando...</span><span>…</span>" : (btn.dataset.original || btn.innerHTML);
}

// Selector Usuario / Administrador
function setMode(newMode) {
  mode = newMode;
  const admin = mode === "admin";
  panel.classList.toggle("admin-mode", admin);
  document.querySelectorAll(".role-btn").forEach(b => {
    const on = b.dataset.role === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
  });
  $("login-eyebrow").textContent = admin ? "ACCESO ADMINISTRADOR" : "BIENVENIDO DE VUELTA";
  $("login-title").textContent   = admin ? "Panel de administración" : "Entra a tu progreso";
  $("login-sub").textContent     = admin ? "Solo personal autorizado." : "Continúa donde lo dejaste.";
  $("login-btn-label").textContent = admin ? "Entrar como administrador" : "Entrar";
  $("register-copy").classList.toggle("hidden", admin); // los administradores no se registran solos
  clearErrors();
}
document.querySelectorAll(".role-btn").forEach(b => b.addEventListener("click", () => setMode(b.dataset.role)));

// Si ya hay sesión activa, ir directo a la pantalla que corresponde
apiGet("auth", "me").then(r => {
  location.href = r.user.role === "admin" ? "admin.html" : "dashboard.html";
}).catch(() => { /* sin sesión: se queda en el login */ });

$("toggle-link")?.addEventListener("click", e => { e.preventDefault(); toggle(true); });
$("back-login")?.addEventListener("click", e => { e.preventDefault(); toggle(false); });

document.querySelectorAll(".password-toggle").forEach(btn => btn.addEventListener("click", () => {
  const input = $(btn.dataset.target);
  input.type = input.type === "password" ? "text" : "password";
  btn.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
}));

$("form-login")?.addEventListener("submit", async e => {
  e.preventDefault(); clearErrors();
  const form = e.currentTarget;
  setBusy(form, true);
  try {
    const r = await apiPost("auth", "login", {
      email: $("login-email").value.trim(),
      password: $("login-password").value,
      role: mode
    });
    location.href = r.redirect;
  } catch (err) {
    showError(loginError, err.message);
    setBusy(form, false);
  }
});

$("form-register")?.addEventListener("submit", async e => {
  e.preventDefault(); clearErrors();
  const form = e.currentTarget;
  const name = $("reg-name").value.trim();
  if (name.length < 2) { showError(registerError, "Escribe un nombre válido."); return; }
  setBusy(form, true);
  try {
    const r = await apiPost("auth", "register", {
      name, email: $("reg-email").value.trim(), password: $("reg-password").value
    });
    location.href = r.redirect;
  } catch (err) {
    showError(registerError, err.message);
    setBusy(form, false);
  }
});

// Sin servidor de correo local: la recuperación la hace un administrador
$("forgot-link")?.addEventListener("click", e => {
  e.preventDefault();
  showError(loginError, "Pídele a un administrador que restablezca tu contraseña desde su panel.");
  loginError.classList.add("success");
});
