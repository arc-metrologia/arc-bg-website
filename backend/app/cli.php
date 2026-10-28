<?php
declare(strict_types=1);

/**
 * Команди (локално или по SSH в SuperHosting):
 *   php app/cli.php init                         — създава таблиците (MySQL или SQLite според config)
 *   php app/cli.php seed                         — начално съдържание, мигрирано от стария arc-bg.com
 *   php app/cli.php user <email> <име> <роля> <парола>
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/bootstrap.php';

$cmd = $argv[1] ?? '';

switch ($cmd) {
    case 'init':
        $file = Db::driver() === 'sqlite' ? 'schema.sqlite.sql' : 'schema.mysql.sql';
        $sql = (string)file_get_contents(__DIR__ . "/database/$file");
        $sql = preg_replace('/^--.*$/m', '', $sql);
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
            Db::pdo()->exec($stmt);
        }
        echo "Таблиците са създадени ($file).\n";
        break;

    case 'user':
        require __DIR__ . '/api.php';
        [, , $email, $name, $role, $password] = $argv + array_fill(0, 6, '');
        $id = create_user($email, $name, $role, $password);
        echo "Създаден потребител #$id ($role). При първия вход ще настрои двуфакторна автентикация.\n";
        break;

    case 'seed':
        require __DIR__ . '/database/seed.php';
        seed();
        break;

    case 'seed-news':
        // Добавя пренесената новина от стария сайт към вече попълнена база.
        require __DIR__ . '/database/seed.php';
        seed_grant_news();
        break;

    default:
        echo "Използване: php app/cli.php init|seed|user\n";
        exit(1);
}
