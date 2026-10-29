<?php
declare(strict_types=1);

/**
 * Сървърен HTML на страниците — за търсачки и AI ботове, които не изпълняват JavaScript.
 * Класовете съвпадат с React компонентите, затова страницата изглежда еднакво преди и след зареждане на JS.
 */
final class Render
{
    private static array $p;
    private static array $site;

    public const UI = [
        'bg' => ['home' => 'Начало', 'related' => 'Свързани продукти и услуги', 'published' => 'Публикувано', 'phone' => 'Телефон',
            'email' => 'Имейл', 'address' => 'Адрес', 'skip' => 'Към съдържанието', 'menu' => 'Основно меню', 'crumbs' => 'Навигационна пътека',
            'rights' => 'Всички права запазени.', 'download' => 'Изтегляне', 'watch' => 'Гледайте видеото', 'notFound' => 'Страницата не е намерена',
            'notFoundText' => 'Адресът може да е променен. Опитайте от началната страница или ни се обадете.'],
        'en' => ['home' => 'Home', 'related' => 'Related products and services', 'published' => 'Published', 'phone' => 'Phone',
            'email' => 'Email', 'address' => 'Address', 'skip' => 'Skip to content', 'menu' => 'Main menu', 'crumbs' => 'Breadcrumb',
            'rights' => 'All rights reserved.', 'download' => 'Download', 'watch' => 'Watch the video', 'notFound' => 'Page not found',
            'notFoundText' => 'The address may have changed. Start from the home page or give us a call.'],
    ];

    private static function t(string $k): string
    {
        return self::UI[self::$site['lang']][$k] ?? self::UI['bg'][$k];
    }

    public static function body(?array $payload, array $site): string
    {
        self::$site = $site;
        $out = '<a class="skip" href="#main">' . e(self::t('skip')) . '</a>' . self::header();
        $out .= '<main id="main">';
        if ($payload) {
            self::$p = $payload;
            $out .= self::page();
        } else {
            $out .= '<header class="page-head"><div class="wrap"><h1>' . e(self::t('notFound')) . '</h1><p class="lede">' . e(self::t('notFoundText')) . '</p></div></header>';
        }
        return $out . '</main>' . self::footer();
    }

    private static function header(): string
    {
        $lang = self::$site['lang'];
        $name = self::$site['info']['name'] ?? '';
        $h = '<header class="site-header"><div class="wrap header-inner">';
        $h .= '<a class="brand" href="' . e(Content::url($lang, '')) . '"><img src="/logo-arc.svg" alt="' . e($name) . '" width="113" height="60"></a>';
        $h .= '<nav class="main-nav" aria-label="' . e(self::t('menu')) . '"><ul>';
        foreach (self::$site['nav'] as $item) {
            $h .= '<li><a href="' . e($item['url'] ?? '#') . '">' . e($item['label'] ?? '') . '</a>';
            if (!empty($item['children'])) {
                $h .= '<ul class="sub">';
                foreach ($item['children'] as $c) {
                    $h .= '<li><a href="' . e($c['url'] ?? '#') . '">' . e($c['label'] ?? '') . '</a></li>';
                }
                $h .= '</ul>';
            }
            $h .= '</li>';
        }
        $h .= '</ul></nav>';
        if (!empty(self::$site['info']['phone'])) {
            $h .= '<a class="header-phone" href="tel:' . e(preg_replace('/[^\d+]/', '', self::$site['info']['phone'])) . '">' . e(self::$site['info']['phone']) . '</a>';
        }
        return $h . '</div></header>';
    }

