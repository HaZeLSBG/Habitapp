<?php
/**
 * Autenticación.
 *   GET  auth.php?action=me        -> usuario en sesión (o 401)
 *   POST auth.php?action=login     -> { email, password, role: "user"|"admin" }
 *   POST auth.php?action=register  -> { name, email, password }
 *   POST auth.php?action=logout
 */
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'me':
        $u = require_login();
        json_out(['user' => user_public($u), 'today' => today()]);

    case 'login':
        require_post();
        $in    = body();
        $email = strtolower(trim((string) ($in['email'] ?? '')));
        $pass  = (string) ($in['password'] ?? '');
        $mode  = ($in['role'] ?? 'user') === 'admin' ? 'admin' : 'user';

        if ($email === '' || $pass === '') {
            fail('Escribe tu correo y tu contraseña.');
        }
        $st = db()->prepare('SELECT * FROM users WHERE email = ?');
        $st->execute([$email]);
        $u = $st->fetch();

        // password_verify también se ejecuta si el correo no existe (evita revelar qué correos existen)
        $hash = $u['password_hash'] ?? '$2y$10$abcdefghijklmnopqrstuuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        if (!$u || !password_verify($pass, $hash)) {
            fail('Correo o contraseña incorrectos.', 401);
        }
        if ($mode === 'admin' && $u['role'] !== 'admin') {
            fail('Esta cuenta no tiene permisos de administrador.', 403);
        }
        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $u['id'];
        json_out([
            'user'     => user_public($u),
            'redirect' => $mode === 'admin' ? 'admin.html' : 'dashboard.html',
        ]);

    case 'register':
        require_post();
        $in    = body();
        $name  = trim((string) ($in['name'] ?? ''));
        $email = strtolower(trim((string) ($in['email'] ?? '')));
        $pass  = (string) ($in['password'] ?? '');

        if (mb_strlen($name) < 2 || mb_strlen($name) > 40) {
            fail('Escribe un nombre válido (2 a 40 caracteres).');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) {
            fail('El correo no es válido.');
        }
        if (strlen($pass) < 6) {
            fail('La contraseña debe tener al menos 6 caracteres.');
        }
        $st = db()->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([$email]);
        if ($st->fetch()) {
            fail('Ese correo ya está registrado.', 409);
        }
        $st = db()->prepare(
            'INSERT INTO users (display_name, email, password_hash, timezone, role) VALUES (?, ?, ?, ?, "user")'
        );
        $st->execute([$name, $email, password_hash($pass, PASSWORD_BCRYPT), cfg('timezone')]);
        $id = (int) db()->lastInsertId();
        create_default_categories($id);

        session_regenerate_id(true);
        $_SESSION['uid'] = $id;
        $st = db()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$id]);
        json_out(['user' => user_public($st->fetch()), 'redirect' => 'dashboard.html'], 201);

    case 'logout':
        require_post();
        body();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'] ?? '', $p['secure'] ?? false, true);
        }
        session_destroy();
        json_out(['ok' => true]);

    default:
        fail('Acción no válida.', 404);
}
