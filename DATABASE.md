# HabitApp 2.0 — modelo de datos (MySQL)

Script completo: `database/habitapp.sql` (importar en phpMyAdmin).

| Tabla | Contenido |
|---|---|
| `users` | Usuarios, rol (`user`/`admin`), contraseña bcrypt, XP y nivel |
| `categories` | Categorías por usuario (Personal, Salud, Estudio, Trabajo, Fitness) |
| `activities` | Entidad central: tareas y hábitos (`type`), prioridad, fechas, XP, rachas |
| `streak_history` | Un registro por cumplimiento diario (único por actividad y día) |

Relaciones: users 1–N categories, users 1–N activities, categories 1–N activities, activities 1–N streak_history.
Ver diagrama en `docs/diagramas/er.png` y detalle en el Manual Técnico.
