<?php
declare(strict_types=1);

/**
 * Единна входна точка (Apache .htaccess или `php -S` локално).
 *   /api/*                  → JSON API
 *   /sitemap.xml, /robots.txt, /llms.txt, /llms-full.txt
 *   /{път}.md               → Markdown версия на страница (за чатботове)
 *   /admin*                 → административно приложение (noindex)
 *   всичко останало         → публична страница: пълен HTML от сървъра + React
 */

// Локален сървър: статичните файлове се отдават директно.
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (is_file($file) && !str_ends_with($file, '.php') && !str_contains($file, DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR)) {
        return false;
    }
}

require __DIR__ . '/app/bootstrap.php';

/** 301 от стари адреси (Админ → Фирма и меню → Пренасочвания). Разпознава и стария формат /3 → /3-kalibrirane-…. */
function redirect_old_url(string $path): void
{
    $map = Db::setting('redirects', []);
    $key = rtrim($path, '/') ?: '/';
    $target = $map[$key] ?? $map[$path] ?? null;
    if ($target === null && preg_match('~^/(\d+)(?:-|$)~', $key, $m)) {
        foreach ($map as $from => $to) {
            if (str_starts_with($from, "/{$m[1]}-")) {
                $target = $to;
                break;
            }
        }
    }
    if ($target !== null && $target !== $path && Sanitizer::safeUrl($target)) {
        header('Location: ' . $target, true, 301);
        exit;
    }
}

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

try {
    if (str_starts_with($path, '/api/')) {
        Http::securityHeaders(true);
        require APP_DIR . '/api.php';
        api(Http::method(), trim(substr($path, 5), '/'));
    }

    Http::securityHeaders(str_starts_with($path, '/admin'));

    switch ($path) {
        case '/sitemap.xml':
            header('Content-Type: application/xml; charset=utf-8');
            exit(Seo::sitemap());
        case '/robots.txt':
            header('Content-Type: text/plain; charset=utf-8');
            exit(Seo::robots());
        case '/llms.txt':
        case '/llms-full.txt':
            header('Content-Type: text/plain; charset=utf-8');
            exit(Seo::llms($path === '/llms-full.txt'));
    }

    if (str_ends_with($path, '.md')) {
        [$lang, $p] = Content::parseUrl(substr($path, 0, -3));
        $p = preg_replace('~(^|/)index$~', '', $p);
        $row = Content::find($lang, $p);
        if (!$row) {
            http_response_code(404);
            header('Content-Type: text/plain; charset=utf-8');
            exit("Not found\n");
        }
        header('Content-Type: text/markdown; charset=utf-8');
        header('X-Robots-Tag: noindex');
        exit(Markdown::page(Content::payload($row)));
    }

    $template = @file_get_contents(__DIR__ . '/build/index.html');
    if ($template === false) {
        http_response_code(503);
        exit('Frontend build missing: run `npm run build` in /frontend.');
    }

    if (str_starts_with($path, '/admin')) {
        header('X-Robots-Tag: noindex, nofollow');
        header('Cache-Control: no-store');
        $head = '<title>Администрация</title><meta name="robots" content="noindex, nofollow">';
        exit(str_replace(['<!--head-->', '<!--app-->'], [$head, ''], $template));
    }

    // Публична страница. Редакторите (влезли с 2FA) виждат и чернови.
    [$lang, $p] = Content::parseUrl($uri);
    $editor = false;
    if (Auth::hasSessionCookie()) {
        Auth::start();
        $editor = Auth::can(Auth::user(), 'posts');
    }
    $row = Content::find($lang, $p, $editor);
    if (!$row) {
        redirect_old_url($path);
    }
    $site = Content::site($lang);
    $payload = $row ? Content::payload($row) : null;
    if (!$row) {
        http_response_code(404);
    }
    if ($editor) {
        header('Cache-Control: no-store');
    }

    $data = ($payload ?? ['page' => null]) + ['site' => $site, 'editor' => $editor];
    $html = str_replace(
        ['<html lang="bg">', '<!--head-->', '<!--app-->', '<!--data-->'],
        [
            '<html lang="' . e($lang) . '">',
            Seo::head($payload, $site),
            Render::body($payload, $site),
            '<script id="__DATA__" type="application/json">' . Seo::json($data) . '</script>',
        ],
        $template
    );
    echo $html;
} catch (HttpError $e) {
    if (str_starts_with($path, '/api/')) {
        Http::json(['error' => $e->getMessage()], $e->status);
    }
    http_response_code($e->status);
    echo e($e->getMessage());
} catch (Throwable $e) {
    error_log((string)$e);
    $msg = config('env') === 'development' ? $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() : 'Вътрешна грешка на сървъра.';
    if (str_starts_with($path, '/api/')) {
        Http::json(['error' => $msg], 500);
    }
    http_response_code(500);
    echo e($msg);
}
