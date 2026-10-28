<?php
declare(strict_types=1);

/** AES-256-GCM криптиране на чувствителни данни (2FA тайни) с ключа app_key от конфигурацията. */
final class Crypto
{
    private static function key(): string
    {
        $key = base64_decode((string)config('app_key'), true);
        if ($key === false || strlen($key) !== 32) {
            throw new HttpError(500, 'app_key в конфигурацията липсва или е невалиден (трябват 32 байта в base64).');
        }
        return $key;
    }

    public static function encrypt(string $plain): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        return base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt(string $encoded): string
    {
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) < 29) {
            throw new HttpError(500, 'Повредени криптирани данни.');
        }
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        if ($plain === false) {
            throw new HttpError(500, 'Неуспешно декриптиране (сменен app_key?).');
        }
        return $plain;
    }
}
