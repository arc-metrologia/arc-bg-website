<?php
declare(strict_types=1);

/** Мета тагове, structured data (schema.org JSON-LD), sitemap.xml, robots.txt, llms.txt. */
final class Seo
{
    public static function mdUrl(string $lang, string $path): string
    {
        $u = Content::url($lang, $path);
        return str_ends_with($u, '/') ? $u . 'index.md' : $u . '.md';
    }

    public static function title(array $page, array $site): string
    {
        $name = self::siteName($site);
        if ($page['metaTitle']) {
            return $page['metaTitle'];
        }
        return $page['path'] === '' ? $name . ' — ' . ($site['info']['tagline'][$page['lang']] ?? '') : $page['title'] . ' | ' . $name;
    }

    public static function siteName(array $site): string
    {
        return $site['lang'] === 'en' ? ($site['info']['nameEn'] ?? $site['info']['name'] ?? '') : ($site['info']['name'] ?? '');
    }

    private static function description(array $page): string
    {
        return $page['metaDescription'] ?: $page['excerpt'];
    }

    private static function shareImage(array $payload): ?array
    {
        $media = (array)$payload['media'];
        $id = $payload['page']['image'];
        if (!$id) {
            foreach ($payload['page']['blocks'] as $b) {
                if (in_array($b['type'], ['hero', 'image'], true) && !empty($b['image'])) {
                    $id = $b['image'];
                    break;
                }
            }
        }
        return $id ? ($media[$id] ?? null) : null;
    }

    public static function head(?array $payload, array $site): string
    {
        $base = base_url();
        if (!$payload) {
            return '<title>' . e(Render::UI[$site['lang']]['notFound'] . ' | ' . self::siteName($site)) . '</title><meta name="robots" content="noindex">';
        }
        $page = $payload['page'];
        $url = $base . $page['url'];
        $desc = self::description($page);
        $img = self::shareImage($payload);
        $h = [];
        $h[] = '<title>' . e(self::title($page, $site)) . '</title>';
        $h[] = '<meta name="description" content="' . e($desc) . '">';
        $h[] = '<link rel="canonical" href="' . e($url) . '">';
        if ($page['status'] !== 'published') {
            $h[] = '<meta name="robots" content="noindex, nofollow">';
        } else {
            $h[] = '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">';
        }
        foreach ((array)$payload['alternates'] as $lang => $alt) {
            $h[] = '<link rel="alternate" hreflang="' . e($lang) . '" href="' . e($base . $alt) . '">';
            if ($lang === config('default_lang')) {
                $h[] = '<link rel="alternate" hreflang="x-default" href="' . e($base . $alt) . '">';
            }
        }
        $h[] = '<link rel="alternate" type="text/markdown" title="Markdown" href="' . e($base . self::mdUrl($page['lang'], $page['path'])) . '">';
        $og = [
            'og:type' => $page['type'] === 'post' ? 'article' : 'website',
            'og:site_name' => self::siteName($site),
            'og:title' => $page['metaTitle'] ?: $page['title'],
            'og:description' => $desc,
            'og:url' => $url,
            'og:locale' => $page['lang'] === 'en' ? 'en_GB' : 'bg_BG',
        ];
        if ($img) {
            $og['og:image'] = $base . $img['url'];
            $og['og:image:alt'] = $img['alt'];
        }
        foreach ($og as $k => $v) {
            $h[] = '<meta property="' . $k . '" content="' . e((string)$v) . '">';
        }
        $h[] = '<meta name="twitter:card" content="' . ($img ? 'summary_large_image' : 'summary') . '">';
        if ($page['type'] === 'post' && $page['publishedAt']) {
            $h[] = '<meta property="article:published_time" content="' . e(date('c', strtotime($page['publishedAt']))) . '">';
            $h[] = '<meta property="article:modified_time" content="' . e(date('c', strtotime($page['updatedAt']))) . '">';
        }
        $h[] = '<script type="application/ld+json">' . self::json(self::jsonLd($payload, $site)) . '</script>';
        return implode("\n", $h);
    }

    /** JSON в <script> — защитено срещу </script> и HTML коментари. */
    public static function json(mixed $data): string
    {
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
    }