    private static function footer(): string
    {
        $i = self::$site['info'];
        $lang = self::$site['lang'];
        $addr = $i['address'][$lang] ?? $i['address']['bg'] ?? '';
        $f = '<footer class="site-footer"><div class="wrap footer-grid">';
        $f .= '<div><img src="/logo-arc-white.svg" alt="" width="113" height="60"><p>' . e($i['tagline'][$lang] ?? '') . '</p></div>';
        $f .= '<address><p>' . e($addr) . '</p>';
        if (!empty($i['phone'])) {
            $f .= '<p><a href="tel:' . e(preg_replace('/[^\d+]/', '', $i['phone'])) . '">' . e($i['phone']) . '</a></p>';
        }
        if (!empty($i['email'])) {
            $f .= '<p><a href="mailto:' . e($i['email']) . '">' . e($i['email']) . '</a></p>';
        }
        $f .= '</address><ul class="footer-links">';
        foreach (self::$site['nav'] as $item) {
            $f .= '<li><a href="' . e($item['url'] ?? '#') . '">' . e($item['label'] ?? '') . '</a></li>';
        }
        $f .= '</ul><ul class="footer-social">';
        foreach ($i['social'] ?? [] as $s) {
            $f .= '<li><a href="' . e($s['url']) . '" rel="noopener">' . e($s['label']) . '</a></li>';
        }
        $f .= '</ul></div><div class="wrap footer-legal"><p>© ' . date('Y') . ' ' . e($i['legalName'] ?? $i['name'] ?? '') . '. ' . e(self::t('rights')) . '</p></div></footer>';
        return $f;
    }

    private static function page(): string
    {
        $page = self::$p['page'];
        $blocks = $page['blocks'];
        $out = '';
        if (count(self::$p['breadcrumbs']) > 1) {
            $out .= '<nav class="crumbs wrap" aria-label="' . e(self::t('crumbs')) . '"><ol>';
            foreach (self::$p['breadcrumbs'] as $c) {
                $out .= '<li><a href="' . e($c['url']) . '">' . e($c['title']) . '</a></li>';
            }
            $out .= '</ol></nav>';
        }
        // „Празна секция“ е бележка за редакторите — посетителите не я виждат.
        $blocks = array_values(array_filter($blocks, fn($b) => $b['type'] !== 'placeholder'));
        $heroFirst = ($blocks[0]['type'] ?? '') === 'hero';
        if (!$heroFirst) {
            // Продукти, услуги и статии показват основната си снимка до заглавието.
            $headImage = !in_array($page['type'], ['page', 'category'], true) ? self::media($page['image']) : null;
            $out .= '<header class="page-head' . ($headImage ? ' has-image' : '') . '"><div class="wrap">';
            if ($headImage) {
                $out .= '<figure class="page-head-image">' . self::img($headImage, '(min-width: 900px) 40vw, 100vw', true) . '</figure>';
            }
            $out .= '<h1>' . e($page['title']) . '</h1>';
            if ($page['excerpt']) {
                $out .= '<p class="lede">' . e($page['excerpt']) . '</p>';
            }
            if ($page['type'] === 'post' && $page['publishedAt']) {
                $out .= '<p class="meta">' . e(self::t('published')) . ' <time datetime="' . e(substr($page['publishedAt'], 0, 10)) . '">' . e(date('d.m.Y', strtotime($page['publishedAt']))) . '</time></p>';
            }
            $out .= '</div></header>';
        }
        $article = $page['type'] === 'post';
        $out .= $article ? '<article class="post">' : '';
        foreach ($blocks as $i => $b) {
            $out .= self::block($b, $i === 0 && $heroFirst);
        }
        $out .= $article ? '</article>' : '';
        if (self::$p['related']) {
            $out .= '<section class="blk blk-listing related"><div class="wrap"><h2>' . e(self::t('related')) . '</h2>' . self::cards(self::$p['related']) . '</div></section>';
        }
        return $out;
    }

    /** Цветове от Админ → Външен вид. Само познати променливи и #rrggbb, защото отиват в <style>. */
    public const THEME_VARS = ['petrol', 'petrol-deep', 'petrol-soft', 'ink', 'steel', 'rule', 'plate', 'paper', 'amber', 'amber-ink'];

