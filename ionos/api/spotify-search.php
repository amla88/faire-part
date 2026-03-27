<?php
declare(strict_types=1);

/**
 * Recherche de titres Spotify (Client Credentials) — réservé aux invités avec jeton valide.
 * Secrets : variables d’environnement SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
 * ou clés spotify-client-id / spotify-client-secret dans supabase-meta.json (déploiement IONOS).
 */

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

$q = isset($payload['q']) ? trim((string)$payload['q']) : '';
if ($q === '' || strlen($q) > 200) {
  http_response_code(400);
  echo json_encode(['error' => 'Requête de recherche invalide ou trop longue']);
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

$clientId = getenvSpotify('SPOTIFY_CLIENT_ID', 'spotify-client-id');
$clientSecret = getenvSpotify('SPOTIFY_CLIENT_SECRET', 'spotify-client-secret');
if (!$clientId || !$clientSecret) {
  http_response_code(503);
  echo json_encode(['error' => 'Spotify API non configurée sur le serveur']);
  exit;
}

$access = spotifyGetAccessToken($clientId, $clientSecret);
if (!$access) {
  http_response_code(502);
  echo json_encode(['error' => 'Impossible d’obtenir un jeton Spotify']);
  exit;
}

$limit = 15;
$url = 'https://api.spotify.com/v1/search?' . http_build_query([
  'q' => $q,
  'type' => 'track',
  'limit' => $limit,
  'market' => 'FR',
]);

$searchRes = httpJson('GET', $url, [
  'Authorization: Bearer ' . $access,
]);

if (!is_array($searchRes)) {
  http_response_code(502);
  echo json_encode(['error' => 'Réponse Spotify invalide']);
  exit;
}

if (isset($searchRes['error'])) {
  $msg = is_array($searchRes['error']) && isset($searchRes['error']['message'])
    ? (string)$searchRes['error']['message']
    : 'Erreur Spotify';
  http_response_code(502);
  echo json_encode(['error' => $msg]);
  exit;
}

$tracksOut = [];
$items = $searchRes['tracks']['items'] ?? null;
if (is_array($items)) {
  foreach ($items as $tr) {
    if (!is_array($tr)) {
      continue;
    }
    $tid = isset($tr['id']) ? (string)$tr['id'] : '';
    if ($tid === '') {
      continue;
    }
    $name = isset($tr['name']) ? (string)$tr['name'] : '';
    $artists = [];
    if (isset($tr['artists']) && is_array($tr['artists'])) {
      foreach ($tr['artists'] as $ar) {
        if (is_array($ar) && isset($ar['name'])) {
          $artists[] = ['name' => (string)$ar['name']];
        }
      }
    }
    $artistNames = [];
    foreach ($artists as $a) {
      if (isset($a['name'])) {
        $artistNames[] = $a['name'];
      }
    }
    $albumName = '';
    $albumImage = null;
    if (isset($tr['album']) && is_array($tr['album'])) {
      $albumName = isset($tr['album']['name']) ? (string)$tr['album']['name'] : '';
      $imgs = $tr['album']['images'] ?? null;
      if (is_array($imgs) && count($imgs) > 0) {
        // plus petite image en premier souvent ; prendre la dernière (thumb) ou [1]
        $pick = $imgs[count($imgs) - 1] ?? $imgs[0];
        if (is_array($pick) && isset($pick['url'])) {
          $albumImage = (string)$pick['url'];
        }
      }
    }
    $ext = $tr['external_urls'] ?? null;
    $extUrl = (is_array($ext) && isset($ext['spotify'])) ? (string)$ext['spotify'] : '';
    $preview = isset($tr['preview_url']) && is_string($tr['preview_url']) ? $tr['preview_url'] : null;
    $dur = isset($tr['duration_ms']) ? (int)$tr['duration_ms'] : null;
    $uri = isset($tr['uri']) ? (string)$tr['uri'] : ('spotify:track:' . $tid);

    $tracksOut[] = [
      'id' => $tid,
      'uri' => $uri,
      'name' => $name,
      'artists' => $artists,
      'artist_label' => implode(', ', $artistNames),
      'album_name' => $albumName,
      'album_image_url' => $albumImage,
      'duration_ms' => $dur,
      'external_url' => $extUrl,
      'preview_url' => $preview,
    ];
  }
}

header('access-control-allow-origin: ' . allowedOrigin());
echo json_encode(['tracks' => $tracksOut]);

// --- helpers ---

function getenvSpotify(string $envName, string $metaKey): ?string {
  $e = getenv($envName);
  if (is_string($e) && trim($e) !== '') {
    return trim($e);
  }
  return getSupabaseMeta($metaKey);
}

function spotifyGetAccessToken(string $clientId, string $clientSecret): ?string {
  $cacheFile = __DIR__ . '/.spotify-token-cache.json';
  $now = time();
  if (is_file($cacheFile)) {
    $raw = @file_get_contents($cacheFile);
    if (is_string($raw)) {
      $j = json_decode($raw, true);
      if (is_array($j) && isset($j['access_token'], $j['expires_at']) && is_numeric($j['expires_at'])) {
        if ($now < ((int)$j['expires_at']) - 60) {
          return (string)$j['access_token'];
        }
      }
    }
  }

  $body = http_build_query(['grant_type' => 'client_credentials']);
  $auth = base64_encode($clientId . ':' . $clientSecret);
  $res = httpJson('POST', 'https://accounts.spotify.com/api/token', [
    'Authorization: Basic ' . $auth,
    'Content-Type: application/x-www-form-urlencoded',
  ], $body);

  if (!is_array($res) || !isset($res['access_token'])) {
    return null;
  }
  $tok = (string)$res['access_token'];
  $expiresIn = isset($res['expires_in']) ? (int)$res['expires_in'] : 3600;
  $payload = json_encode([
    'access_token' => $tok,
    'expires_at' => $now + $expiresIn,
  ]);
  if ($payload !== false) {
    @file_put_contents($cacheFile, $payload, LOCK_EX);
  }
  return $tok;
}

/**
 * @return array|null|mixed
 */
function httpJson(string $method, string $url, array $headers, ?string $body = null) {
  $opts = [
    'http' => [
      'method' => $method,
      'header' => implode("\r\n", $headers),
      'timeout' => 15,
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

function isValidToken(string $token): bool {
  if (strlen($token) < 4 || strlen($token) > 128) {
    return false;
  }
  return (bool)preg_match('/^[A-Za-z0-9_-]+$/', $token);
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

function rpcGetFamilleByToken(string $supabaseUrl, string $anonKey, string $token): ?array {
  $endpoint = rtrim($supabaseUrl, '/') . '/rest/v1/rpc/get_famille_by_token';
  $payload = json_encode(['p_token' => $token]);
  if ($payload === false) {
    return null;
  }

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
  if ($res === false) {
    return null;
  }

  $decoded = json_decode($res, true);
  if (is_array($decoded) && isset($decoded[0]) && is_array($decoded[0])) {
    return $decoded[0];
  }
  if (is_array($decoded)) {
    return $decoded;
  }
  return null;
}