    public static function organization(array $site): array
    {
        $i = $site['info'];
        $base = base_url();
        $lang = $site['lang'];
        return [
            '@type' => ['Organization', 'LocalBusiness'],
            '@id' => $base . '/#organization',
            'name' => self::siteName($site),
            'legalName' => $i['legalName'] ?? null,
            'alternateName' => $lang === 'en' ? ($i['name'] ?? null) : ($i['nameEn'] ?? null),
            'url' => $base . '/',
            'logo' => $base . '/logo-arc.svg',
            'image' => $base . '/logo-arc.svg',
            'description' => $i['description'][$lang] ?? null,
            'telephone' => $i['phone'] ?? null,
            'email' => $i['email'] ?? null,
            'address' => [
                '@type' => 'PostalAddress',
                'streetAddress' => $i['postal']['street'][$lang] ?? null,
                'addressLocality' => $i['postal']['city'][$lang] ?? null,
                'postalCode' => $i['postal']['postalCode'] ?? null,
                'addressCountry' => $i['postal']['country'] ?? 'BG',
            ],
            'areaServed' => ['@type' => 'Country', 'name' => $lang === 'en' ? 'Bulgaria' : 'България'],
            'knowsAbout' => $i['knowsAbout'][$lang] ?? null,
            'brand' => array_map(fn($b) => ['@type' => 'Brand', 'name' => $b], $i['brands'] ?? []),
            'sameAs' => array_column($i['social'] ?? [], 'url'),
        ];
    }

    public static function jsonLd(array $payload, array $site): array
    {
        $base = base_url();
        $p = $payload['page'];
        $url = $base . $p['url'];
        $media = (array)$payload['media'];
        $img = self::shareImage($payload);
        $graph = [self::organization($site)];
        $graph[] = [
            '@type' => 'WebSite',
            '@id' => $base . '/#website',
            'url' => $base . '/',
            'name' => self::siteName($site),
            'inLanguage' => $p['lang'],
            'publisher' => ['@id' => $base . '/#organization'],
        ];
        $pageType = match ($p['type']) {
            'category' => 'CollectionPage',
            default => $p['path'] === '' ? 'WebPage' : (str_contains($p['path'], 'kontakti') || str_contains($p['path'], 'contact') ? 'ContactPage' : 'WebPage'),
        };
        $graph[] = array_filter([
            '@type' => $pageType,
            '@id' => $url . '#webpage',
            'url' => $url,
            'name' => $p['title'],
            'description' => self::description($p),
            'inLanguage' => $p['lang'],
            'isPartOf' => ['@id' => $base . '/#website'],
            'dateModified' => $p['updatedAt'] ? date('c', strtotime($p['updatedAt'])) : null,
            'primaryImageOfPage' => $img ? $base . $img['url'] : null,
            'breadcrumb' => count($payload['breadcrumbs']) > 1 ? ['@id' => $url . '#breadcrumb'] : null,
        ]);
        if (count($payload['breadcrumbs']) > 1) {
            $graph[] = [
                '@type' => 'BreadcrumbList',
                '@id' => $url . '#breadcrumb',
                'itemListElement' => array_map(fn($c, $i) => [
                    '@type' => 'ListItem', 'position' => $i + 1, 'name' => $c['title'], 'item' => $base . $c['url'],
                ], $payload['breadcrumbs'], array_keys($payload['breadcrumbs'])),
            ];
        }
        $main = match ($p['type']) {
            'product' => array_filter([
                '@type' => 'Product',
                'name' => $p['title'],
                'description' => self::description($p),
                'image' => $img ? $base . $img['url'] : null,
                'brand' => !empty(((array)$p['extra'])['brand']) ? ['@type' => 'Brand', 'name' => ((array)$p['extra'])['brand']] : null,
                'category' => $payload['breadcrumbs'][count($payload['breadcrumbs']) - 2]['title'] ?? null,
                'additionalProperty' => self::specs($p['blocks']),
                'url' => $url,
            ]),
            'service' => array_filter([
                '@type' => 'Service',
                'name' => $p['title'],
                'description' => self::description($p),
                'provider' => ['@id' => $base . '/#organization'],
                'areaServed' => ['@type' => 'Country', 'name' => 'Bulgaria'],
                'url' => $url,
            ]),
            'post' => array_filter([
                '@type' => 'BlogPosting',
                'headline' => $p['title'],
                'description' => self::description($p),
                'image' => $img ? $base . $img['url'] : null,
                'datePublished' => $p['publishedAt'] ? date('c', strtotime($p['publishedAt'])) : null,
                'dateModified' => $p['updatedAt'] ? date('c', strtotime($p['updatedAt'])) : null,
                'author' => ['@id' => $base . '/#organization'],
                'publisher' => ['@id' => $base . '/#organization'],
                'mainEntityOfPage' => ['@id' => $url . '#webpage'],
                'inLanguage' => $p['lang'],
            ]),
            default => null,
        };
        if ($main) {
            $graph[] = $main;
        }
        $faq = [];
        foreach ($p['blocks'] as $b) {
            if ($b['type'] === 'faq') {
                foreach ($b['items'] as $it) {
                    $faq[] = ['@type' => 'Question', 'name' => $it['q'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $it['a']]];
                }
            }
            if ($b['type'] === 'video' && $b['provider'] === 'youtube' && $b['videoId']) {
                $graph[] = [
                    '@type' => 'VideoObject',
                    'name' => $b['heading'] ?: ($b['caption'] ?: $p['title']),
                    'description' => $b['caption'] ?: self::description($p),
                    'thumbnailUrl' => 'https://i.ytimg.com/vi/' . $b['videoId'] . '/hqdefault.jpg',
                    'embedUrl' => 'https://www.youtube-nocookie.com/embed/' . $b['videoId'],
                    'contentUrl' => 'https://www.youtube.com/watch?v=' . $b['videoId'],
                    'uploadDate' => date('c', strtotime($p['publishedAt'] ?? $p['updatedAt'] ?? 'now')),
                ];
            }
        }
        if ($faq) {
            $graph[] = ['@type' => 'FAQPage', '@id' => $url . '#faq', 'mainEntity' => $faq];
        }
        return ['@context' => 'https://schema.org', '@graph' => $graph];
    }

