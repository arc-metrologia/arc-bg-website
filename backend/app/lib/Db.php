<?php
declare(strict_types=1);

/** Тънка обвивка около PDO. Работи с MySQL (продукция) и SQLite (локална разработка). */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $c = config('db');
            self::$pdo = new PDO($c['dsn'], $c['user'] ?? null, $c['pass'] ?? null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            if (self::driver() === 'sqlite') {
                self::$pdo->exec('PRAGMA foreign_keys = ON');
            }
        }
        return self::$pdo;
    }

    public static function driver(): string
    {
        return self::pdo()->getAttribute(PDO::ATTR_DRIVER_NAME);
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function val(string $sql, array $params = []): mixed
    {
        $v = self::run($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    /** Таблиците и колоните идват само от кода, никога от потребителски вход. */
    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $cols),
            implode(', ', array_map(fn($c) => ":$c", $cols))
        );
        self::run($sql, $data);
        return (int)self::pdo()->lastInsertId();
    }

    public static function update(string $table, array $data, int $id): void
    {
        $set = implode(', ', array_map(fn($c) => "$c = :$c", array_keys($data)));
        $data['__id'] = $id;
        self::run("UPDATE $table SET $set WHERE id = :__id", $data);
    }

    public static function setting(string $key, mixed $default = null): mixed
    {
        $v = self::val('SELECT v FROM settings WHERE k = ?', [$key]);
        return $v === null ? $default : json_decode($v, true);
    }

    public static function saveSetting(string $key, mixed $value): void
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE);
        if (self::val('SELECT COUNT(*) FROM settings WHERE k = ?', [$key])) {
            self::run('UPDATE settings SET v = ? WHERE k = ?', [$json, $key]);
        } else {
            self::run('INSERT INTO settings (k, v) VALUES (?, ?)', [$key, $json]);
        }
    }

    public static function audit(?int $userId, string $action, string $target = ''): void
    {
        self::insert('audit_log', [
            'user_id' => $userId,
            'action' => $action,
            'target' => mb_substr($target, 0, 250),
            'ip' => Http::ip(),
            'created_at' => now(),
        ]);
    }
}
