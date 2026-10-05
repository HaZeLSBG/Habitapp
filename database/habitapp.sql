-- =====================================================================
--  HabitApp 2.0  ·  Base de datos MySQL / MariaDB
--  Compatible con phpMyAdmin de Laragon (MySQL 8 / MariaDB 10.x)
--
--  CÓMO IMPORTAR:
--    1. Abre Laragon -> "Iniciar todo".
--    2. Abre phpMyAdmin (Menú -> MySQL -> phpMyAdmin, o http://localhost/phpmyadmin).
--    3. Pestaña "Importar" -> elige este archivo -> "Importar".
--    (El script crea la base 'habitapp' por sí solo. Se puede volver a importar:
--     borra y recrea las tablas.)
--
--  USUARIOS DE PRUEBA (contraseñas guardadas con bcrypt):
--    Administrador:  admin@habitapp.com   /  Admin123*
--    Usuario demo:   demo@habitapp.com    /  Demo123*
-- =====================================================================

CREATE DATABASE IF NOT EXISTS habitapp
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE habitapp;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS streak_history;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
--  Paso 1 · Tablas simples
-- ---------------------------------------------------------------------

-- Usuarios (rol 'user' o 'admin')
CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  display_name   VARCHAR(80)  NOT NULL,
  email          VARCHAR(120) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  photo_url      VARCHAR(255) NULL,
  timezone       VARCHAR(60)  NOT NULL DEFAULT 'America/Bogota',
  total_xp       INT UNSIGNED NOT NULL DEFAULT 0,
  level          INT UNSIGNED NOT NULL DEFAULT 1,
  role           ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categorías (cada usuario tiene las suyas)
CREATE TABLE categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(40)  NOT NULL,
  icon        VARCHAR(8)   NOT NULL DEFAULT '✦',
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_user_name (user_id, name),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  Paso 2 · Entidad central: tareas y hábitos (columna 'type')
-- ---------------------------------------------------------------------
CREATE TABLE activities (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id              INT UNSIGNED NOT NULL,
  category_id          INT UNSIGNED NULL,
  type                 ENUM('task','habit') NOT NULL DEFAULT 'habit',
  name                 VARCHAR(80)  NOT NULL,
  description          VARCHAR(180) NOT NULL DEFAULT '',
  priority             ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  start_date           DATE NOT NULL,
  due_date             DATE NULL,
  xp_reward            SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  completed            TINYINT(1) NOT NULL DEFAULT 0,
  completed_date       DATE NULL,
  current_streak       INT UNSIGNED NOT NULL DEFAULT 0,
  best_streak          INT UNSIGNED NOT NULL DEFAULT 0,
  last_completed_date  DATE NULL,
  is_active            TINYINT(1) NOT NULL DEFAULT 1,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activities_user (user_id, type),
  KEY idx_activities_category (category_id),
  CONSTRAINT fk_activities_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_activities_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial_Rachas: un registro por cada cumplimiento diario
CREATE TABLE streak_history (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  activity_id     INT UNSIGNED NOT NULL,
  completed_date  DATE NOT NULL,
  completed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  xp_earned       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  streak_after    INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_history_activity_day (activity_id, completed_date),
  CONSTRAINT fk_history_activity FOREIGN KEY (activity_id)
    REFERENCES activities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  Datos iniciales
-- ---------------------------------------------------------------------

-- 1 = administrador, 2 = usuario demo
INSERT INTO users (id, display_name, email, password_hash, total_xp, level, role) VALUES
 (1, 'Administrador', 'admin@habitapp.com', '$2y$10$z0Ot8XXFffuYDyxsnYixWe3GYBuB3mR5WSOHZ2g7J95ju.b15xtrK', 0,   1, 'admin'),
 (2, 'Usuario Demo',  'demo@habitapp.com',  '$2y$10$ecYr0M21yU3cndthiy42ue4rn.S0SwHeUpEDel5BAAA3TeXQryuDK', 115, 2, 'user');

-- Categorías base para cada usuario
INSERT INTO categories (id, user_id, name, icon) VALUES
 (1, 1, 'Personal', '✦'), (2, 1, 'Salud', '♥'), (3, 1, 'Estudio', '⌁'), (4, 1, 'Trabajo', '◆'), (5, 1, 'Fitness', '●'),
 (6, 2, 'Personal', '✦'), (7, 2, 'Salud', '♥'), (8, 2, 'Estudio', '⌁'), (9, 2, 'Trabajo', '◆'), (10, 2, 'Fitness', '●');

-- Actividades del usuario demo (fechas relativas a "hoy" para que siempre se vean vivas)
INSERT INTO activities
 (id, user_id, category_id, type, name, description, priority, start_date, due_date, xp_reward,
  completed, completed_date, current_streak, best_streak, last_completed_date) VALUES
 (1, 2, 7,  'habit', 'Tomar 2 litros de agua', 'Llevar la botella a todos lados',  'medium', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL, 5,
   0, NULL, 5, 5, CURDATE()),
 (2, 2, 8,  'habit', 'Leer 20 minutos', 'Antes de dormir, sin celular',            'medium', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL, 10,
   0, NULL, 3, 3, DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
 (3, 2, 10, 'habit', 'Ejercicio en casa', '30 minutos de rutina',                  'high',   DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL, 10,
   0, NULL, 4, 4, DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
 (4, 2, 8,  'task',  'Entregar proyecto de Programación', 'Subir el repositorio a Git', 'high', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 20,
   0, NULL, 0, 0, NULL),
 (5, 2, 9,  'task',  'Pagar el internet', 'Antes del corte de servicio',            'medium', DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 10,
   0, NULL, 0, 0, NULL),
 (6, 2, 6,  'task',  'Comprar cuaderno nuevo', '',                                  'low',    CURDATE(), CURDATE(), 20,
   1, CURDATE(), 0, 0, NULL);

-- Historial de rachas del usuario demo
INSERT INTO streak_history (activity_id, completed_date, xp_earned, streak_after) VALUES
 (1, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 5, 1), (1, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 5, 2),
 (1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 5, 3), (1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 5, 4),
 (1, CURDATE(), 5, 5),
 (2, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 10, 1), (2, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 10, 2),
 (2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 10, 3),
 (3, DATE_SUB(CURDATE(), INTERVAL 6 DAY), 10, 1), (3, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 10, 2),
 (3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 10, 3), (3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 10, 4),
 (6, CURDATE(), 20, NULL);
