<?php
declare(strict_types=1);

/**
 * Страници от всички типове: page, category, product, service, post.
 * Йерархията е в пътя: 'produkti/tesa' е дете на 'produkti'.
 * URL: български — /{path}, английски — /en/{path}.
 */
final class Content
{
    public const TYPES = ['page', 'category', 'product', 'service', 'post'];

    public static function url(string $lang, string $path): string
    {
        $prefix = $lang === config('default_lang', 'bg') ? '' : "/$lang";
        return $path === '' ? ($prefix ?: '/') . ($prefix ? '/' : '') : "$prefix/$path";
    }

    /** '/en/services/calibration' → ['en', 'services/calibration'] */
    public static function parseUrl(string $uri): array
    {
        $path = trim(rawurldecode(parse_url($uri, PHP_URL_PATH) ?: '/'), '/');
        $parts = $path === '' ? [] : explode('/', $path);
        $lang = config('default_lang', 'bg');
        if ($parts && in_array($parts[0], config('languages', ['bg']), true) && $parts[0] !== $lang) {
            $lang = array_shift($parts);
        }
        return [$lang, implode('/', $parts)];
    }

    public static function validPath(string $path): bool
    {
        return $path === '' || (bool)preg_match('~^[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$~', $path);
    }

    public static function find(string $lang, string $path, bool $drafts = false): ?array
    {
        $sql = 'SELECT * FROM pages WHERE lang = ? AND path = ?' . ($drafts ? '' : " AND status = 'published'");
        return Db::one($sql, [$lang, $path]);
    }

    public static function view(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'type' => $row['type'],
            'lang' => $row['lang'],
            'path' => $row['path'],
            'url' => self::url($row['lang'], $row['path']),
            'translationKey' => $row['translation_key'],
            'title' => $row['title'],
            'metaTitle' => $row['meta_title'],
            'metaDescription' => $row['meta_description'],
            'excerpt' => $row['excerpt'],
            'image' => $row['image_id'] ? (int)$row['image_id'] : null,
            'blocks' => json_decode($row['blocks'] ?: '[]', true),
            'related' => json_decode($row['related'] ?: '[]', true),
            'extra' => json_decode($row['extra'] ?: '{}', true) ?: new stdClass(),
            'status' => $row['status'],
            'sortOrder' => (int)$row['sort_order'],
            'publishedAt' => $row['published_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    private static function card(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'type' => $row['type'],
            'title' => $row['title'],
            'url' => self::url($row['lang'], $row['path']),
            'excerpt' => $row['excerpt'],
            'image' => $row['image_id'] ? (int)$row['image_id'] : null,
            'publishedAt' => $row['published_at'],
        ];
    }

    public static function listing(array $page, array $block): array
    {
        $lang = $page['lang'];
        $limit = (int)($block['limit'] ?? 0);
        $lim = $limit > 0 ? " LIMIT $limit" : '';
        if ($block['type'] === 'carousel' && ($block['source'] ?? '') === 'manual') {
            return self::cardsByIds($block['pages'] ?? []);
        }
        $rows = match ($block['source'] ?? 'children') {
            'latest' => Db::all("SELECT * FROM pages WHERE lang = ? AND type IN ('post', 'product') AND status = 'published' ORDER BY published_at DESC, sort_order$lim", [$lang]),
            'posts' => Db::all("SELECT * FROM pages WHERE lang = ? AND type = 'post' AND status = 'published' ORDER BY published_at DESC$lim", [$lang]),
            'products' => Db::all("SELECT * FROM pages WHERE lang = ? AND type = 'product' AND status = 'published' ORDER BY sort_order, title$lim", [$lang]),
            'services' => Db::all("SELECT * FROM pages WHERE lang = ? AND type = 'service' AND status = 'published' ORDER BY sort_order, title$lim", [$lang]),
            default => $page['path'] === ''
                ? []
                : Db::all(
                    "SELECT * FROM pages WHERE lang = ? AND status = 'published' AND path LIKE ? AND path NOT LIKE ? ORDER BY sort_order, title$lim",
                    [$lang, $page['path'] . '/%', $page['path'] . '/%/%']
                ),
        };
        return array_map([self::class, 'card'], $rows);
    }

