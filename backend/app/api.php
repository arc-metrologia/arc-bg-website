<?php
declare(strict_types=1);

/** JSON API: /api/... Всички промени изискват CSRF токен и пълен вход с 2FA. */

function api(string $method, string $route): never
{
    $m = [];
    $is = function (string $verb, string $pattern) use ($method, $route, &$m): bool {
        return $verb === $method && preg_match('~^' . $pattern . '$~', $route, $m) === 1;
    };
    $b = fn(string $k, mixed $d = '') => Http::body()[$k] ?? $d;
    $lang = in_array($_GET['lang'] ?? '', config('languages'), true) ? $_GET['lang'] : config('default_lang');

    // ---- публични
    if ($is('GET', 'public/page')) {
        Auth::hasSessionCookie() && Auth::start();
        $path = trim((string)($_GET['path'] ?? ''), '/');
        $row = Content::find($lang, $path, Auth::can(Auth::user(), 'posts'));
        if (!$row) {
            Http::json(['error' => 'Страницата не е намерена.', 'site' => Content::site($lang)], 404);
        }
        Http::json(Content::payload($row) + ['site' => Content::site($lang)]);
    }
    if ($is('POST', 'public/contact')) {
        contact_form();
    }

    // ---- автентикация
    Auth::start();
    if ($method !== 'GET') {
        // Логин формата също изисква токена — получава се от GET /api/auth/me.
        Auth::checkCsrf();
    }

    if ($is('GET', 'auth/me')) {
        $u = Auth::user();
        Http::json([
            'stage' => Auth::stage(),
            'user' => $u ? $u + ['permissions' => Auth::permissions($u['role'])] : null,
            'csrf' => Auth::csrf(),
            'setupRequired' => (int)Db::val('SELECT COUNT(*) FROM users') === 0,
        ]);
    }
    if ($is('POST', 'auth/login')) {
        $stage = Auth::login((string)$b('email'), (string)$b('password'));
        Http::json(['stage' => $stage, 'csrf' => Auth::csrf()]);
    }
    if ($is('POST', 'auth/2fa')) {
        Auth::verifySecondFactor((string)$b('code'));
        Http::json(['stage' => 'ok', 'csrf' => Auth::csrf()]);
    }
    if ($is('POST', 'auth/enroll/start')) {
        Http::json(Auth::enrollStart());
    }
    if ($is('POST', 'auth/enroll/confirm')) {
        $codes = Auth::enrollConfirm((string)$b('code'));
        Http::json(['stage' => 'ok', 'csrf' => Auth::csrf(), 'recoveryCodes' => $codes]);
    }
    if ($is('POST', 'auth/logout')) {
        if ($u = Auth::user()) {
            Db::audit($u['id'], 'auth.logout');
        }
        Auth::destroy();
        Http::json(['ok' => true]);
    }
    if ($is('POST', 'setup')) {
        if ((int)Db::val('SELECT COUNT(*) FROM users') > 0) {
            throw new HttpError(403, 'Системата вече е настроена.');
        }
        $token = (string)config('setup_token');
        if (strlen($token) < 16 || !hash_equals($token, (string)$b('token'))) {
            throw new HttpError(403, 'Невалиден setup токен (поне 16 символа, задава се в config.php).');
        }
        $id = create_user((string)$b('email'), (string)$b('name'), 'admin', (string)$b('password'));
        Db::audit($id, 'setup.first_admin');
        Http::json(['ok' => true]);
    }

    // ---- оттук нататък: напълно влязъл потребител
    $user = Auth::require();

    if ($is('POST', 'account/password')) {
        $row = Db::one('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
        if (!password_verify((string)$b('current'), $row['password_hash'])) {
            throw new HttpError(422, 'Текущата парола е грешна.');
        }
        Auth::validatePassword((string)$b('password'));
        Db::update('users', ['password_hash' => password_hash((string)$b('password'), PASSWORD_DEFAULT)], $user['id']);
        Db::audit($user['id'], 'account.password_changed');
        Http::json(['ok' => true]);
    }
    if ($is('POST', 'account/recovery-codes')) {
        [$plain, $hashes] = Auth::makeRecoveryCodes();
        Db::update('users', ['recovery_codes' => json_encode($hashes)], $user['id']);
        Db::audit($user['id'], 'account.recovery_codes_regenerated');
        Http::json(['recoveryCodes' => $plain]);
    }

    // ---- съдържание
    if ($is('GET', 'admin/pages')) {
        Auth::require('posts');
        $where = [];
        $params = [];
        if (!empty($_GET['type'])) {
            $where[] = 'type = ?';
            $params[] = $_GET['type'];
        }
        if (!empty($_GET['lang'])) {
            $where[] = 'lang = ?';
            $params[] = $_GET['lang'];
        }
        if (!Auth::can($user, 'content')) {
            $where[] = "type = 'post'";
        }
        $sql = 'SELECT id, type, lang, path, title, status, translation_key, updated_at, published_at, sort_order FROM pages'
            . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY lang, path';
        Http::json(array_map(fn($r) => $r + ['url' => Content::url($r['lang'], $r['path'])], Db::all($sql, $params)));
    }
    if ($is('GET', 'admin/pages/(\d+)')) {
        Auth::require('posts');
        $row = Db::one('SELECT * FROM pages WHERE id = ?', [(int)$m[1]]) ?? throw new HttpError(404, 'Не е намерена.');
        Http::json(Content::view($row));
    }
    if ($is('POST', 'admin/pages')) {
        Auth::require('posts');
        Http::json(Content::save(null, Http::body(), $user), 201);
    }
    if ($is('PUT', 'admin/pages/(\d+)')) {
        Auth::require('posts');
        Http::json(Content::save((int)$m[1], Http::body(), $user));
    }
    if ($is('DELETE', 'admin/pages/(\d+)')) {
        Auth::require('publish');
        $row = Db::one('SELECT lang, path FROM pages WHERE id = ?', [(int)$m[1]]) ?? throw new HttpError(404, 'Не е намерена.');
        if ($row['path'] === '') {
            throw new HttpError(422, 'Началната страница не може да бъде изтрита.');
        }
        Db::run('DELETE FROM revisions WHERE page_id = ?', [(int)$m[1]]);
        Db::run('DELETE FROM pages WHERE id = ?', [(int)$m[1]]);
        Db::audit($user['id'], 'page.delete', Content::url($row['lang'], $row['path']));
        Http::json(['ok' => true]);
    }
    if ($is('GET', 'admin/pages/(\d+)/revisions')) {
        Auth::require('posts');
        Http::json(Db::all(
            'SELECT r.id, r.created_at, u.name AS user_name FROM revisions r LEFT JOIN users u ON u.id = r.user_id WHERE r.page_id = ? ORDER BY r.id DESC',
            [(int)$m[1]]
        ));
    }
    if ($is('POST', 'admin/revisions/(\d+)/restore')) {
        Auth::require('posts');
        $rev = Db::one('SELECT * FROM revisions WHERE id = ?', [(int)$m[1]]) ?? throw new HttpError(404, 'Не е намерена.');
        $old = json_decode($rev['data'], true);
        $page = Content::save((int)$rev['page_id'], Content::view($old), $user);
        Http::json($page);
    }

    // ---- медия
    if ($is('GET', 'admin/media')) {
        Auth::require('media');
        $kind = in_array($_GET['kind'] ?? '', ['image', 'video', 'file'], true) ? $_GET['kind'] : null;
        $rows = $kind
            ? Db::all('SELECT * FROM media WHERE kind = ? ORDER BY id DESC', [$kind])
            : Db::all('SELECT * FROM media ORDER BY id DESC');
        Http::json(array_map(fn($r) => Media::view($r, $lang), $rows));
    }
    if ($is('POST', 'admin/media')) {
        Auth::require('media');
        Http::json(Media::upload($_FILES['file'] ?? [], $user['id']), 201);
    }
    if ($is('PUT', 'admin/media/(\d+)')) {
        Auth::require('media');
        Db::update('media', [
            'alt_bg' => Sanitizer::text($b('altBg'), 300),
            'alt_en' => Sanitizer::text($b('altEn'), 300),
            'title' => Sanitizer::text($b('title'), 200),
        ], (int)$m[1]);
        Http::json(Media::view(Db::one('SELECT * FROM media WHERE id = ?', [(int)$m[1]]), $lang));
    }
    if ($is('DELETE', 'admin/media/(\d+)')) {
        Auth::require('publish');
        Media::delete((int)$m[1]);
        Db::audit($user['id'], 'media.delete', $m[1]);
        Http::json(['ok' => true]);
    }

    // ---- настройки (данни за фирмата, навигация)
    if ($is('GET', 'admin/settings/([a-z_]+)')) {
        Auth::require('settings');
        Http::json(Db::setting($m[1], null));
    }
    if ($is('PUT', 'admin/settings/(site|nav_bg|nav_en|redirects)')) {
        Auth::require('settings');
        $value = Http::body();
        Db::saveSetting($m[1], sanitize_setting($value));
        Db::audit($user['id'], 'settings.update', $m[1]);
        Http::json(Db::setting($m[1]));
    }

    // ---- потребители (само администратор)
    if ($is('GET', 'admin/users')) {
        Auth::require('users');
        Http::json(Db::all('SELECT id, email, name, role, active, totp_enabled, last_login_at, created_at FROM users ORDER BY id'));
    }
    if ($is('POST', 'admin/users')) {
        Auth::require('users');
        $id = create_user((string)$b('email'), (string)$b('name'), (string)$b('role'), (string)$b('password'));
        Db::audit($user['id'], 'user.create', (string)$b('email'));
        Http::json(['id' => $id], 201);
    }
    if ($is('PUT', 'admin/users/(\d+)')) {
        Auth::require('users');
        $id = (int)$m[1];
        if ($id === $user['id'] && ($b('role', $user['role']) !== 'admin' || !$b('active', 1))) {
            throw new HttpError(422, 'Не можете да премахнете собствените си администраторски права.');
        }
        $data = [];
        if (in_array($b('role', null), Auth::ROLES, true)) {
            $data['role'] = $b('role');
        }
        if ($b('active', null) !== null) {
            $data['active'] = $b('active') ? 1 : 0;
        }
        if ($b('password', '') !== '') {
            Auth::validatePassword((string)$b('password'));
            $data['password_hash'] = password_hash((string)$b('password'), PASSWORD_DEFAULT);
        }
        if ($b('reset2fa', false)) {
            $data += ['totp_enabled' => 0, 'totp_secret' => null, 'recovery_codes' => null, 'totp_last_step' => 0];
        }
        if ($data) {
            Db::update('users', $data, $id);
        }
        Db::audit($user['id'], 'user.update', "#$id " . implode(',', array_keys($data)));
        Http::json(['ok' => true]);
    }

    // ---- вътрешни инструменти (адресът е в конфигурацията, не в кода)
    if ($is('GET', 'admin/comparator')) {
        Auth::require('content');
        Http::json(['url' => (string)config('comparator_url', '')]);
    }

    // ---- запитвания и одит
    if ($is('GET', 'admin/messages')) {
        Auth::require('messages');
        Http::json(Db::all('SELECT * FROM messages ORDER BY id DESC LIMIT 500'));
    }
    if ($is('GET', 'admin/audit')) {
        Auth::require('audit');
        Http::json(Db::all('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 500'));
    }

    throw new HttpError(404, 'Няма такъв API адрес.');
}

function create_user(string $email, string $name, string $role, string $password): int
{
    $email = mb_strtolower(trim($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new HttpError(422, 'Невалиден имейл.');
    }
    if (!in_array($role, Auth::ROLES, true)) {
        throw new HttpError(422, 'Невалидна роля.');
    }
    if (Db::val('SELECT COUNT(*) FROM users WHERE email = ?', [$email])) {
        throw new HttpError(409, 'Вече има потребител с този имейл.');
    }
    Auth::validatePassword($password);
    return Db::insert('users', [
        'email' => $email,
        'name' => Sanitizer::text($name, 100) ?: $email,
        'role' => $role,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'totp_enabled' => 0,
        'totp_last_step' => 0,
        'active' => 1,
        'created_at' => now(),
    ]);
}

/** Рекурсивно почистване на настройките: само низове/числа, URL полетата се валидират. */
function sanitize_setting(mixed $v, string $key = ''): mixed
{
    if (is_array($v)) {
        $out = [];
        foreach (array_slice($v, 0, 200, true) as $k => $item) {
            $out[is_int($k) ? $k : Sanitizer::text($k, 50)] = sanitize_setting($item, (string)$k);
        }
        return $out;
    }
    if (is_bool($v) || is_int($v) || is_float($v)) {
        return $v;
    }
    return $key === 'url' ? Sanitizer::url($v) : Sanitizer::text($v, 2000);
}

function contact_form(): never
{
    $in = Http::body();
    // Капан за ботове: скрито поле, което хората не попълват.
    if (!empty($in['website'])) {
        Http::json(['ok' => true]);
    }
    $since = date('Y-m-d H:i:s', time() - 3600);
    if ((int)Db::val('SELECT COUNT(*) FROM messages WHERE ip = ? AND created_at > ?', [Http::ip(), $since]) >= 5) {
        throw new HttpError(429, 'Изпратихте много съобщения. Опитайте пак след час или ни се обадете.');
    }
    $row = [
        'name' => Sanitizer::text($in['name'] ?? '', 120),
        'email' => Sanitizer::text($in['email'] ?? '', 200),
        'phone' => Sanitizer::text($in['phone'] ?? '', 50),
        'company' => Sanitizer::text($in['company'] ?? '', 200),
        'body' => Sanitizer::text($in['message'] ?? '', 5000),
        'page' => Sanitizer::text($in['page'] ?? '', 300),
        'ip' => Http::ip(),
        'created_at' => now(),
    ];
    if ($row['name'] === '' || $row['body'] === '' || !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) {
        throw new HttpError(422, 'Попълнете име, валиден имейл и съобщение.');
    }
    Db::insert('messages', $row);
    $to = (string)config('mail_to');
    if ($to && config('env') !== 'development') {
        $subject = '=?UTF-8?B?' . base64_encode('Запитване от сайта: ' . $row['name']) . '?=';
        $text = "Име: {$row['name']}\nФирма: {$row['company']}\nИмейл: {$row['email']}\nТелефон: {$row['phone']}\nСтраница: {$row['page']}\n\n{$row['body']}";
        $headers = "From: " . config('mail_from') . "\r\nReply-To: " . str_replace(["\r", "\n"], '', $row['email']) . "\r\nContent-Type: text/plain; charset=UTF-8";
        @mail($to, $subject, $text, $headers);
    }
    Http::json(['ok' => true]);
}
