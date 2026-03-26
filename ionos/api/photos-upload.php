<?php
declare(strict_types=1);

if (!function_exists('str_starts_with')) {
  function str_starts_with(string $haystack, string $needle): bool {
    return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
  }
}

header('content-type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  // Same-origin in practice; keep headers explicit (avoid wildcard).
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

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Champ "file" manquant']);
  exit;
}

$file = $_FILES['file'];
if (!isset($file['tmp_name']) || !is_string($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Upload invalide']);
  exit;
}

// Limit ~10MB by default (align with edge defaults)
$maxBytes = 10 * 1024 * 1024;
$size = isset($file['size']) ? (int)$file['size'] : 0;
if ($size > $maxBytes) {
  // Still allow very large originals if we can decode & resize, but avoid abuse.
  http_response_code(413);
  echo json_encode(['error' => 'Fichier trop volumineux (max 10MB)']);
  exit;
}

// Detect MIME from content (avoid trusting client extension)
$tmpPath = $file['tmp_name'];
$mime = detectMime($tmpPath);
$allowedMime = [
  'image/jpeg' => 'jpg',
  'image/png'  => 'png',
  'image/webp' => 'webp',
  'image/gif'  => 'gif',
];
if (!isset($allowedMime[$mime])) {
  http_response_code(400);
  echo json_encode(['error' => 'Format non supporte', 'details' => $mime ?: 'unknown']);
  exit;
}

// Validate token via Supabase RPC (anon key is public anyway)
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

// Renaming strategy:
// - folder: famille-<id>/
// - filename: yyyyMMdd-HHmmss_<8chars>_<8hex>.webp (or jpg fallback)
$ts = gmdate('Ymd-His');
$rand = randomString(8);
$hash8 = substr(sha1_file($tmpPath) ?: sha1($rand . $ts), 0, 8);

// Decode + resize/convert (strip metadata by re-encoding)
$maxDim = 2048; // max width/height
$qualityWebp = 82;
$qualityJpeg = 85;
$conversion = processImage($tmpPath, $mime, $maxDim, $qualityWebp, $qualityJpeg);
if ($conversion['ok'] !== true) {
  http_response_code(400);
  echo json_encode(['error' => 'Image invalide', 'details' => $conversion['error'] ?? 'decode failed']);
  exit;
}
$outExt = $conversion['ext']; // webp or jpg
$filename = "{$ts}_{$rand}_{$hash8}.{$outExt}";
$relativeKey = "famille-{$familleId}/{$filename}";

// Store under public/assets-mariage/
$baseDir = realpath(__DIR__ . '/../assets-mariage');
if ($baseDir === false) {
  // If folder doesn't exist yet, try to create
  $target = __DIR__ . '/../assets-mariage';
  if (!is_dir($target) && !mkdir($target, 0775, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Cannot create assets-mariage directory']);
    exit;
  }
  $baseDir = realpath($target);
}

$familyDir = $baseDir . DIRECTORY_SEPARATOR . "famille-{$familleId}";
if (!is_dir($familyDir) && !mkdir($familyDir, 0775, true)) {
  http_response_code(500);
  echo json_encode(['error' => 'Cannot create family directory']);
  exit;
}

$destPath = $familyDir . DIRECTORY_SEPARATOR . $filename;
if (!writeFileBytes($destPath, $conversion['bytes'])) {
  http_response_code(500);
  echo json_encode(['error' => 'Cannot store uploaded file']);
  exit;
}
@chmod($destPath, 0664);

$publicBaseUrl = publicBaseUrl();
$publicUrl = rtrim($publicBaseUrl, '/') . '/assets-mariage/' . rawurlencode("famille-{$familleId}") . '/' . rawurlencode($filename);

echo json_encode([
  'path' => $relativeKey,
  'publicUrl' => $publicUrl,
  'familleId' => $familleId,
]);

function publicBaseUrl(): string {
  $host = $_SERVER['HTTP_HOST'] ?? '';
  $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  if ($host) return "{$proto}://{$host}";
  return 'https://amaurythibaud.be';
}

function allowedOrigin(): string {
  // Best-effort: reflect same origin when available; otherwise fallback to current host.
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if (is_string($origin) && $origin !== '') {
    return $origin;
  }
  return publicBaseUrl();
}

function isValidToken(string $token): bool {
  // Keep loose enough to not break existing tokens, but reject obvious garbage.
  if (strlen($token) < 4 || strlen($token) > 128) return false;
  return (bool)preg_match('/^[A-Za-z0-9_-]+$/', $token);
}

function detectMime(string $path): string {
  if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo) {
      $mime = finfo_file($finfo, $path);
      finfo_close($finfo);
      if (is_string($mime)) return $mime;
    }
  }
  $info = @getimagesize($path);
  if (is_array($info) && isset($info['mime']) && is_string($info['mime'])) {
    return $info['mime'];
  }
  return '';
}

