<?php
declare(strict_types=1);

/**
 * Ajoute des titres Spotify à une playlist fixe (compte Spotify des mariés).
 *
 * Contrairement à spotify-search.php (Client Credentials), modifier une playlist
 * exige un jeton « utilisateur » obtenu via refresh_token OAuth.
 *
 * Configuration (serveur) — au choix :
 * - Variables d’environnement : SPOTIFY_REFRESH_TOKEN, SPOTIFY_PLAYLIST_ID
 *   (+ SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET, déjà utilisés pour la recherche)
 * - Fichier api/spotify-meta.json (gitignored) : clés spotify-refresh-token, spotify-playlist-id
 *
 * Obtenir un refresh_token (une fois) :
 * 1. Dashboard Spotify Developer : créer une app, ajouter une Redirect URI (ex. http://127.0.0.1:8080/callback).
 * 2. Ouvrir dans le navigateur (adapter client_id, redirect_uri) :
 *    https://accounts.spotify.com/authorize?response_type=code&client_id=CLIENT_ID&scope=playlist-modify-public%20playlist-modify-private&redirect_uri=REDIRECT_URI
 * 3. Échanger le ?code= reçu :
 *    POST https://accounts.spotify.com/api/token
 *    grant_type=authorization_code&code=...&redirect_uri=...
 *    Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
 * 4. Conserver refresh_token (et l’ID de playlist : extrait de l’URL open.spotify.com/playlist/XXXX).
 *
 * Sécurité : header Authorization: Bearer <JWT Supabase> (même session que la connexion admin).
 */

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
if (!is_array($payload) || !isset($payload['uris']) || !is_array($payload['uris'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Corps JSON attendu : { "uris": ["spotify:track:…", …] }']);
  exit;
}

$uris = [];
foreach ($payload['uris'] as $u) {
  if (!is_string($u)) {
    continue;
  }
  $u = trim($u);
  if (preg_match('/^spotify:track:[a-zA-Z0-9]+$/', $u)) {
    $uris[] = $u;
  }
}
$uris = array_values(array_unique($uris));
if (count($uris) === 0) {
  http_response_code(400);
  echo json_encode(['error' => 'Aucun URI spotify:track: valide']);
  exit;
}
if (count($uris) > 100) {
  http_response_code(400);
  echo json_encode(['error' => 'Maximum 100 titres par requête (limite Spotify)']);
  exit;
}

$clientId = resolveSpotifySecret('SPOTIFY_CLIENT_ID', 'spotify-client-id');
$clientSecret = resolveSpotifySecret('SPOTIFY_CLIENT_SECRET', 'spotify-client-secret');
$refreshToken = resolvePlaylistSecret('SPOTIFY_REFRESH_TOKEN', 'spotify-refresh-token');
$playlistId = resolvePlaylistSecret('SPOTIFY_PLAYLIST_ID', 'spotify-playlist-id');

if (!$clientId || !$clientSecret) {
  http_response_code(503);
  echo json_encode(['error' => 'SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET manquants']);
  exit;
}
if (!$refreshToken || !$playlistId) {
  http_response_code(503);
  echo json_encode([
    'error' => 'Playlist Spotify non configurée sur le serveur',
    'hint' => 'Définissez SPOTIFY_REFRESH_TOKEN et SPOTIFY_PLAYLIST_ID (variables d’environnement ou spotify-meta.json : spotify-refresh-token, spotify-playlist-id). Voir l’en-tête de spotify-playlist-add.php.',
  ]);
  exit;
}

$userAccess = spotifyUserAccessFromRefresh($clientId, $clientSecret, $refreshToken);
if (!$userAccess) {
  http_response_code(502);
  echo json_encode(['error' => 'Impossible de rafraîchir le jeton Spotify utilisateur']);
  exit;
}

$addRes = spotifyAddTracksToPlaylist($userAccess, $playlistId, $uris);
if (!is_array($addRes)) {
  http_response_code(502);
  echo json_encode([
    'error' => 'Échec ajout à la playlist Spotify',
    'detail' => spotifyLastHttpStatus() > 0 ? 'HTTP ' . spotifyLastHttpStatus() : null,
  ]);
  exit;
}

if (isset($addRes['error'])) {
  $msg = is_array($addRes['error']) && isset($addRes['error']['message'])
    ? (string)$addRes['error']['message']
    : 'Erreur Spotify';
  http_response_code(502);
  echo json_encode(['error' => $msg]);
  exit;
}

header('access-control-allow-origin: ' . allowedOrigin());
echo json_encode([
  'ok' => true,
  'added' => count($uris),
  'snapshot_id' => $addRes['snapshot_id'] ?? null,
]);

// --- helpers ---

function spotifyLastHttpStatus(): int {
  return (int)($GLOBALS['__spotify_playlist_http_status'] ?? 0);
}

function setSpotifyLastHttpStatus(int $code): void {
  $GLOBALS['__spotify_playlist_http_status'] = $code;
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
  $status = 0;
  if (isset($http_response_header[0]) && is_string($http_response_header[0])) {
    if (preg_match('/\bHTTP\/\S+\s+(\d{3})\b/', $http_response_header[0], $m)) {
      $status = (int)$m[1];
    }
  }
  setSpotifyLastHttpStatus($status);
  if ($res === false) {
    return null;
  }
  $decoded = json_decode($res, true);
  return is_array($decoded) ? $decoded : null;
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

function resolveSpotifySecret(string $envName, string $metaKey): ?string {
  foreach ([$_ENV[$envName] ?? null, $_SERVER[$envName] ?? null] as $v) {
    if (is_string($v) && trim($v) !== '') {
      return trim($v);
    }
  }
  $g = getenv($envName);
  if ($g !== false && is_string($g) && trim($g) !== '') {
    return trim($g);
  }
  $fromMain = getSupabaseMeta($metaKey);
  if (is_string($fromMain) && trim($fromMain) !== '') {
    return trim($fromMain);
  }
  return getSpotifyMetaFile($metaKey);
}

function resolvePlaylistSecret(string $envName, string $metaKey): ?string {
  foreach ([$_ENV[$envName] ?? null, $_SERVER[$envName] ?? null] as $v) {
    if (is_string($v) && trim($v) !== '') {
      return trim($v);
    }
  }
  $g = getenv($envName);
  if ($g !== false && is_string($g) && trim($g) !== '') {
    return trim($g);
  }
  return getSpotifyMetaFile($metaKey);
}

function getSpotifyMetaFile(string $metaKey): ?string {
  static $cache = null;
  if ($cache === null) {
    $path = __DIR__ . '/spotify-meta.json';
    if (!is_file($path)) {
      $cache = [];
    } else {
      $raw = file_get_contents($path);
      $data = is_string($raw) ? json_decode($raw, true) : null;
      $cache = is_array($data) ? $data : [];
    }
  }
  if (!isset($cache[$metaKey]) || !is_string($cache[$metaKey])) {
    return null;
  }
  $v = trim($cache[$metaKey]);
  return $v !== '' ? $v : null;
}

function supabaseJwtValidUser(string $supabaseUrl, string $anonKey, string $jwt): bool {
  $url = rtrim($supabaseUrl, '/') . '/auth/v1/user';
  $res = httpJson('GET', $url, [
    'apikey: ' . $anonKey,
    'Authorization: Bearer ' . $jwt,
  ], null);
  return is_array($res) && isset($res['id']);
}

function spotifyUserAccessFromRefresh(string $clientId, string $clientSecret, string $refreshToken): ?string {
  $body = http_build_query([
    'grant_type' => 'refresh_token',
    'refresh_token' => $refreshToken,
  ]);
  $auth = base64_encode($clientId . ':' . $clientSecret);
  $res = httpJson('POST', 'https://accounts.spotify.com/api/token', [
    'Authorization: Basic ' . $auth,
    'Content-Type: application/x-www-form-urlencoded',
  ], $body);
  if (!is_array($res) || !isset($res['access_token'])) {
    return null;
  }
  return (string)$res['access_token'];
}

/**
 * @param list<string> $uris
 * @return array<string, mixed>|null
 */
function spotifyAddTracksToPlaylist(string $access, string $playlistId, array $uris): ?array {
  $pid = preg_replace('/[^a-zA-Z0-9]/', '', $playlistId);
  if ($pid === '') {
    return null;
  }
  $url = 'https://api.spotify.com/v1/playlists/' . rawurlencode($pid) . '/tracks';
  $body = json_encode(['uris' => array_values($uris)], JSON_UNESCAPED_SLASHES);
  if ($body === false) {
    return null;
  }
  return httpJson('POST', $url, [
    'Authorization: Bearer ' . $access,
    'Content-Type: application/json',
  ], $body);
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
