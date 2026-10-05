<?php
/**
 * Panel de administrador (solo role = admin).
 *   GET  admin.php?action=users
 *   GET  admin.php?action=user&id=N
 *   POST admin.php?action=set_xp                { id, xp }
 *   POST admin.php?action=set_role              { id, role }
 *   POST admin.php?action=reset_password        { id, password }
 *   POST admin.php?action=delete_activity       { id }
 *   POST admin.php?action=delete_user_activities{ id }
 *   POST admin.php?action=delete_user           { id }
 */
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$admin  = require_admin();
$action = $_GET['action'] ?? 'users';

function target_user(int $id): array
{
    $st = db()->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u) fail('Usuario no encontrado.', 404);
    return $u;
}

switch ($action) {
    case 'users':
        $rows = db()->query(
            'SELECT u.*, (SELECT COUNT(*) FROM activities a WHERE a.user_id = u.id) AS activity_count
             FROM users u ORDER BY u.created_at, u.id'
        )->fetchAll();
        $totalActivities = 0;
        $totalXp = 0;
        $users = [];
        foreach ($rows as $r) {
            $totalActivities += (int) $r['activity_count'];
            $totalXp += (int) $r['total_xp'];
            $users[] = user_public($r) + ['activityCount' => (int) $r['activity_count']];
        }
        json_out([
            'stats' => ['users' => count($users), 'activities' => $totalActivities, 'xp' => $totalXp],
            'users' => $users,
            'me'    => (int) $admin['id'],
        ]);

    case 'user':
        $u  = target_user((int) ($_GET['id'] ?? 0));
        $st = db()->prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC, id DESC');
        $st->execute([$u['id']]);
        $acts = [];
        foreach ($st->fetchAll() as $a) {
            $acts[] = [
                'id' => (int) $a['id'], 'type' => $a['type'], 'name' => $a['name'],
                'currentStreak' => (int) $a['current_streak'], 'bestStreak' => (int) $a['best_streak'],
                'completed' => (bool) $a['completed'],
            ];
        }
        json_out(['user' => user_public($u), 'activities' => $acts, 'isSelf' => (int) $u['id'] === (int) $admin['id']]);

    case 'set_xp':
        require_post();
        $in = body();
        $u  = target_user((int) ($in['id'] ?? 0));
        $xp = max(0, (int) ($in['xp'] ?? 0));
        db()->prepare('UPDATE users SET total_xp = ?, level = ? WHERE id = ?')->execute([$xp, level_for($xp), $u['id']]);
        json_out(['ok' => true]);

    case 'set_role':
        require_post();
        $in   = body();
        $u    = target_user((int) ($in['id'] ?? 0));
        $role = $in['role'] ?? '';
        if (!in_array($role, ['user', 'admin'], true)) fail('Rol no válido.');
        if ((int) $u['id'] === (int) $admin['id']) fail('No puedes cambiar tu propio rol.', 409);
        db()->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $u['id']]);
        json_out(['ok' => true]);

    case 'reset_password':
        require_post();
        $in   = body();
        $u    = target_user((int) ($in['id'] ?? 0));
        $pass = (string) ($in['password'] ?? '');
        if (strlen($pass) < 6) fail('La contraseña debe tener al menos 6 caracteres.');
        db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_BCRYPT), $u['id']]);
        json_out(['ok' => true]);

    case 'delete_activity':
        require_post();
        $st = db()->prepare('DELETE FROM activities WHERE id = ?');
        $st->execute([(int) (body()['id'] ?? 0)]);
        if ($st->rowCount() === 0) fail('Elemento no encontrado.', 404);
        json_out(['ok' => true]);

    case 'delete_user_activities':
        require_post();
        $u = target_user((int) (body()['id'] ?? 0));
        db()->prepare('DELETE FROM activities WHERE user_id = ?')->execute([$u['id']]);
        json_out(['ok' => true]);

    case 'delete_user':
        require_post();
        $u = target_user((int) (body()['id'] ?? 0));
        if ((int) $u['id'] === (int) $admin['id']) fail('No puedes eliminar tu propia cuenta.', 409);
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]); // cascada a categorías, actividades e historial
        json_out(['ok' => true]);

    default:
        fail('Acción no válida.', 404);
}
