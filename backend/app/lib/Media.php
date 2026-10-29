<?php
declare(strict_types=1);

/**
 * Качване на файлове. Изображенията се прекодират (премахва EXIF/GPS метаданни),
 * ограничават се до 2400 px и получават WebP варианти 480/960/1600 px за srcset.
 */
final class Media
{
    private const IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    private const VIDEO_TYPES = ['video/mp4' => 'mp4', 'video/webm' => 'webm'];
    private const FILE_TYPES = ['application/pdf' => 'pdf'];
    private const WIDTHS = [480, 960, 1600];
    private const MAX_SIDE = 2400;

    public static function upload(array $file, int $userId): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new HttpError(400, match ($file['error'] ?? 0) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Файлът е твърде голям за настройките на сървъра.',
                UPLOAD_ERR_NO_FILE => 'Не е избран файл.',
                default => 'Качването не бе успешно.',
            });
        }
        $maxBytes = (int)config('upload_max_mb', 200) * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            throw new HttpError(400, 'Файлът надвишава ' . config('upload_max_mb', 200) . ' MB.');
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
        $kind = match (true) {
            isset(self::IMAGE_TYPES[$mime]) => 'image',
            isset(self::VIDEO_TYPES[$mime]) => 'video',
            isset(self::FILE_TYPES[$mime]) => 'file',
            default => throw new HttpError(415, 'Неподдържан формат. Разрешени: JPG, PNG, WebP, GIF, MP4, WebM, PDF.'),
        };

        $sub = date('Y/m');
        $dir = WEB_DIR . "/uploads/$sub";
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            throw new HttpError(500, 'Папката за качване не може да бъде създадена.');
        }
        $name = bin2hex(random_bytes(8));
        $original = Sanitizer::text(basename((string)$file['name']), 200);
        $row = [
            'kind' => $kind,
            'mime' => $mime,
            'original_name' => $original,
            'title' => Sanitizer::text(pathinfo($original, PATHINFO_FILENAME), 200),
            'alt_bg' => '',
            'alt_en' => '',
            'width' => null,
            'height' => null,
            'variants' => '[]',
            'created_at' => now(),
            'uploaded_by' => $userId,
        ];

        if ($kind === 'image') {
            $row = array_merge($row, self::processImage($file['tmp_name'], $mime, $dir, $sub, $name));
        } else {
            $ext = self::VIDEO_TYPES[$mime] ?? self::FILE_TYPES[$mime];
            $target = "$dir/$name.$ext";
            if (!move_uploaded_file($file['tmp_name'], $target) && !rename($file['tmp_name'], $target)) {
                throw new HttpError(500, 'Файлът не може да бъде записан.');
            }
            $row['path'] = "/uploads/$sub/$name.$ext";
        }
        $row['size'] = filesize(WEB_DIR . $row['path']) ?: 0;
        $id = Db::insert('media', $row);
        Db::audit($userId, 'media.upload', $row['path']);
        return self::view(Db::one('SELECT * FROM media WHERE id = ?', [$id]));
    }

    private static function processImage(string $tmp, string $mime, string $dir, string $sub, string $name): array
    {
        if (!function_exists('imagecreatefromstring')) {
            throw new HttpError(500, 'PHP разширението GD не е активно (cPanel → PHP Manager).');
        }
        $img = @imagecreatefromstring((string)file_get_contents($tmp));
        if (!$img) {
            throw new HttpError(415, 'Изображението не може да бъде прочетено.');
        }
        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($tmp);
            $img = match ((int)($exif['Orientation'] ?? 1)) {
                3 => imagerotate($img, 180, 0),
                6 => imagerotate($img, -90, 0),
                8 => imagerotate($img, 90, 0),
                default => $img,
            };
        }
        $img = self::fit($img, self::MAX_SIDE);
        imagesavealpha($img, true); // прозрачен фон (напр. след „Премахнете белия фон“)
        $w = imagesx($img);
        $h = imagesy($img);
        $alpha = in_array($mime, ['image/png', 'image/webp', 'image/gif'], true);
        $webp = function_exists('imagewebp');

        // Оригинал (прекодиран, без метаданни)
        $ext = $alpha ? ($webp ? 'webp' : 'png') : 'jpg';
        $main = "$dir/$name.$ext";
        self::save($img, $main, $ext);

        $variants = [];
        foreach (self::WIDTHS as $vw) {
            if ($vw >= $w) {
                continue;
            }
            $v = self::fit($img, $vw, true);
            $vext = $webp ? 'webp' : $ext;
            self::save($v, "$dir/$name-$vw.$vext", $vext);
            $variants[] = ['w' => $vw, 'url' => "/uploads/$sub/$name-$vw.$vext"];
            imagedestroy($v);
        }
        imagedestroy($img);
        return [
            'path' => "/uploads/$sub/$name.$ext",
            'mime' => $ext === 'jpg' ? 'image/jpeg' : "image/$ext",
            'width' => $w,
            'height' => $h,
            'variants' => json_encode($variants),
        ];
    }

    private static function fit(GdImage $img, int $max, bool $byWidth = false): GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $scale = $byWidth ? $max / $w : $max / max($w, $h);
        if ($scale >= 1) {
            return $byWidth ? self::copy($img, $w, $h) : $img;
        }
        return self::copy($img, (int)round($w * $scale), (int)round($h * $scale));
    }

    private static function copy(GdImage $src, int $w, int $h): GdImage
    {
        $dst = imagecreatetruecolor($w, $h);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, $h, imagesx($src), imagesy($src));
        return $dst;
    }

    private static function save(GdImage $img, string $path, string $ext): void
    {
        match ($ext) {
            'webp' => imagewebp($img, $path, 80),
            'png' => imagepng($img, $path, 7),
            default => imagejpeg($img, $path, 82),
        };
    }

    public static function delete(int $id): void
    {
        $m = Db::one('SELECT * FROM media WHERE id = ?', [$id]);
        if (!$m) {
            return;
        }
        $paths = [$m['path'], ...array_column(json_decode($m['variants'] ?: '[]', true), 'url')];
        foreach ($paths as $p) {
            $full = WEB_DIR . $p;
            if (str_starts_with($p, '/uploads/') && is_file($full)) {
                unlink($full);
            }
        }
        Db::run('DELETE FROM media WHERE id = ?', [$id]);
    }

    /** Публичен изглед на медиен файл за даден език. */
    public static function view(?array $m, string $lang = 'bg'): ?array
    {
        if (!$m) {
            return null;
        }
        $alt = $lang === 'en' ? ($m['alt_en'] ?: $m['alt_bg']) : ($m['alt_bg'] ?: $m['alt_en']);
        return [
            'id' => (int)$m['id'],
            'kind' => $m['kind'],
            'url' => $m['path'],
            'mime' => $m['mime'],
            'width' => $m['width'] ? (int)$m['width'] : null,
            'height' => $m['height'] ? (int)$m['height'] : null,
            'alt' => $alt ?: '',
            'altBg' => $m['alt_bg'],
            'altEn' => $m['alt_en'],
            'title' => $m['title'],
            'name' => $m['original_name'],
            'size' => (int)$m['size'],
            'variants' => json_decode($m['variants'] ?: '[]', true),
        ];
    }

    /** Зарежда наведнъж всички изброени медийни файлове: [id => view]. */
    public static function many(array $ids, string $lang): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (!$ids) {
            return [];
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        $out = [];
        foreach (Db::all("SELECT * FROM media WHERE id IN ($in)", $ids) as $m) {
            $out[(int)$m['id']] = self::view($m, $lang);
        }
        return $out;
    }
}