    /** Публикувани страници като карти, в реда на подадените id-та. */
    private static function cardsByIds(array $ids): array
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        if (!$ids) {
            return [];
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        $byId = [];
        foreach (Db::all("SELECT * FROM pages WHERE status = 'published' AND id IN ($in)", $ids) as $r) {
            $byId[(int)$r['id']] = self::card($r);
        }
        return array_values(array_filter(array_map(fn($id) => $byId[$id] ?? null, $ids)));
    }

    public static function breadcrumbs(array $page): array
    {
        $crumbs = [];
        $home = self::find($page['lang'], '');
        $crumbs[] = ['title' => $home['title'] ?? 'Начало', 'url' => self::url($page['lang'], '')];
        if ($page['path'] === '') {
            return $crumbs;
        }
        $segments = explode('/', $page['path']);
        $acc = [];
        foreach ($segments as $seg) {
            $acc[] = $seg;
            $p = implode('/', $acc);
            $row = $p === $page['path'] ? $page : self::find($page['lang'], $p);
            if ($row) {
                $crumbs[] = ['title' => $row['title'], 'url' => self::url($page['lang'], $p)];
            }
        }
        return $crumbs;
    }

    public static function alternates(array $page): array
    {
        if (!$page['translation_key']) {
            return [];
        }
        $rows = Db::all(
            "SELECT lang, path FROM pages WHERE translation_key = ? AND status = 'published'",
            [$page['translation_key']]
        );
        $out = [];
        foreach ($rows as $r) {
            $out[$r['lang']] = self::url($r['lang'], $r['path']);
        }
        return $out;
    }

    /** Всичко нужно на React (и на PHP рендера) за показване на една страница. */
    public static function payload(array $row): array
    {
        $page = self::view($row);
        $mediaIds = [$page['image']];
        $listings = [];
        foreach ($page['blocks'] as $b) {
            array_push($mediaIds, $b['image'] ?? null, $b['media'] ?? null, $b['poster'] ?? null, ...($b['images'] ?? []), ...($b['files'] ?? []));
            if ($b['type'] === 'listing' || $b['type'] === 'carousel') {
                $listings[$b['id']] = self::listing($row, $b);
                array_push($mediaIds, ...array_column($listings[$b['id']], 'image'));
            }
        }
        $related = self::cardsByIds($page['related']);
        array_push($mediaIds, ...array_column($related, 'image'));
        return [
            'page' => $page,
            'media' => (object)Media::many($mediaIds, $row['lang']),
            'listings' => (object)$listings,
            'related' => $related,
            'breadcrumbs' => self::breadcrumbs($row),
            'alternates' => (object)self::alternates($row),
        ];
    }

    public static function site(string $lang): array
    {
        return [
            'lang' => $lang,
            'languages' => config('languages', ['bg']),
            'info' => Db::setting('site', []),
            'nav' => Db::setting("nav_$lang", []),
            'footer' => Db::setting("footer_$lang", []),
        ];
    }

    // ---------------------------------------------------------------- запис

