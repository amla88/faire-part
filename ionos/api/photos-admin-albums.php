<?php
declare(strict_types=1);

/**
 * Liste les albums photo (dossiers personne-*) pour une liste d’IDs personnes.
 * Authentification : Authorization: Bearer <JWT session Supabase> (même mécanisme que spotify-playlist-add.php).
 */

if (!function_exists('str_starts_with')) {
  function str_starts_with(string $haystack, string $needle): bool {
    return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
  }
}

header('content-type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  header('access-control-allow-origin: ' . allowedOrigin());
  header('access-control-allow-headers: content-type, authorization');
  header('access-control-allow-methods: POST, OPTIONS');
  http_response_code(204);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method Not Allowed']);
  exit;
}

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!is_string($authHeader) || !preg_match('/^Bearer\s+(\S+)/i', $authHeader, $m)) {
  http_response_code(401);
  echo json_encode(['error' => 'Authorization Bearer (session admin) requis']);
  exit;
}
$supabaseJwt = $m[1];

$supabaseUrl = getSupabaseMeta('supabase-url');
$supabaseAnonKey = getSupabaseMeta('supabase-anon-key');
if (!$supabaseUrl || !$supabaseAnonKey) {
  http_response_code(500);
  echo json_encode(['error' => 'Supabase config missing on server']);
  exit;
}

if (!supabaseJwtValidUser($supabaseUrl, $supabaseAnonKey, $supabaseJwt)) {
  http_response_code(401);
  echo json_encode(['error' => 'Session admin invalide ou expirée']);
  exit;
}

$raw = file_get_contents('php://input');
$payload = is_string($raw) ? json_decode($raw, true) : null;
if (!is_array($payload) || !isset($payload['personneIds']) || !is_array($payload['personneIds'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Corps JSON attendu : { "personneIds": [1, 2, …] }']);
  exit;
}

$personneIds = [];
foreach ($payload['personneIds'] as $v) {
  if (is_int($v)) {
    $n = $v;
  } elseif (is_string($v) && ctype_digit($v)) {
    $n = (int)$v;
  } else {
    continue;
  }
  if ($n > 0) {
    $personneIds[] = $n;
  }
}
$personneIds = array_values(array_unique($personneIds));
if (count($personneIds) > 400) {
  http_response_code(400);
  echo json_encode(['error' => 'Maximum 400 personnes par requête']);
  exit;
}

$baseDir = realpath(__DIR__ . '/../assets-mariage');
if ($baseDir === false) {
  http_response_code(200);
  header('access-control-allow-origin: ' . allowedOrigin());
  echo json_encode(['albums' => []], JSON_UNESCAPED_SLASHES);
  exit;
}

$publicBaseUrl = publicBaseUrl();
$albums = [];

foreach ($personneIds as $personneId) {
  $personDir = $baseDir . DIRECTORY_SEPARATOR . "personne-{$personneId}";
  if (!is_dir($personDir)) {
    continue;
  }
  $items = [];
  clearstatcache(true, $personDir);
  $files = @scandir($personDir);
  if (!is_array($files)) {
    continue;
  }
  foreach ($files as $name) {
    if (!is_string($name) || $name === '.' || $name === '..') {
      continue;
    }
    if (str_starts_with($name, '.')) {
      continue;
    }
    $path = $personDir . DIRECTORY_SEPARATOR . $name;
    if (!is_file($path)) {
      continue;
    }
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ['webp', 'jpg', 'jpeg', 'png', 'gif'], true)) {
      continue;
    }
    $size = @filesize($path);
    if ($size === false) {
      $size = 0;
    }
    $mtime = @filemtime($path);
    $lastModified = $mtime ? gmdate('c', $mtime) : null;
    $url = rtrim($publicBaseUrl, '/') . '/assets-mariage/' . rawurlencode("personne-{$personneId}") . '/' . rawurlencode($name);
    if ($mtime) {
      $url .= '?v=' . (string)$mtime;
    }
    $items[] = [
      'key' => "personne-{$personneId}/{$name}",
      'name' => (string)$name,
      'url' => $url,
      'size' => (int)$size,
      'lastModified' => $lastModified,
    ];
  }

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

  if (count($items) > 0) {
    $albums[] = ['personneId' => $personneId, 'items' => $items];
  }
}

$jsonFlags = JSON_UNESCAPED_SLASHES;
if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
  $jsonFlags |= constant('JSON_INVALID_UTF8_SUBSTITUTE');
}
$out = json_encode(['albums' => $albums], $jsonFlags);
if (!is_string($out) || $out === '') {
  http_response_code(500);
  echo json_encode(['error' => 'json_encode failed', 'albums' => []], $jsonFlags);
  exit;
}

http_response_code(200);
header('access-control-allow-origin: ' . allowedOrigin());
echo $out;

// ——— helpers (alignés sur photos-list.php / spotify-playlist-add.php) ———

function publicBaseUrl(): string {
  $host = $_SERVER['HTTP_HOST'] ?? '';
  $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  if ($host) {
    return "{$proto}://{$host}";
  }
  return 'https://amaurythibaud.be';
}

function allowedOrigin(): string {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if (is_string($origin) && $origin !== '') {
    return $origin;
  }
  return publicBaseUrl();
}

function getSupabaseMeta(string $name): ?string {
  $path = __DIR__ . '/supabase-meta.json';
  if (!is_file($path)) {
    return null;
  }
  $raw = file_get_contents($path);
  if ($raw === false) {
    return null;
  }
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data[$name]) || !is_string($data[$name])) {
    return null;
  }
  $value = trim($data[$name]);
  return $value !== '' ? $value : null;
}

function supabaseJwtValidUser(string $supabaseUrl, string $anonKey, string $jwt): bool {
  $url = rtrim($supabaseUrl, '/') . '/auth/v1/user';
  $res = httpJson('GET', $url, [
    'apikey: ' . $anonKey,
    'Authorization: Bearer ' . $jwt,
  ], null);
  return is_array($res) && isset($res['id']);
}

/**
 * @return array|null|mixed
 */
function httpJson(string $method, string $url, array $headers, ?string $body = null) {
  $opts = [
    'http' => [
      'method' => $method,
      'header' => implode("\r\n", $headers),
      'timeout' => 20,
      'ignore_errors' => true,
    ],
  ];
  if ($body !== null && $body !== '') {
    $opts['http']['content'] = $body;
  }
  $ctx = stream_context_create($opts);
  $res = @file_get_contents($url, false, $ctx);
  if ($res === false) {
    return null;
  }
  $decoded = json_decode($res, true);
  return is_array($decoded) ? $decoded : null;
}
