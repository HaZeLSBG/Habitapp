<?php
/** GET categories.php -> categorías activas del usuario en sesión. */
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$u  = require_login();
$st = db()->prepare('SELECT id, name, icon FROM categories WHERE user_id = ? AND active = 1 ORDER BY name');
$st->execute([$u['id']]);
$rows = $st->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
}
json_out(['categories' => $rows]);