    public static function save(?int $id, array $in, array $user): array
    {
        $existing = $id ? Db::one('SELECT * FROM pages WHERE id = ?', [$id]) : null;
        if ($id && !$existing) {
            throw new HttpError(404, 'Страницата не е намерена.');
        }
        $type = $in['type'] ?? $existing['type'] ?? 'page';
        if (!in_array($type, self::TYPES, true)) {
            throw new HttpError(422, 'Невалиден тип съдържание.');
        }
        $perm = $type === 'post' ? 'posts' : 'content';
        if (!Auth::can($user, $perm) || ($existing && $existing['type'] !== 'post' && !Auth::can($user, 'content'))) {
            throw new HttpError(403, 'Нямате права да редактирате този тип съдържание.');
        }

        $lang = $in['lang'] ?? $existing['lang'] ?? config('default_lang');
        if (!in_array($lang, config('languages'), true)) {
            throw new HttpError(422, 'Невалиден език.');
        }
        $path = trim(mb_strtolower((string)($in['path'] ?? $existing['path'] ?? '')), '/');
        if (!self::validPath($path)) {
            throw new HttpError(422, 'Адресът може да съдържа само малки латински букви, цифри, тирета и „/“.');
        }
        $dup = Db::val('SELECT id FROM pages WHERE lang = ? AND path = ? AND id <> ?', [$lang, $path, $id ?? 0]);
        if ($dup) {
            throw new HttpError(409, 'Вече има страница с този адрес.');
        }
        $title = Sanitizer::text($in['title'] ?? $existing['title'] ?? '', 250);
        if ($title === '') {
            throw new HttpError(422, 'Заглавието е задължително.');
        }

        $status = in_array($in['status'] ?? '', ['draft', 'published'], true) ? $in['status'] : ($existing['status'] ?? 'draft');
        if ($status === 'published' && !Auth::can($user, 'publish') && ($existing['status'] ?? 'draft') !== 'published') {
            $status = 'draft';
        }

        $data = [
            'type' => $type,
            'lang' => $lang,
            'path' => $path,
            'translation_key' => Sanitizer::text($in['translationKey'] ?? $existing['translation_key'] ?? '', 100) ?: null,
            'title' => $title,
            'meta_title' => Sanitizer::text($in['metaTitle'] ?? $existing['meta_title'] ?? '', 200),
            'meta_description' => Sanitizer::text($in['metaDescription'] ?? $existing['meta_description'] ?? '', 400),
            'excerpt' => Sanitizer::text($in['excerpt'] ?? $existing['excerpt'] ?? '', 1000),
            'image_id' => array_key_exists('image', $in) ? ((int)$in['image'] ?: null) : ($existing['image_id'] ?? null),
            'blocks' => json_encode(
                array_key_exists('blocks', $in) ? Sanitizer::blocks($in['blocks']) : json_decode($existing['blocks'] ?? '[]', true),
                JSON_UNESCAPED_UNICODE
            ),
            'related' => json_encode(array_key_exists('related', $in) ? Sanitizer::ids($in['related']) : json_decode($existing['related'] ?? '[]', true)),
            'extra' => json_encode(
                array_key_exists('extra', $in) && is_array($in['extra'])
                    ? array_map(fn($v) => Sanitizer::text($v, 300), array_slice($in['extra'], 0, 20, true))
                    : json_decode($existing['extra'] ?? '{}', true),
                JSON_UNESCAPED_UNICODE
            ),
            'status' => $status,
            'sort_order' => (int)($in['sortOrder'] ?? $existing['sort_order'] ?? 0),
            'updated_at' => now(),
            'updated_by' => $user['id'],
        ];
        if ($status === 'published' && empty($existing['published_at'])) {
            $data['published_at'] = now();
        }

        if ($existing) {
            Db::insert('revisions', ['page_id' => $id, 'data' => json_encode($existing, JSON_UNESCAPED_UNICODE), 'user_id' => $user['id'], 'created_at' => now()]);
            Db::update('pages', $data, $id);
            // Пазим последните 30 версии на страница
            $keep = Db::all('SELECT id FROM revisions WHERE page_id = ? ORDER BY id DESC LIMIT 30', [$id]);
            if (count($keep) === 30) {
                Db::run('DELETE FROM revisions WHERE page_id = ? AND id < ?', [$id, end($keep)['id']]);
            }
            Db::audit($user['id'], 'page.update', self::url($lang, $path));
        } else {
            $data['created_at'] = now();
            $data['author_id'] = $user['id'];
            $id = Db::insert('pages', $data);
            Db::audit($user['id'], 'page.create', self::url($lang, $path));
        }
        return self::view(Db::one('SELECT * FROM pages WHERE id = ?', [$id]));
    }
}
