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

$baseDir = realpath(__DIR__ . '/../assets-mariage');
if ($baseDir === false) {
  echo json_encode(['items' => []]);
  exit;
}
$familyDir = $baseDir . DIRECTORY_SEPARATOR . "famille-{$familleId}";
if (!is_dir($familyDir)) {
  echo json_encode(['items' => []]);
  exit;
}

$publicBaseUrl = publicBaseUrl();
$items = [];
$files = @scandir($familyDir);
if (is_array($files)) {
  foreach ($files as $name) {
    if (!is_string($name) || $name === '.' || $name === '..') continue;
    if (str_starts_with($name, '.')) continue;
    $path = $familyDir . DIRECTORY_SEPARATOR . $name;
    if (!is_file($path)) continue;
    // Only list expected formats
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ['webp', 'jpg', 'jpeg', 'png', 'gif'], true)) continue;
    $size = @filesize($path);
    if ($size === false) $size = 0;
    $mtime = @filemtime($path);
    $lastModified = $mtime ? gmdate('c', $mtime) : null;
    $key = "famille-{$familleId}/{$name}";
    $url = rtrim($publicBaseUrl, '/') . '/assets-mariage/' . rawurlencode("famille-{$familleId}") . '/' . rawurlencode($name);
    $items[] = [
      'key' => $key,
      'name' => $name,
      'url' => $url,
      'size' => (int)$size,
      'lastModified' => $lastModified,
    ];
  }
}

// Sort by lastModified desc when possible
usort($items, function ($a, $b) {
  $ta = isset($a['lastModified']) && is_string($a['lastModified']) ? strtotime($a['lastModified']) : 0;
  $tb = isset($b['lastModified']) && is_string($b['lastModified']) ? strtotime($b['lastModified']) : 0;
  return $tb <=> $ta;
});

echo json_encode(['items' => $items]);

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

