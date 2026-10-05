<?php
/**
 * Utilidades comunes de la API: conexión PDO, sesión, JSON y validaciones.
 * Todos los endpoints hacen require de este archivo.
 */
declare(strict_types=1);

$CONFIG = require __DIR__ . '/config.php';
date_default_timezone_set($CONFIG['timezone']);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

set_exception_handler(function (Throwable $e) {
    error_log('[HabitApp] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error interno del servidor. Revisa que MySQL esté iniciado y que la base "habitapp" exista.']);
    exit;
});

function cfg(string $key)
{
    global $CONFIG;
    return $CONFIG[$key];
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            cfg('db_host'), cfg('db_port'), cfg('db_name'));
        $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400): void
{
    json_out(['error' => $message], $code);
}

/** Lee el cuerpo JSON de la petición. Las escrituras exigen la cabecera X-Requested-With (anti-CSRF). */
function body(): array
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'HabitApp') {
            fail('Petición no permitida.', 403);
        }
    }
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fail('Método no permitido.', 405);
    }
}

function today(): string
{
    return date('Y-m-d');
}

function yesterday(): string
{
    return date('Y-m-d', strtotime('-1 day'));
}

function level_for(int $xp): int
{
    return intdiv($xp, cfg('xp_per_level')) + 1;
}

function user_public(array $u): array
{
    $xp = (int) $u['total_xp'];
    return [
        'id'          => (int) $u['id'],
        'displayName' => $u['display_name'],
        'email'       => $u['email'],
        'photoURL'    => $u['photo_url'],
        'role'        => $u['role'],
        'totalXp'     => $xp,
        'level'       => level_for($xp),
        'xpPerLevel'  => cfg('xp_per_level'),
    ];
}

function current_user(): ?array
{
    if (empty($_SESSION['uid'])) {
        return null;
    }
    $st = db()->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$_SESSION['uid']]);
    $u = $st->fetch();
    return $u ?: null;
}

function require_login(): array
{
    $u = current_user();
    if (!$u) {
        fail('Sesión no iniciada.', 401);
    }
    return $u;
}

function require_admin(): array
{
    $u = require_login();
    if ($u['role'] !== 'admin') {
        fail('No tienes permisos de administrador.', 403);
    }
    return $u;
}

function valid_date(?string $d): bool
{
    if (!$d || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) {
        return false;
    }
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}

function create_default_categories(int $userId): void
{
    $defaults = [['Personal', '✦'], ['Salud', '♥'], ['Estudio', '⌁'], ['Trabajo', '◆'], ['Fitness', '●']];
    $st = db()->prepare('INSERT IGNORE INTO categories (user_id, name, icon) VALUES (?, ?, ?)');
    foreach ($defaults as [$name, $icon]) {
        $st->execute([$userId, $name, $icon]);
    }
}
