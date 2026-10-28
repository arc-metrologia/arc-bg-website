<?php
declare(strict_types=1);

/**
 * Сесии, роли и задължителна двуфакторна автентикация (TOTP).
 *
 * Етапи на сесията ($_SESSION['stage']):
 *   '2fa'    — паролата е вярна, чака се код от приложението или резервен код;
 *   'enroll' — паролата е вярна, но потребителят още няма 2FA и трябва да я настрои;
 *   'ok'     — напълно влязъл.
 * Без етап 'ok' не е достъпна нито една административна операция.
 */
final class Auth
{
    public const ROLES = ['admin', 'editor', 'author'];

    private const PERMISSIONS = [
        'admin' => ['content', 'publish', 'posts', 'media', 'settings', 'messages', 'users', 'audit'],
        'editor' => ['content', 'publish', 'posts', 'media', 'settings', 'messages'],
        'author' => ['posts', 'media'],
    ];

    private const IDLE_TIMEOUT = 7200;
    private const SESSION_NAME = 'arc_sid';

    private static bool $started = false;

    public static function hasSessionCookie(): bool
    {
        return isset($_COOKIE[self::SESSION_NAME]);
    }

    public static function start(): void
    {
        if (self::$started) {
            return;
        }
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_name(self::SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => Http::isHttps(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
        self::$started = true;

        $last = $_SESSION['t'] ?? 0;
        if ($last && time() - $last > self::IDLE_TIMEOUT) {
            self::destroy();
            session_start();
        }
        $_SESSION['t'] = time();
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 3600, $p['path'], '', $p['secure'], true);
            session_destroy();
        }
    }

    public static function csrf(): string
    {
        return $_SESSION['csrf'] ?? '';
    }

