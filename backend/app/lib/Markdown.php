<?php
declare(strict_types=1);

/** Markdown версии на страниците за чатботове и LLM (/път.md, /llms-full.txt). */
final class Markdown
{
    public static function page(array $payload): string
    {
        $p = $payload['page'];
        $media = (array)$payload['media'];
        $base = base_url();
        $md = '# ' . $p['title'] . "\n\n";
        $md .= '> ' . ($p['metaDescription'] ?: $p['excerpt']) . "\n\n";
        $md .= 'URL: ' . $base . $p['url'] . "\n";
        if ($p['updatedAt']) {
            $md .= 'Updated: ' . substr($p['updatedAt'], 0, 10) . "\n";
        }
        $md .= "\n";
        foreach ($p['blocks'] as $b) {
            $h = $b['heading'] !== '' ? '## ' . $b['heading'] . "\n\n" : '';
            $md .= match ($b['type']) {
                'hero' => $h . ($b['text'] ? $b['text'] . "\n\n" : '') . ($b['measure'] ? '*' . $b['measure'] . "*\n\n" : ''),
                'richtext' => $h . self::fromHtml($b['html']) . "\n\n",
                'features', 'steps' => $h . implode('', array_map(
                    fn($i, $n) => ($b['type'] === 'steps' ? ($n + 1) . '. ' : '- ') . '**' . $i['title'] . '** — ' . $i['text'] . "\n",
                    $b['items'],
                    array_keys($b['items'])
                )) . "\n",
                'faq' => $h . implode('', array_map(fn($i) => '### ' . $i['q'] . "\n\n" . $i['a'] . "\n\n", $b['items'])),
                'specs' => $h . "| Параметър | Стойност |\n|---|---|\n" . implode('', array_map(
                    fn($r) => '| ' . self::cell($r['label']) . ' | ' . self::cell($r['value']) . " |\n",
                    $b['rows']
                )) . "\n",
                'cta' => $h . ($b['text'] ? $b['text'] . "\n\n" : '') . ($b['label'] ? '[' . $b['label'] . '](' . self::abs($b['url']) . ")\n\n" : ''),
                'listing', 'carousel' => $h . implode('', array_map(
                    fn($c) => '- [' . $c['title'] . '](' . $base . $c['url'] . ')' . ($c['excerpt'] ? ': ' . $c['excerpt'] : '') . "\n",
                    ((array)$payload['listings'])[$b['id']] ?? []
                )) . "\n",
                'testimonials' => $h . implode('', array_map(fn($i) => '> ' . $i['quote'] . "\n>\n> — " . $i['author'] . ($i['company'] ? ', ' . $i['company'] : '') . "\n\n", $b['items'])),
                'image' => isset($media[$b['image']]) ? '![' . $media[$b['image']]['alt'] . '](' . $base . $media[$b['image']]['url'] . ')' . ($b['caption'] ? "\n\n*" . $b['caption'] . '*' : '') . "\n\n" : '',
                'video' => $h . match ($b['provider']) {
                    'youtube' => 'Видео: https://www.youtube.com/watch?v=' . $b['videoId'],
                    'vimeo' => 'Видео: https://vimeo.com/' . $b['videoId'],
                    default => isset($media[$b['media']]) ? 'Видео: ' . $base . $media[$b['media']]['url'] : '',
                } . ($b['caption'] ? ' — ' . $b['caption'] : '') . "\n\n",
                'downloads' => $h . implode('', array_map(
                    fn($id) => isset($media[$id]) ? '- [' . ($media[$id]['title'] ?: $media[$id]['name']) . '](' . $base . $media[$id]['url'] . ")\n" : '',
                    $b['files']
                )) . "\n",
                'contact' => $h . self::contactInfo($payload['page']['lang']),
                'placeholder' => '', // само за редакторите
                default => '',
            };
        }
        if ($payload['related']) {
            $md .= "## Свързани\n\n" . implode('', array_map(fn($c) => '- [' . $c['title'] . '](' . $base . $c['url'] . ")\n", $payload['related'])) . "\n";
        }
        return rtrim(preg_replace("/\n{3,}/", "\n\n", $md)) . "\n";
    }

    public static function contactInfo(string $lang): string
    {
        $i = Db::setting('site', []);
        return sprintf("- %s\n- Тел.: %s\n- Имейл: %s\n\n", $i['address'][$lang] ?? '', $i['phone'] ?? '', $i['email'] ?? '');
    }

    private static function cell(string $s): string
    {
        return str_replace(['|', "\n"], ['\|', ' '], $s);
    }

    private static function abs(string $url): string
    {
        return str_starts_with($url, '/') ? base_url() . $url : $url;
    }

    public static function fromHtml(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }
        $doc = new DOMDocument('1.0', 'UTF-8');
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8"><div>' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = (new DOMXPath($doc))->query('/div')->item(0) ?? $doc->documentElement;
        return trim(preg_replace("/\n{3,}/", "\n\n", self::node($root)));
    }

    private static function children(DOMNode $n): string
    {
        $s = '';
        foreach ($n->childNodes as $c) {
            $s .= self::node($c);
        }
        return $s;
    }

    private static function node(DOMNode $n): string
    {
        if ($n instanceof DOMText) {
            return preg_replace('/\s+/u', ' ', $n->textContent);
        }
        if (!$n instanceof DOMElement) {
            return '';
        }
        $tag = strtolower($n->tagName);
        $in = fn() => trim(self::children($n));
        return match ($tag) {
            'h2' => "\n\n## " . $in() . "\n\n",
            'h3' => "\n\n### " . $in() . "\n\n",
            'h4' => "\n\n#### " . $in() . "\n\n",
            'p', 'figure' => "\n\n" . $in() . "\n\n",
            'br' => "  \n",
            'strong', 'b' => '**' . $in() . '**',
            'em', 'i' => '*' . $in() . '*',
            'code' => '`' . $in() . '`',
            'a' => '[' . $in() . '](' . self::abs($n->getAttribute('href')) . ')',
            'img' => '![' . $n->getAttribute('alt') . '](' . self::abs($n->getAttribute('src')) . ')',
            'blockquote' => "\n\n> " . str_replace("\n", "\n> ", $in()) . "\n\n",
            'ul', 'ol' => "\n\n" . self::list($n, $tag === 'ol') . "\n\n",
            'table' => "\n\n" . self::table($n) . "\n\n",
            'hr' => "\n\n---\n\n",
            default => self::children($n),
        };
    }

    private static function list(DOMElement $list, bool $ordered): string
    {
        $out = [];
        $i = 1;
        foreach ($list->childNodes as $li) {
            if ($li instanceof DOMElement && strtolower($li->tagName) === 'li') {
                $out[] = ($ordered ? $i++ . '.' : '-') . ' ' . trim(preg_replace("/\n+/", ' ', self::children($li)));
            }
        }
        return implode("\n", $out);
    }

    private static function table(DOMElement $table): string
    {
        $rows = [];
        foreach ((new DOMXPath($table->ownerDocument))->query('.//tr', $table) as $tr) {
            $cells = [];
            foreach ($tr->childNodes as $td) {
                if ($td instanceof DOMElement && in_array(strtolower($td->tagName), ['td', 'th'], true)) {
                    $cells[] = self::cell(trim(self::children($td)));
                }
            }
            $rows[] = '| ' . implode(' | ', $cells) . ' |';
        }
        if (!$rows) {
            return '';
        }
        $cols = substr_count($rows[0], '|') - 1;
        array_splice($rows, 1, 0, '|' . str_repeat('---|', max(1, $cols)));
        return implode("\n", $rows);
    }
}
