<?php
declare(strict_types=1);

final class HttpError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

final class Http
{
    public static function isHttps(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
            || ($_SERVER['SERVER_PORT'] ?? '') === '443';
    }

    public static function ip(): string
    {
        return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
    }

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function body(): array
    {
        static $body = null;
        if ($body === null) {
            $raw = file_get_contents('php://input') ?: '';
            $body = $raw === '' ? [] : json_decode($raw, true);
            if (!is_array($body)) {
                throw new HttpError(400, 'Невалиден JSON.');
            }
        }
        return $body;
    }

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /** Произход на вътрешния сравнител (config 'comparator_url') за CSP — само в админ панела. */
    private static function comparatorOrigin(): string
    {
        $url = (string)config('comparator_url', '');
        $p = parse_url($url);
        return isset($p['scheme'], $p['host']) && $p['scheme'] === 'https' ? " https://{$p['host']}" : '';
    }

    /** Заглавки за сигурност за всички отговори. */
    public static function securityHeaders(bool $isAdmin = false): void
    {
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        header('X-Frame-Options: ' . ($isAdmin ? 'DENY' : 'SAMEORIGIN'));
        if (self::isHttps()) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
        $csp = implode('; ', [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://i.ytimg.com https://i.vimeocdn.com",
            "media-src 'self'",
            "font-src 'self'",
            // Админът вгражда страниците на сайта за визуалния редактор и прегледа на цветовете.
            "frame-src https://www.youtube-nocookie.com https://player.vimeo.com" . ($isAdmin ? " 'self'" . self::comparatorOrigin() : ''),
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors " . ($isAdmin ? "'none'" : "'self'"),
        ]);
        header("Content-Security-Policy: $csp");
    }
}
