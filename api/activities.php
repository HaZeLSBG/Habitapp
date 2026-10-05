<?php
/**
 * Tareas y hábitos del usuario en sesión.
 *   GET  activities.php?action=list
 *   POST activities.php?action=create    -> { type, name, description, categoryId, priority, startDate, xpReward }
 *   POST activities.php?action=complete  -> { id }
 *   POST activities.php?action=delete    -> { id }
 */
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$user   = require_login();
$uid    = (int) $user['id'];
$action = $_GET['action'] ?? 'list';

/** Convierte una fila de la BD al formato que usa el frontend. */
function activity_out(array $r): array
{
    $isHabit = $r['type'] === 'habit';
    $last    = $r['last_completed_date'];
    // Si el hábito no se cumplió ayer ni hoy, la racha vigente es 0 (se rompió)
    $streak  = (int) $r['current_streak'];
    if ($isHabit && $last !== today() && $last !== yesterday()) {
        $streak = 0;
    }
    return [
        'id'                => (int) $r['id'],
        'type'              => $r['type'],
        'name'              => $r['name'],
        'description'       => $r['description'],
        'categoryId'        => $r['category_id'] !== null ? (int) $r['category_id'] : null,
        'categoryName'      => $r['category_name'] ?? null,
        'priority'          => $r['priority'],
        'startDate'         => $r['start_date'],
        'dueDate'           => $r['due_date'],
        'xpReward'          => (int) $r['xp_reward'],
        'completed'         => (bool) $r['completed'],
        'completedDate'     => $r['completed_date'],
        'currentStreak'     => $streak,
        'bestStreak'        => (int) $r['best_streak'],
        'lastCompletedDate' => $last,
        'doneToday'         => $isHabit ? ($last === today()) : (bool) $r['completed'],
    ];
}

function fetch_activity(int $id, int $uid): ?array
{
    $st = db()->prepare(
        'SELECT a.*, c.name AS category_name FROM activities a
         LEFT JOIN categories c ON c.id = a.category_id
         WHERE a.id = ? AND a.user_id = ?'
    );
    $st->execute([$id, $uid]);
    $r = $st->fetch();
    return $r ?: null;
}

switch ($action) {
    case 'list':
        $st = db()->prepare(
            'SELECT a.*, c.name AS category_name FROM activities a
             LEFT JOIN categories c ON c.id = a.category_id
             WHERE a.user_id = ? ORDER BY a.created_at DESC, a.id DESC'
        );
        $st->execute([$uid]);
        json_out([
            'today'      => today(),
            'user'       => user_public($user),
            'activities' => array_map('activity_out', $st->fetchAll()),
        ]);

    case 'create':
        require_post();
        $in    = body();
        $type  = $in['type'] ?? '';
        $name  = trim((string) ($in['name'] ?? ''));
        $desc  = trim((string) ($in['description'] ?? ''));
        $prio  = $in['priority'] ?? 'medium';
        $start = (string) ($in['startDate'] ?? today());
        $xp    = (int) ($in['xpReward'] ?? 10);
        $catId = isset($in['categoryId']) && $in['categoryId'] !== '' ? (int) $in['categoryId'] : null;

        if (!in_array($type, ['task', 'habit'], true))        fail('Tipo no válido.');
        if (!in_array($prio, ['low', 'medium', 'high'], true)) fail('Prioridad no válida.');
        if (!in_array($xp, [5, 10, 20], true))                 fail('XP no válido.');
        if ($name === '' || mb_strlen($name) > 80)             fail('El nombre es obligatorio (máx. 80 caracteres).');
        if (mb_strlen($desc) > 180)                            fail('La descripción es muy larga (máx. 180).');
        if (!valid_date($start))                               fail('La fecha no es válida.');

        if ($catId !== null) {
            $st = db()->prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?');
            $st->execute([$catId, $uid]);
            if (!$st->fetch()) fail('Categoría no válida.');
        }
        $st = db()->prepare(
            'INSERT INTO activities (user_id, category_id, type, name, description, priority, start_date, due_date, xp_reward)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $st->execute([$uid, $catId, $type, $name, $desc, $prio, $start, $type === 'task' ? $start : null, $xp]);
        json_out(['activity' => activity_out(fetch_activity((int) db()->lastInsertId(), $uid))], 201);

    case 'complete':
        require_post();
        $id  = (int) (body()['id'] ?? 0);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('SELECT * FROM activities WHERE id = ? AND user_id = ? FOR UPDATE');
            $st->execute([$id, $uid]);
            $a = $st->fetch();
            if (!$a) {
                $pdo->rollBack();
                fail('Elemento no encontrado.', 404);
            }
            $today = today();
            $xp    = (int) $a['xp_reward'];

            if ($a['type'] === 'habit') {
                if ($a['last_completed_date'] === $today) {
                    $pdo->rollBack();
                    fail('Este hábito ya fue completado hoy.', 409);
                }
                $streak = $a['last_completed_date'] === yesterday() ? (int) $a['current_streak'] + 1 : 1;
                $best   = max($streak, (int) $a['best_streak']);
                $pdo->prepare('INSERT INTO streak_history (activity_id, completed_date, xp_earned, streak_after) VALUES (?, ?, ?, ?)')
                    ->execute([$id, $today, $xp, $streak]);
                $pdo->prepare('UPDATE activities SET current_streak = ?, best_streak = ?, last_completed_date = ? WHERE id = ?')
                    ->execute([$streak, $best, $today, $id]);
            } else {
                if ((int) $a['completed'] === 1) {
                    $pdo->rollBack();
                    fail('Esta tarea ya fue completada.', 409);
                }
                $pdo->prepare('INSERT INTO streak_history (activity_id, completed_date, xp_earned, streak_after) VALUES (?, ?, ?, NULL)')
                    ->execute([$id, $today, $xp]);
                $pdo->prepare('UPDATE activities SET completed = 1, completed_date = ? WHERE id = ?')
                    ->execute([$today, $id]);
            }

            $newXp    = (int) $user['total_xp'] + $xp;
            $oldLevel = level_for((int) $user['total_xp']);
            $newLevel = level_for($newXp);
            $pdo->prepare('UPDATE users SET total_xp = ?, level = ? WHERE id = ?')->execute([$newXp, $newLevel, $uid]);
            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        json_out([
            'xpEarned'  => $xp,
            'leveledUp' => $newLevel > $oldLevel,
            'totalXp'   => $newXp,
            'level'     => $newLevel,
        ]);

    case 'delete':
        require_post();
        $id = (int) (body()['id'] ?? 0);
        $st = db()->prepare('DELETE FROM activities WHERE id = ? AND user_id = ?'); // streak_history se borra en cascada
        $st->execute([$id, $uid]);
        if ($st->rowCount() === 0) fail('Elemento no encontrado.', 404);
        json_out(['ok' => true]);

    default:
        fail('Acción no válida.', 404);
}
