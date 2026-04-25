<?php
declare(strict_types=1);

if (!function_exists('str_starts_with')) {
  function str_starts_with(string $haystack, string $needle): bool {
    return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
  }
}

header('content-type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  header('access-control-allow-origin: ' . allowedOrigin());
  header('access-control-allow-headers: content-type, x-app-token');
  header('access-control-allow-methods: POST, OPTIONS');
  http_response_code(204);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method Not Allowed']);
  exit;
}

$token = $_SERVER['HTTP_X_APP_TOKEN'] ?? '';
if (!$token) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing x-app-token header']);
  exit;
}
if (!isValidToken($token)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid token format']);
  exit;
}

$raw = file_get_contents('php://input');
$payload = is_string($raw) ? json_decode($raw, true) : null;
if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid JSON body']);
  exit;
}
$personneId = isset($payload['personneId']) ? (int)$payload['personneId'] : 0;
if ($personneId <= 0) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing personneId']);
  exit;
}

$supabaseUrl = getSupabaseMeta('supabase-url');
$supabaseAnonKey = getSupabaseMeta('supabase-anon-key');
if (!$supabaseUrl || !$supabaseAnonKey) {
  http_response_code(500);
  echo json_encode(['error' => 'Supabase config missing on server']);
  exit;
}

$famille = rpcGetFamilleByToken($supabaseUrl, $supabaseAnonKey, $token);
if (!$famille || !isset($famille['id'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Token invalide']);
  exit;
}
$familleId = (int)$famille['id'];

$personnes = rpcGetPersonnesByFamille($supabaseUrl, $supabaseAnonKey, $familleId);
if (!isPersonneInList($personneId, $personnes)) {
  http_response_code(403);
  echo json_encode(['error' => 'Personne forbidden']);
  exit;
}

$baseDir = realpath(__DIR__ . '/../assets-mariage');
if ($baseDir === false) {
  echo json_encode(['items' => []]);
  exit;
}
$personDir = $baseDir . DIRECTORY_SEPARATOR . "personne-{$personneId}";
if (!is_dir($personDir)) {
  echo json_encode(['items' => []]);
  exit;
}

$publicBaseUrl = publicBaseUrl();
$items = [];
$familyDirReal = $personDir;
clearstatcache(true, $familyDirReal);
$files = @scandir($personDir);
if (is_array($files)) {
  foreach ($files as $name) {
    if (!is_string($name) || $name === '.' || $name === '..') continue;
    if (str_starts_with($name, '.')) continue;
    $path = $personDir . DIRECTORY_SEPARATOR . $name;
    if (!is_file($path)) continue;
    // Only list expected formats
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ['webp', 'jpg', 'jpeg', 'png', 'gif'], true)) continue;
    $size = @filesize($path);
    if ($size === false) $size = 0;
    $mtime = @filemtime($path);
    $lastModified = $mtime ? gmdate('c', $mtime) : null;
    $key = "personne-{$personneId}/{$name}";
    $url = rtrim($publicBaseUrl, '/') . '/assets-mariage/' . rawurlencode("personne-{$personneId}") . '/' . rawurlencode($name);
    if ($mtime) {
      $url .= '?v=' . (string)$mtime;
    }
    $items[] = [
      'key' => $key,
      'name' => (string) $name,
      'url' => $url,
      'size' => (int)$size,
      'lastModified' => $lastModified,
    ];
  }
}

// Sort by lastModified desc (timestamps entiers, évite erreurs de tri PHP 8+ avec false)
usort(
  $items,
  static function (array $a, array $b): int {
    $ta = 0;
    $tb = 0;
    if (isset($a['lastModified']) && is_string($a['lastModified'])) {
      $s = strtotime($a['lastModified']);
      if ($s !== false) {
        $ta = $s;
      }
    }
    if (isset($b['lastModified']) && is_string($b['lastModified'])) {
      $s = strtotime($b['lastModified']);
      if ($s !== false) {
        $tb = $s;
      }
    }
    return $tb <=> $ta;
  },
);

$jsonFlags = JSON_UNESCAPED_SLASHES;
if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
  $jsonFlags |= constant('JSON_INVALID_UTF8_SUBSTITUTE');
}
$out = json_encode(['items' => $items], $jsonFlags);
if (!is_string($out) || $out === '') {
  http_response_code(500);
  $fallback = json_encode(
    ['error' => 'Impossible de sérialiser la liste', 'items' => []],
    $jsonFlags,
  );
  echo is_string($fallback) ? $fallback : '{"error":"json_encode failed","items":[]}';
  exit;
}

http_response_code(200);
header('access-control-allow-origin: ' . allowedOrigin());
echo $out;

function publicBaseUrl(): string {
  $host = $_SERVER['HTTP_HOST'] ?? '';
  $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  if ($host) return "{$proto}://{$host}";
  return 'https://amaurythibaud.be';
}

function allowedOrigin(): string {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if (is_string($origin) && $origin !== '') {
    return $origin;
  }
  return publicBaseUrl();
}

function isValidToken(string $token): bool {
  if (strlen($token) < 4 || strlen($token) > 128) return false;
  return (bool)preg_match('/^[A-Za-z0-9_-]+$/', $token);
}

function getSupabaseMeta(string $name): ?string {
  $path = __DIR__ . '/supabase-meta.json';
  if (!is_file($path)) return null;
  $raw = file_get_contents($path);
  if ($raw === false) return null;
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data[$name]) || !is_string($data[$name])) return null;
  $value = trim($data[$name]);
  return $value !== '' ? $value : null;
}

function rpcGetFamilleByToken(string $supabaseUrl, string $anonKey, string $token): ?array {
  $endpoint = rtrim($supabaseUrl, '/') . '/rest/v1/rpc/get_famille_by_token';
  $payload = json_encode(['p_token' => $token]);
  if ($payload === false) return null;

  $opts = [
    'http' => [
      'method' => 'POST',
      'header' => implode("\r\n", [
        'content-type: application/json',
        'apikey: ' . $anonKey,
        'authorization: Bearer ' . $anonKey,
      ]),
      'content' => $payload,
      'timeout' => 10,
    ],
  ];
  $ctx = stream_context_create($opts);
  $res = @file_get_contents($endpoint, false, $ctx);
  if ($res === false) return null;

  $decoded = json_decode($res, true);
  if (is_array($decoded) && isset($decoded[0]) && is_array($decoded[0])) return $decoded[0];
  if (is_array($decoded)) return $decoded;
  return null;
}

function rpcGetPersonnesByFamille(string $supabaseUrl, string $anonKey, int $familleId): array {
  $endpoint = rtrim($supabaseUrl, '/') . '/rest/v1/rpc/get_personnes_by_famille';
  $payload = json_encode(['p_famille_id' => $familleId]);
  if ($payload === false) return [];
  $opts = [
    'http' => [
      'method' => 'POST',
      'header' => implode("\r\n", [
        'content-type: application/json',
        'apikey: ' . $anonKey,
        'authorization: Bearer ' . $anonKey,
      ]),
      'content' => $payload,
      'timeout' => 10,
    ],
  ];
  $ctx = stream_context_create($opts);
  $res = @file_get_contents($endpoint, false, $ctx);
  if ($res === false) return [];
  $decoded = json_decode($res, true);
  return is_array($decoded) ? $decoded : [];
}

function isPersonneInList(int $personneId, array $list): bool {
  foreach ($list as $row) {
    if (is_array($row) && isset($row['id']) && (int)$row['id'] === $personneId) return true;
  }
  return false;
}

