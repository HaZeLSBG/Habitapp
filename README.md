# HabitApp 2.0

Aplicación web para seguimiento de hábitos y tareas con XP, niveles y rachas.
Backend en **PHP + MySQL** (Laragon / phpMyAdmin). Login con selector **Usuario / Administrador**.

## Instalación rápida (Laragon)
1. Copia la carpeta `habitapp` en `C:\laragon\www\`.
2. Laragon → **Iniciar todo**.
3. phpMyAdmin → pestaña **Importar** → `database/habitapp.sql`.
4. Abre `http://localhost/habitapp`.

Si tu MySQL tiene contraseña, edita `api/config.php`.

## Cuentas de prueba
| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@habitapp.com | Admin123* |
| Usuario | demo@habitapp.com | Demo123* |

## Documentación
- `docs/Manual_de_Usuario_HabitApp.docx` (pantallas y mapa de navegación)
- `docs/Manual_Tecnico_HabitApp.docx`
- `DATABASE.md` modelo de datos

## Estructura
`index.html`, `dashboard.html`, `admin.html` · `js/` · `css/` · `api/` (PHP) · `database/habitapp.sql` · `docs/`