    private static function specs(array $blocks): ?array
    {
        $props = [];
        foreach ($blocks as $b) {
            if ($b['type'] === 'specs') {
                foreach ($b['rows'] as $r) {
                    $props[] = ['@type' => 'PropertyValue', 'name' => $r['label'], 'value' => $r['value']];
                }
            }
        }
        return $props ?: null;
    }

    // ---------------------------------------------------------------- crawl файлове

    private static function published(): array
    {
        return Db::all("SELECT * FROM pages WHERE status = 'published' ORDER BY lang, path");
    }

    public static function sitemap(): string
    {
        $base = base_url();
        $rows = self::published();
        $byKey = [];
        foreach ($rows as $r) {
            if ($r['translation_key']) {
                $byKey[$r['translation_key']][$r['lang']] = Content::url($r['lang'], $r['path']);
            }
        }
        $x = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
        foreach ($rows as $r) {
            $x .= '<url><loc>' . e($base . Content::url($r['lang'], $r['path'])) . '</loc>';
            $x .= '<lastmod>' . date('Y-m-d', strtotime($r['updated_at'])) . '</lastmod>';
            foreach ($byKey[$r['translation_key']] ?? [] as $l => $u) {
                $x .= '<xhtml:link rel="alternate" hreflang="' . $l . '" href="' . e($base . $u) . '"/>';
            }
            if ($r['image_id'] && ($m = Db::one('SELECT path FROM media WHERE id = ?', [$r['image_id']]))) {
                $x .= '<image:image><image:loc>' . e($base . $m['path']) . '</image:loc></image:image>';
            }
            $x .= "</url>\n";
        }
        return $x . '</urlset>';
    }

    public static function robots(): string
    {
        $base = base_url();
        // Изрично разрешаваме AI търсачките и асистентите — целта е да цитират сайта.
        $bots = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
            'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'CCBot', 'DuckAssistBot', 'Meta-ExternalAgent'];
        $txt = '';
        foreach ($bots as $b) {
            $txt .= "User-agent: $b\n";
        }
        $txt .= "Allow: /\nDisallow: /admin\nDisallow: /api/\n\n";
        $txt .= "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\n";
        return $txt . "Sitemap: $base/sitemap.xml\n";
    }

    public static function llms(bool $full = false): string
    {
        $base = base_url();
        $site = Content::site('bg');
        $i = $site['info'];
        $out = '# ' . ($i['name'] ?? '') . ' (' . ($i['nameEn'] ?? '') . ")\n\n";
        $out .= '> ' . ($i['description']['bg'] ?? '') . "\n\n";
        $out .= ($i['description']['en'] ?? '') . "\n\n";
        $out .= Markdown::contactInfo('bg');
        $groups = [
            'page' => 'Основни страници', 'category' => 'Категории продукти', 'product' => 'Продукти',
            'service' => 'Услуги', 'post' => 'Блог',
        ];
        foreach (['bg', 'en'] as $lang) {
            $rows = Db::all("SELECT * FROM pages WHERE status = 'published' AND lang = ? ORDER BY type, sort_order, title", [$lang]);
            if (!$rows) {
                continue;
            }
            if ($full) {
                foreach ($rows as $r) {
                    $out .= "\n\n---\n\n" . Markdown::page(Content::payload($r));
                }
                continue;
            }
            $byType = [];
            foreach ($rows as $r) {
                $byType[$r['type']][] = $r;
            }
            foreach ($groups as $type => $label) {
                if (empty($byType[$type])) {
                    continue;
                }
                $out .= '## ' . ($lang === 'en' ? ucfirst($type) . ' (English)' : $label) . "\n\n";
                foreach ($byType[$type] as $r) {
                    $out .= '- [' . $r['title'] . '](' . $base . self::mdUrl($r['lang'], $r['path']) . ')'
                        . (($r['meta_description'] ?: $r['excerpt']) ? ': ' . ($r['meta_description'] ?: $r['excerpt']) : '') . "\n";
                }
                $out .= "\n";
            }
        }
        if (!$full) {
            $out .= "## Optional\n\n- [Пълно съдържание на сайта в един файл]($base/llms-full.txt)\n";
        }
        return $out;
    }
}
