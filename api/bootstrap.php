<?php
declare(strict_types=1);

const ACADEMY_API_VERSION = '2026-10-04.1';

function academy_config(): array {
    static $config = null;
    if ($config !== null) return $config;
    $file = __DIR__ . '/config.local.php';
    if (!is_file($file)) {
        throw new RuntimeException('Hostinger API is not configured. Create api/config.local.php from config.example.php.');
    }
    $config = require $file;
    return $config;
}

function academy_db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $cfg = academy_config()['db'];
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $cfg['host'], $cfg['name'], $cfg['charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function academy_json(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function academy_body(): array {
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) academy_json(['ok'=>false,'error'=>'invalid_json'], 400);
    return $data;
}

function academy_uuid(): string {
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

function academy_token(): string { return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '='); }
function academy_token_hash(string $token): string { return hash('sha256', $token); }
function academy_ip_hash(): string {
    $secret = academy_config()['app']['app_secret'] ?? '';
    return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', $secret);
}
function academy_user_agent_hash(): string { return hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? ''); }

function academy_path(string $path): string {
    $path = trim($path);
    $path = trim($path, '/');
    if ($path === '') return '';
    if (strlen($path) > 700 || str_contains($path, '..') || preg_match('/[\x00-\x1F]/', $path)) {
        academy_json(['ok'=>false,'error'=>'invalid_path'], 400);
    }
    return preg_replace('#/+#', '/', $path);
}

function academy_bearer(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', trim($header), $m)) return trim($m[1]);
    return null;
}

function academy_current_user(bool $required = false): ?array {
    $token = academy_bearer();
    if (!$token) {
        if ($required) academy_json(['ok'=>false,'error'=>'auth_required'], 401);
        return null;
    }
    $sql = "SELECT u.id,u.email,u.display_name,u.primary_role,u.status,s.app_name
            FROM academy_sessions s JOIN academy_users u ON u.id=s.user_id
            WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() LIMIT 1";
    $st = academy_db()->prepare($sql);
    $st->execute([academy_token_hash($token)]);
    $user = $st->fetch();
    if (!$user || $user['status'] !== 'active') {
        if ($required) academy_json(['ok'=>false,'error'=>'invalid_session'], 401);
        return null;
    }
    academy_db()->prepare('UPDATE academy_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE token_hash=?')
        ->execute([academy_token_hash($token)]);
    return $user;
}

function academy_audit(?string $uid, string $action, ?string $path = null, array $meta = []): void {
    $st = academy_db()->prepare('INSERT INTO academy_audit_log(user_id,action,target_path,metadata_json,ip_hash) VALUES(?,?,?,?,?)');
    $st->execute([$uid,$action,$path,$meta ? json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) : null,academy_ip_hash()]);
}

function academy_rate_limit(string $scope, int $maxHits, int $windowSeconds): void {
    $key = hash('sha256', $scope . '|' . academy_ip_hash());
    $pdo = academy_db();
    $pdo->beginTransaction();
    try {
        $st=$pdo->prepare('SELECT hits,UNIX_TIMESTAMP(window_started_at) AS started FROM academy_rate_limits WHERE bucket_key=? FOR UPDATE');
        $st->execute([$key]); $row=$st->fetch(); $now=time();
        if(!$row || ($now-(int)$row['started']) >= $windowSeconds){
            $pdo->prepare('REPLACE INTO academy_rate_limits(bucket_key,hits,window_started_at) VALUES(?,1,UTC_TIMESTAMP())')->execute([$key]);
        }else{
            if((int)$row['hits'] >= $maxHits){$pdo->rollBack();academy_json(['ok'=>false,'error'=>'too_many_requests'],429);}
            $pdo->prepare('UPDATE academy_rate_limits SET hits=hits+1 WHERE bucket_key=?')->execute([$key]);
        }
        $pdo->commit();
    } catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); throw $e; }
}

function academy_value_type(mixed $value): string {
    if ($value === null) return 'null';
    if (is_bool($value)) return 'boolean';
    if (is_int($value) || is_float($value)) return 'number';
    if (is_string($value)) return 'string';
    if (is_array($value)) return array_is_list($value) ? 'array' : 'object';
    return 'object';
}

function academy_write_node(string $path, mixed $value, ?string $uid): void {
    $pdo=academy_db(); $path=academy_path($path);
    $pdo->beginTransaction();
    try{
        if($path==='') $pdo->exec('DELETE FROM academy_data');
        else{
            $pdo->prepare('DELETE FROM academy_data WHERE path=? OR path LIKE ?')->execute([$path,$path.'/%']);
        }
        if($value!==null){
            $st=$pdo->prepare('INSERT INTO academy_data(path,value_json,value_type,updated_by) VALUES(?,?,?,?)');
            $st->execute([$path,json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),academy_value_type($value),$uid]);
        }
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function academy_read_node(string $path): mixed {
    $path=academy_path($path);$pdo=academy_db();
    $st=$pdo->prepare('SELECT path,value_json FROM academy_data WHERE path=? OR path LIKE ? ORDER BY CHAR_LENGTH(path)');
    $st->execute([$path,$path===''?'%':$path.'/%']);$rows=$st->fetchAll();
    if(!$rows)return null;
    foreach($rows as $row){if($row['path']===$path)return json_decode($row['value_json'],true);}
    $root=[];
    foreach($rows as $row){
        $rel=$path===''?$row['path']:substr($row['path'],strlen($path)+1);
        if($rel==='')continue;$parts=explode('/',$rel);$cursor=&$root;
        foreach($parts as $i=>$part){
            if($i===count($parts)-1){$cursor[$part]=json_decode($row['value_json'],true);}
            else{if(!isset($cursor[$part])||!is_array($cursor[$part]))$cursor[$part]=[];$cursor=&$cursor[$part];}
        }
        unset($cursor);
    }
    return $root;
}

function academy_role_allows(?array $user, string $method, string $path): bool {
    $path=academy_path($path);
    $read=$method==='GET';
    $publicRoots=['settingsV3','subjects','units','lessons','quizzes','files','simulations','liveSessions','announcements'];
    foreach($publicRoots as $root) if($read && ($path===$root || str_starts_with($path,$root.'/'))) return true;
    if(!$user)return false;
    $uid=$user['id'];$role=$user['primary_role'];
    if($role==='admin')return true;
    $ownRoots=["studentProfilesV3/$uid","parentProfilesV4/$uid","teacherProfiles/$uid","learningV4/"];
    foreach($ownRoots as $root) if($path===$root || str_starts_with($path,$root.'/')) return true;
    $sharedWrite=['subscriptionRequests','supportTickets','contentReports','communityPosts','communityReports','teacherSubmissions','assignmentSubmissions','lessonQuestions','notifications'];
    foreach($sharedWrite as $root) if($path===$root || str_starts_with($path,$root.'/')) return true;
    if($read && in_array($role,['student','teacher','parent'],true)){
        $memberRead=['assignments','studyGroups','communityPosts','broadcasts','schedules','contentAnalytics'];
        foreach($memberRead as $root) if($path===$root || str_starts_with($path,$root.'/')) return true;
    }
    return false;
}