function processImage(string $path, string $mime, int $maxDim, int $qWebp, int $qJpeg): array {
  if (!function_exists('imagecreatetruecolor')) {
    return ['ok' => false, 'error' => 'GD not available'];
  }

  $src = null;
  if ($mime === 'image/jpeg' && function_exists('imagecreatefromjpeg')) $src = @imagecreatefromjpeg($path);
  if ($mime === 'image/png'  && function_exists('imagecreatefrompng'))  $src = @imagecreatefrompng($path);
  if ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) $src = @imagecreatefromwebp($path);
  if ($mime === 'image/gif'  && function_exists('imagecreatefromgif'))  $src = @imagecreatefromgif($path);

  if (!is_resource($src) && !($src instanceof GdImage)) {
    return ['ok' => false, 'error' => 'Cannot decode image'];
  }

  $w = imagesx($src);
  $h = imagesy($src);
  if ($w <= 0 || $h <= 0) {
    imagedestroy($src);
    return ['ok' => false, 'error' => 'Invalid dimensions'];
  }

  $scale = min(1.0, $maxDim / max($w, $h));
  $newW = (int)max(1, floor($w * $scale));
  $newH = (int)max(1, floor($h * $scale));

  $dst = $src;
  if ($scale < 1.0) {
    $dst = imagecreatetruecolor($newW, $newH);
    // Transparent background for PNG/GIF
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefilledrectangle($dst, 0, 0, $newW, $newH, $transparent);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $w, $h);
    imagedestroy($src);
  }

  // Encode output (prefer webp to reduce size)
  $bytes = '';
  $ext = 'jpg';
  if (function_exists('imagewebp')) {
    $ext = 'webp';
    ob_start();
    imagewebp($dst, null, $qWebp);
    $bytes = (string)ob_get_clean();
  } else {
    // Fallback to JPEG
    ob_start();
    imagejpeg($dst, null, $qJpeg);
    $bytes = (string)ob_get_clean();
    $ext = 'jpg';
  }

  if ($dst !== $src && (is_resource($dst) || $dst instanceof GdImage)) {
    imagedestroy($dst);
  } elseif (is_resource($dst) || $dst instanceof GdImage) {
    imagedestroy($dst);
  }

  if ($bytes === '') {
    return ['ok' => false, 'error' => 'Encoding failed'];
  }

  return ['ok' => true, 'bytes' => $bytes, 'ext' => $ext];
}

function writeFileBytes(string $path, string $bytes): bool {
  $dir = dirname($path);
  if (!is_dir($dir) && !mkdir($dir, 0775, true)) return false;
  $tmp = $path . '.tmp-' . randomString(6);
  $ok = file_put_contents($tmp, $bytes, LOCK_EX);
  if ($ok === false) return false;
  return rename($tmp, $path);
}

function getSupabaseMeta(string $name): ?string {
  // We keep these values in a simple JSON file deployed alongside the API.
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

function randomString(int $len): string {
  $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  $out = '';
  for ($i = 0; $i < $len; $i++) {
    $out .= $chars[random_int(0, strlen($chars) - 1)];
  }
  return $out;
}

