<?php
declare(strict_types=1);

define('APP_DIR', __DIR__);
define('WEB_DIR', dirname(__DIR__));

date_default_timezone_set('Europe/Sofia');
mb_internal_encoding('UTF-8');

function config(?string $key = null, mixed $default = null): mixed
{
    static $cfg = null;
    if ($cfg === null) {
        $candidates = [dirname(WEB_DIR) . '/arc-config.php', APP_DIR . '/config.php'];
        foreach ($candidates as $file) {
            if (is_file($file)) {
                $cfg = require $file;
                break;
            }
        }
        if ($cfg === null) {
            http_response_code(500);
            exit('Missing configuration. Copy app/config.sample.php to app/config.php.');
        }
    }
    return $key === null ? $cfg : ($cfg[$key] ?? $default);
}

$dev = config('env') === 'development';
error_reporting(E_ALL);
ini_set('display_errors', $dev ? '1' : '0');
ini_set('log_errors', '1');

foreach (['Db', 'Http', 'Crypto', 'Totp', 'Auth', 'Sanitizer', 'Media', 'Content', 'Render', 'Markdown', 'Seo'] as $lib) {
    require_once APP_DIR . "/lib/$lib.php";
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

function e(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
}

function base_url(): string
{
    if (config('env') === 'development') {
        $scheme = Http::isHttps() ? 'https' : 'http';
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }
    return rtrim((string)config('base_url'), '/');
}