    public static function theme(mixed $in): array
    {
        $out = [];
        foreach (self::THEME_VARS as $k) {
            $v = is_array($in) ? strtolower((string)($in[$k] ?? '')) : '';
            if (preg_match('/^#[0-9a-f]{6}$/', $v)) {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    public static function themeStyle(): string
    {
        $t = self::theme(Db::setting('theme', []));
        if (!$t) {
            return '';
        }
        return '<style id="theme">html:root{' . implode('', array_map(fn($k, $v) => "--$k:$v;", array_keys($t), $t)) . '}</style>';
    }

    private static function media(?int $id): ?array
    {
        return $id ? ((array)self::$p['media'])[$id] ?? null : null;
    }

    public static function img(?array $m, string $sizes = '100vw', bool $eager = false, ?string $alt = null): string
    {
        if (!$m) {
            return '';
        }
        $srcset = array_map(fn($v) => e($v['url']) . ' ' . $v['w'] . 'w', $m['variants']);
        if ($m['width']) {
            $srcset[] = e($m['url']) . ' ' . $m['width'] . 'w';
        }
        return sprintf(
            '<img src="%s"%s sizes="%s" alt="%s"%s%s %s decoding="async">',
            e($m['url']),
            count($srcset) > 1 ? ' srcset="' . implode(', ', $srcset) . '"' : '',
            e($sizes),
            e($alt ?? $m['alt']),
            $m['width'] ? ' width="' . $m['width'] . '"' : '',
            $m['height'] ? ' height="' . $m['height'] . '"' : '',
            $eager ? 'fetchpriority="high"' : 'loading="lazy"'
        );
    }

    private static function heading(array $b, string $tag = 'h2'): string
    {
        return $b['heading'] !== '' ? "<$tag>" . e($b['heading']) . "</$tag>" : '';
    }

    private static function cards(array $items): string
    {
        $o = '<ul class="cards">';
        foreach ($items as $it) {
            $o .= '<li class="card"><a href="' . e($it['url']) . '">';
            $o .= '<div class="card-media">' . self::img(self::media($it['image']), '(min-width: 900px) 33vw, 100vw') . '</div>';
            $o .= '<h3>' . e($it['title']) . '</h3>';
            if ($it['excerpt']) {
                $o .= '<p>' . e($it['excerpt']) . '</p>';
            }
            $o .= '</a></li>';
        }
        return $o . '</ul>';
    }

    /** Хоризонтален слайдер. Без JS е обикновен хоризонтално превъртащ се списък; React добавя стрелките. */
    private static function carousel(array $b, array $items): string
    {
        $kinds = self::KINDS[self::$site['lang']] ?? self::KINDS['bg'];
        $o = '<div class="carousel"><div class="carousel-head">' . self::heading($b) . '</div><ul class="carousel-track">';
        foreach ($items as $it) {
            $o .= '<li class="slide"><a href="' . e($it['url']) . '">';
            $o .= '<div class="slide-media">' . self::img(self::media($it['image']), '(min-width: 900px) 360px, 80vw') . '</div>';
            $o .= '<p class="slide-kind kind-' . e($it['type']) . '">' . e($kinds[$it['type']] ?? '');
            if ($it['type'] === 'post' && $it['publishedAt']) {
                $o .= ' · <time datetime="' . e(substr($it['publishedAt'], 0, 10)) . '">' . e(date('d.m.Y', strtotime($it['publishedAt']))) . '</time>';
            }
            $o .= '</p><h3>' . e($it['title']) . '</h3>';
            if ($it['excerpt']) {
                $o .= '<p class="slide-text">' . e($it['excerpt']) . '</p>';
            }
            $o .= '</a></li>';
        }
        return $o . '</ul></div>';
    }

    public const KINDS = [
        'bg' => ['post' => 'Новина', 'product' => 'Продукт', 'service' => 'Услуга', 'category' => 'Категория', 'page' => 'Страница'],
        'en' => ['post' => 'News', 'product' => 'Product', 'service' => 'Service', 'category' => 'Category', 'page' => 'Page'],
    ];

    private static function block(array $b, bool $isH1): string
    {
        $t = $b['type'];
        $inner = match ($t) {
            'hero' => self::hero($b, $isH1),
            'richtext' => self::heading($b) . '<div class="prose">' . $b['html'] . '</div>',
            'image' => '<figure' . self::fxAttr($b) . '>' . self::img(self::media($b['image']), '(min-width: 1200px) 1100px, 100vw') . ($b['caption'] ? '<figcaption>' . e($b['caption']) . '</figcaption>' : '') . '</figure>',
            'gallery' => self::heading($b) . '<ul class="gallery">' . implode('', array_map(
                fn($id) => '<li>' . self::img(self::media($id), '(min-width: 900px) 33vw, 50vw') . '</li>',
                $b['images']
            )) . '</ul>',
            'logos' => self::heading($b) . '<ul class="logos">' . implode('', array_map(
                fn($id) => '<li>' . self::img(self::media($id), '160px') . '</li>',
                $b['images']
            )) . '</ul>',
            'video' => self::video($b),
            'features' => self::heading($b) . ($b['intro'] ? '<p class="intro">' . e($b['intro']) . '</p>' : '') . '<ul class="features">' . implode('', array_map(
                fn($it) => '<li><h3>' . e($it['title']) . '</h3><p>' . e($it['text']) . '</p></li>',
                $b['items']
            )) . '</ul>',
            'steps' => self::heading($b) . '<ol class="steps">' . implode('', array_map(
                fn($it) => '<li><h3>' . e($it['title']) . '</h3><p>' . e($it['text']) . '</p></li>',
                $b['items']
            )) . '</ol>',
            'faq' => self::heading($b) . '<div class="faq">' . implode('', array_map(
                fn($it) => '<details><summary>' . e($it['q']) . '</summary><p>' . nl2br(e($it['a'])) . '</p></details>',
                $b['items']
            )) . '</div>',
            'specs' => self::heading($b) . '<table class="specs"><tbody>' . implode('', array_map(
                fn($r) => '<tr><th scope="row">' . e($r['label']) . '</th><td>' . e($r['value']) . '</td></tr>',
                $b['rows']
            )) . '</tbody></table>',
            'cta' => '<div class="cta-box">' . self::heading($b) . ($b['text'] ? '<p>' . e($b['text']) . '</p>' : '')
                . ($b['label'] ? '<a class="btn btn-primary" href="' . e($b['url']) . '">' . e($b['label']) . '</a>' : '') . '</div>',
            'listing' => self::heading($b) . self::cards(((array)self::$p['listings'])[$b['id']] ?? []),
            'carousel' => self::carousel($b, ((array)self::$p['listings'])[$b['id']] ?? []),
            'testimonials' => self::heading($b) . '<div class="quotes">' . implode('', array_map(
                fn($it) => '<figure><blockquote><p>' . e($it['quote']) . '</p></blockquote><figcaption>' . e($it['author']) . ($it['company'] ? ', ' . e($it['company']) : '') . '</figcaption></figure>',
                $b['items']
            )) . '</div>',
            'contact' => self::contact($b),
            'downloads' => self::heading($b) . '<ul class="downloads">' . implode('', array_map(function ($id) {
                $m = self::media($id);
                return $m ? '<li><a href="' . e($m['url']) . '" download>' . e($m['title'] ?: $m['name']) . '</a> <span>' . strtoupper(pathinfo($m['url'], PATHINFO_EXTENSION)) . ', ' . round($m['size'] / 1048576, 1) . ' MB</span></li>' : '';
            }, $b['files'])) . '</ul>',
            default => '',
        };
        $box = isset($b['width']) ? ' blk-box al-' . e($b['align'] ?? 'left') . '" style="--bw:' . (int)$b['width'] . '%' : '';
        return '<section class="blk blk-' . $t . $box . '"><div class="wrap">' . $inner . '</div></section>';
    }

    /** CSS filter за ефекта върху снимка — същият низ като fxFilter в site/box.ts. Стойностите са почистени от Sanitizer::fx. */
    private static function fx(array $b): string
    {
        $c = $b['effectColor'] ?? 'var(--amber)';
        $s = (int)($b['effectSize'] ?? 24);
        switch ($b['effect'] ?? '') {
            case 'glow':
                return "drop-shadow(0 0 {$s}px $c) drop-shadow(0 0 " . (int)round($s / 2) . "px $c)";
            case 'shadow':
                return 'drop-shadow(0 ' . (int)round($s / 3) . "px {$s}px $c)";
            case 'outline':
                $o = max(1, (int)round($s / 4));
                return "drop-shadow({$o}px 0 0 $c) drop-shadow(-{$o}px 0 0 $c) drop-shadow(0 {$o}px 0 $c) drop-shadow(0 -{$o}px 0 $c)";
        }
        return '';
    }

    private static function fxAttr(array $b): string
    {
        $f = self::fx($b);
        return $f ? ' class="fx" style="--fx:' . e($f) . '"' : '';
    }

    private static function hero(array $b, bool $isH1): string
    {
        $tag = $isH1 ? 'h1' : 'h2';
        // Размер на снимката: под 100 % — по-малка в колоната; над 100 % — по-широка колона (heroGridStyle в site/box.ts).
        $size = (int)($b['imageSize'] ?? 100);
        $grid = match (true) {
            $size > 0 && $size < 100 => ' style="--img:' . $size . '%"',
            $size > 100 => ' style="--img-col:' . ($size / 100) . 'fr"',
            default => '',
        };
        $o = '<div class="hero-grid"' . $grid . '><div class="hero-copy">' . self::heading($b, $tag);
        if ($b['text']) {
            $o .= '<p>' . e($b['text']) . '</p>';
        }
        if ($b['ctaLabel']) {
            $o .= '<a class="btn btn-primary" href="' . e($b['ctaUrl']) . '">' . e($b['ctaLabel']) . '</a>';
        }
        $o .= '</div>';
        $m = self::media($b['image']);
        if ($m) {
            $fx = self::fx($b);
            $o .= '<figure class="hero-figure' . ($fx ? ' fx" style="--fx:' . e($fx) : '') . '"><div class="dim-frame">' . self::img($m, '(min-width: 900px) 50vw, 100vw', $isH1) . '</div>';
            if ($b['measure']) {
                $o .= '<figcaption class="dim-label">' . e($b['measure']) . '</figcaption>';
            }
            $o .= '</figure>';
        }
        return $o . '</div>';
    }

    private static function video(array $b): string
    {
        $o = self::heading($b) . '<figure class="video">';
        if ($b['provider'] === 'youtube' && $b['videoId']) {
            $o .= '<a class="video-facade" href="https://www.youtube.com/watch?v=' . e($b['videoId']) . '"><img src="https://i.ytimg.com/vi/' . e($b['videoId']) . '/hqdefault.jpg" alt="' . e($b['caption'] ?: self::t('watch')) . '" loading="lazy" width="480" height="360"></a>';
        } elseif ($b['provider'] === 'vimeo' && $b['videoId']) {
            $o .= '<a class="video-facade" href="https://vimeo.com/' . e($b['videoId']) . '">' . e($b['caption'] ?: self::t('watch')) . '</a>';
        } elseif ($m = self::media($b['media'])) {
            $poster = self::media($b['poster']);
            $o .= '<video controls preload="none" playsinline' . ($poster ? ' poster="' . e($poster['url']) . '"' : '') . '><source src="' . e($m['url']) . '" type="' . e($m['mime']) . '"></video>';
        }
        if ($b['caption']) {
            $o .= '<figcaption>' . e($b['caption']) . '</figcaption>';
        }
        return $o . '</figure>';
    }

    private static function contact(array $b): string
    {
        $i = self::$site['info'];
        $lang = self::$site['lang'];
        $o = self::heading($b) . ($b['text'] ? '<p class="intro">' . e($b['text']) . '</p>' : '');
        $o .= '<dl class="contact-list">';
        $o .= '<dt>' . e(self::t('address')) . '</dt><dd>' . e($i['address'][$lang] ?? '') . '</dd>';
        $o .= '<dt>' . e(self::t('phone')) . '</dt><dd><a href="tel:' . e(preg_replace('/[^\d+]/', '', $i['phone'] ?? '')) . '">' . e($i['phone'] ?? '') . '</a></dd>';
        $o .= '<dt>' . e(self::t('email')) . '</dt><dd><a href="mailto:' . e($i['email'] ?? '') . '">' . e($i['email'] ?? '') . '</a></dd>';
        return $o . '</dl>';
    }
}
