// Cliente de la API PHP (carpeta /api). Reemplaza al antiguo firebase-config.js.
async function request(file, action, { method = "GET", data, params } = {}) {
  const qs = new URLSearchParams({ action, ...(params || {}) }).toString();
  const opts = {
    method,
    credentials: "same-origin",
    headers: { "X-Requested-With": "HabitApp" }
  };
  if (method !== "GET") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(data || {});
  }
  let res;
  try {
    res = await fetch(`api/${file}.php?${qs}`, opts);
  } catch (e) {
    throw Object.assign(new Error("No se pudo conectar con el servidor. ¿Está Laragon iniciado?"), { status: 0 });
  }
  let json = null;
  try { json = await res.json(); } catch (e) { /* respuesta no JSON */ }
  if (!res.ok) {
    throw Object.assign(new Error(json?.error || "Ocurrió un error. Intenta de nuevo."), { status: res.status });
  }
  return json;
}

export const apiGet  = (file, action, params) => request(file, action, { params });
export const apiPost = (file, action, data)   => request(file, action, { method: "POST", data });