    public static function checkCsrf(): void
    {
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($sent) || $sent === '' || !hash_equals(self::csrf(), $sent)) {
            throw new HttpError(403, 'Невалидна сесия. Презаредете страницата.');
        }
    }

    public static function stage(): string
    {
        return $_SESSION['stage'] ?? 'none';
    }

    /** Напълно автентикиран потребител или null. */
    public static function user(): ?array
    {
        if (self::stage() !== 'ok' || empty($_SESSION['uid'])) {
            return null;
        }
        static $cache = null;
        if ($cache === null || $cache['id'] !== $_SESSION['uid']) {
            $cache = Db::one('SELECT id, email, name, role, active FROM users WHERE id = ?', [$_SESSION['uid']]);
            if (!$cache || !$cache['active']) {
                self::destroy();
                return null;
            }
            $cache['id'] = (int)$cache['id'];
        }
        return $cache;
    }

    public static function can(?array $user, string $perm): bool
    {
        return $user !== null && in_array($perm, self::PERMISSIONS[$user['role']] ?? [], true);
    }

    public static function permissions(string $role): array
    {
        return self::PERMISSIONS[$role] ?? [];
    }

    public static function require(?string $perm = null): array
    {
        $user = self::user();
        if (!$user) {
            throw new HttpError(401, 'Необходим е вход.');
        }
        if ($perm !== null && !self::can($user, $perm)) {
            throw new HttpError(403, 'Нямате права за това действие.');
        }
        return $user;
    }

    // ---------------------------------------------------------------- вход

    private static function throttle(string $email): void
    {
        $since = date('Y-m-d H:i:s', time() - 900);
        $byIp = (int)Db::val('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND success = 0 AND created_at > ?', [Http::ip(), $since]);
        $byEmail = (int)Db::val('SELECT COUNT(*) FROM login_attempts WHERE email = ? AND success = 0 AND created_at > ?', [$email, $since]);
        if ($byIp >= 10 || $byEmail >= 5) {
            throw new HttpError(429, 'Твърде много неуспешни опити. Опитайте отново след 15 минути.');
        }
    }

    private static function recordAttempt(string $email, bool $ok): void
    {
        Db::insert('login_attempts', ['ip' => Http::ip(), 'email' => $email, 'success' => $ok ? 1 : 0, 'created_at' => now()]);
    }

    public static function login(string $email, string $password): string
    {
        $email = mb_strtolower(trim($email));
        self::throttle($email);
        $user = Db::one('SELECT * FROM users WHERE email = ? AND active = 1', [$email]);
        // Проверка срещу фалшив хеш, за да не се издава по времето дали имейлът съществува.
        $hash = $user['password_hash'] ?? password_hash(random_bytes(8), PASSWORD_DEFAULT);
        if (!password_verify($password, $hash) || !$user) {
            self::recordAttempt($email, false);
            throw new HttpError(401, 'Грешен имейл или парола.');
        }
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            Db::update('users', ['password_hash' => password_hash($password, PASSWORD_DEFAULT)], (int)$user['id']);
        }
        session_regenerate_id(true);
        $_SESSION = [
            'uid' => (int)$user['id'],
            'stage' => $user['totp_enabled'] ? '2fa' : 'enroll',
            'csrf' => bin2hex(random_bytes(32)),
            't' => time(),
            'tries' => 0,
        ];
        return $_SESSION['stage'];
    }

    public static function verifySecondFactor(string $code): void
    {
        if (self::stage() !== '2fa') {
            throw new HttpError(400, 'Първо въведете имейл и парола.');
        }
        $user = Db::one('SELECT * FROM users WHERE id = ? AND active = 1', [$_SESSION['uid']]);
        if (!$user) {
            self::destroy();
            throw new HttpError(401, 'Сесията е изтекла.');
        }
        $code = preg_replace('/\s+/', '', $code);
        $ok = false;

        if (preg_match('/^\d{6}$/', $code)) {
            $step = Totp::verify(Crypto::decrypt($user['totp_secret']), $code, (int)$user['totp_last_step']);
            if ($step !== null) {
                Db::update('users', ['totp_last_step' => $step], (int)$user['id']);
                $ok = true;
            }
        } else {
            $codes = json_decode($user['recovery_codes'] ?: '[]', true);
            foreach ($codes as $i => $h) {
                if (password_verify(strtolower($code), $h)) {
                    unset($codes[$i]);
                    Db::update('users', ['recovery_codes' => json_encode(array_values($codes))], (int)$user['id']);
                    Db::audit((int)$user['id'], 'auth.recovery_code_used');
                    $ok = true;
                    break;
                }
            }
        }

        if (!$ok) {
            self::recordAttempt($user['email'], false);
            $_SESSION['tries'] = ($_SESSION['tries'] ?? 0) + 1;
            if ($_SESSION['tries'] >= 5) {
                self::destroy();
                throw new HttpError(401, 'Твърде много грешни кодове. Влезте отново.');
            }
            throw new HttpError(401, 'Невалиден код.');
        }
        self::completeLogin($user);
    }

    private static function completeLogin(array $user): void
    {
        self::recordAttempt($user['email'], true);
        session_regenerate_id(true);
        $_SESSION['stage'] = 'ok';
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        unset($_SESSION['tries'], $_SESSION['pending_secret']);
        Db::update('users', ['last_login_at' => now()], (int)$user['id']);
        Db::audit((int)$user['id'], 'auth.login');
    }

    public static function enrollStart(): array
    {
        if (self::stage() !== 'enroll') {
            throw new HttpError(400, 'Настройката на 2FA не е достъпна.');
        }
        $user = Db::one('SELECT email FROM users WHERE id = ?', [$_SESSION['uid']]);
        $_SESSION['pending_secret'] = $_SESSION['pending_secret'] ?? Totp::newSecret();
        $issuer = Db::setting('site')['name'] ?? 'ARC Metrologia';
        return [
            'secret' => $_SESSION['pending_secret'],
            'uri' => Totp::uri($_SESSION['pending_secret'], $user['email'], $issuer),
        ];
    }

    /** Потвърждава първия код и връща еднократните резервни кодове (показват се само веднъж). */
    public static function enrollConfirm(string $code): array
    {
        if (self::stage() !== 'enroll' || empty($_SESSION['pending_secret'])) {
            throw new HttpError(400, 'Настройката на 2FA не е започната.');
        }
        $step = Totp::verify($_SESSION['pending_secret'], preg_replace('/\s+/', '', $code));
        if ($step === null) {
            throw new HttpError(400, 'Кодът не съвпада. Проверете часовника на телефона и опитайте пак.');
        }
        [$plain, $hashes] = self::makeRecoveryCodes();
        $uid = (int)$_SESSION['uid'];
        Db::update('users', [
            'totp_secret' => Crypto::encrypt($_SESSION['pending_secret']),
            'totp_enabled' => 1,
            'totp_last_step' => $step,
            'recovery_codes' => json_encode($hashes),
        ], $uid);
        Db::audit($uid, 'auth.2fa_enrolled');
        self::completeLogin(Db::one('SELECT * FROM users WHERE id = ?', [$uid]));
        return $plain;
    }

    public static function makeRecoveryCodes(): array
    {
        $plain = [];
        $hashes = [];
        for ($i = 0; $i < 10; $i++) {
            $c = bin2hex(random_bytes(4)) . '-' . bin2hex(random_bytes(4));
            $plain[] = $c;
            $hashes[] = password_hash($c, PASSWORD_DEFAULT);
        }
        return [$plain, $hashes];
    }

    public static function validatePassword(string $pw): void
    {
        if (mb_strlen($pw) < 12) {
            throw new HttpError(422, 'Паролата трябва да е поне 12 символа.');
        }
    }
}
