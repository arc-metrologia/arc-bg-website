<?php
declare(strict_types=1);

/** Allowlist почистване на HTML от редактора и валидиране на блоковете на страниците. */
final class Sanitizer
{
    private const TAGS = [
        'p' => [], 'br' => [], 'h2' => ['id'], 'h3' => ['id'], 'h4' => [],
        'strong' => [], 'em' => [], 'b' => [], 'i' => [], 'u' => [], 's' => [], 'sup' => [], 'sub' => [],
        'code' => [], 'pre' => [], 'blockquote' => [], 'hr' => [],
        'ul' => [], 'ol' => ['start'], 'li' => [],
        'a' => ['href', 'title', 'target', 'rel'],
        'table' => [], 'thead' => [], 'tbody' => [], 'tr' => [], 'colgroup' => [], 'col' => [],
        'th' => ['colspan', 'rowspan', 'scope'], 'td' => ['colspan', 'rowspan'],
        'figure' => [], 'figcaption' => [], 'img' => ['src', 'alt', 'width', 'height'],
    ];

    private const DROP = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input',
        'button', 'textarea', 'select', 'template', 'noscript', 'link', 'meta', 'base'];

    public static function html(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }
        $doc = new DOMDocument('1.0', 'UTF-8');
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8"><div id="__root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = (new DOMXPath($doc))->query('//div[@id="__root"]')->item(0);
        if (!$root) {
            return '';
        }
        self::clean($root);
        $out = '';
        foreach ($root->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }
        return trim($out);
    }

    private static function clean(DOMNode $node): void
    {
        for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
            $c = $node->childNodes->item($i);
            if ($c instanceof DOMText) {
                continue;
            }
            if (!$c instanceof DOMElement) {
                $node->removeChild($c);
                continue;
            }
            $tag = strtolower($c->tagName);
            if (in_array($tag, self::DROP, true)) {
                $node->removeChild($c);
                continue;
            }
            self::clean($c);
            if (!isset(self::TAGS[$tag])) {
                while ($c->firstChild) {
                    $node->insertBefore($c->firstChild, $c);
                }
                $node->removeChild($c);
                continue;
            }
            foreach (iterator_to_array($c->attributes) as $attr) {
                if (!in_array(strtolower($attr->name), self::TAGS[$tag], true)) {
                    $c->removeAttribute($attr->name);
                }
            }
            if ($tag === 'a') {
                if (!self::safeUrl($c->getAttribute('href'))) {
                    $c->removeAttribute('href');
                }
                if ($c->getAttribute('target') === '_blank') {
                    $c->setAttribute('rel', 'noopener noreferrer');
                } else {
                    $c->removeAttribute('target');
                }
            }
            if ($tag === 'img' && !str_starts_with($c->getAttribute('src'), '/uploads/')) {
                $node->removeChild($c);
            }
        }
    }

    public static function safeUrl(?string $url): bool
    {
        return (bool)preg_match('~^(https?://|mailto:|tel:|/(?!/)|#)~i', trim((string)$url));
    }

    public static function text(mixed $v, int $max = 5000): string
    {
        $s = is_scalar($v) ? (string)$v : '';
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
        return mb_substr(trim($s), 0, $max);
    }

    public static function url(mixed $v): string
    {
        $s = self::text($v, 1000);
        return $s === '' || self::safeUrl($s) ? $s : '';
    }

    public static function ids(mixed $v): array
    {
        return is_array($v) ? array_values(array_filter(array_map('intval', $v), fn($x) => $x > 0)) : [];
    }

    // ---------------------------------------------------------------- блокове

    public const BLOCK_TYPES = ['hero', 'richtext', 'image', 'gallery', 'video', 'features', 'steps', 'faq',
        'specs', 'cta', 'listing', 'testimonials', 'logos', 'contact', 'downloads'];

    /** Нормализира масив от блокове: само познати типове и полета, почистен HTML и URL-и. */
    public static function blocks(mixed $blocks): array
    {
        if (!is_array($blocks)) {
            return [];
        }
        $out = [];
        foreach (array_slice($blocks, 0, 200) as $b) {
            if (!is_array($b) || !in_array($b['type'] ?? '', self::BLOCK_TYPES, true)) {
                continue;
            }
            $out[] = self::block($b);
        }
        return $out;
    }

    private static function items(mixed $items, array $fields): array
    {
        if (!is_array($items)) {
            return [];
        }
        $out = [];
        foreach (array_slice($items, 0, 100) as $it) {
            if (!is_array($it)) {
                continue;
            }
            $row = [];
            foreach ($fields as $f => $kind) {
                $row[$f] = match ($kind) {
                    'html' => self::html((string)($it[$f] ?? '')),
                    'url' => self::url($it[$f] ?? ''),
                    'id' => (int)($it[$f] ?? 0) ?: null,
                    default => self::text($it[$f] ?? '', 2000),
                };
            }
            $out[] = $row;
        }
        return $out;
    }

    private static function block(array $b): array
    {
        $t = $b['type'];
        $id = preg_match('/^[a-z0-9-]{4,40}$/i', (string)($b['id'] ?? '')) ? $b['id'] : bin2hex(random_bytes(6));
        $base = ['id' => $id, 'type' => $t, 'heading' => self::text($b['heading'] ?? '', 300)];
        return $base + match ($t) {
            'hero' => [
                'text' => self::text($b['text'] ?? '', 1000),
                'image' => (int)($b['image'] ?? 0) ?: null,
                'measure' => self::text($b['measure'] ?? '', 60),
                'ctaLabel' => self::text($b['ctaLabel'] ?? '', 80),
                'ctaUrl' => self::url($b['ctaUrl'] ?? ''),
            ],
            'richtext' => ['html' => self::html((string)($b['html'] ?? ''))],
            'image' => ['image' => (int)($b['image'] ?? 0) ?: null, 'caption' => self::text($b['caption'] ?? '', 500)],
            'gallery', 'logos' => ['images' => self::ids($b['images'] ?? [])],
            'downloads' => ['files' => self::ids($b['files'] ?? [])],
            'video' => [
                'provider' => in_array($b['provider'] ?? '', ['youtube', 'vimeo', 'file'], true) ? $b['provider'] : 'youtube',
                'videoId' => preg_replace('/[^A-Za-z0-9_-]/', '', (string)($b['videoId'] ?? '')),
                'media' => (int)($b['media'] ?? 0) ?: null,
                'poster' => (int)($b['poster'] ?? 0) ?: null,
                'caption' => self::text($b['caption'] ?? '', 500),
            ],
            'features' => ['intro' => self::text($b['intro'] ?? '', 1000), 'items' => self::items($b['items'] ?? [], ['title' => 'text', 'text' => 'text'])],
            'steps' => ['items' => self::items($b['items'] ?? [], ['title' => 'text', 'text' => 'text'])],
            'faq' => ['items' => self::items($b['items'] ?? [], ['q' => 'text', 'a' => 'text'])],
            'specs' => ['rows' => self::items($b['rows'] ?? [], ['label' => 'text', 'value' => 'text'])],
            'cta' => ['text' => self::text($b['text'] ?? '', 1000), 'label' => self::text($b['label'] ?? '', 80), 'url' => self::url($b['url'] ?? '')],
            'listing' => [
                'source' => in_array($b['source'] ?? '', ['children', 'posts', 'products', 'services'], true) ? $b['source'] : 'children',
                'limit' => max(0, min(48, (int)($b['limit'] ?? 0))),
            ],
            'testimonials' => ['items' => self::items($b['items'] ?? [], ['quote' => 'text', 'author' => 'text', 'company' => 'text'])],
            'contact' => ['text' => self::text($b['text'] ?? '', 1000)],
        };
    }
}
