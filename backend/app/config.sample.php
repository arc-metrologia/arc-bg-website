<?php
// Копирайте като app/config.php (или по-добре: /home/<user>/arc-config.php — извън public_html).
// Никога не комитвайте истинския config.php в git.
return [
    'env' => 'production',              // 'development' показва грешките
    'base_url' => 'https://www.arc-bg.com',

    // MySQL в SuperHosting (cPanel → MySQL Databases). Локално може SQLite:
    // 'dsn' => 'sqlite:' . __DIR__ . '/../../data/dev.sqlite'
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=CPANELUSER_arc;charset=utf8mb4',
        'user' => 'CPANELUSER_arc',
        'pass' => '',
    ],

    // 32 случайни байта в base64: php -r "echo base64_encode(random_bytes(32));"
    // Използва се за криптиране на 2FA тайните. Ако се смени, всички трябва да настроят 2FA наново.
    'app_key' => '',

    // Еднократен токен за създаване на първия администратор през /admin/setup.
    // Работи само докато в базата няма нито един потребител.
    'setup_token' => '',

    // Вътрешен сравнител на машини, вграден в админ панела (Админ → Сравнител). Само https.
    // Пази се тук, а не в кода, за да не се публикува адресът.
    'comparator_url' => '',

    'mail_to' => 'arc@arc-bg.com',
    'mail_from' => 'no-reply@arc-bg.com',
    'upload_max_mb' => 200,
    'languages' => ['bg', 'en'],
    'default_lang' => 'bg',
];
