<?php
declare(strict_types=1);

header('content-type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  // same-origin in practice; keep permissive for safety during early setup
  header('access-control-allow-origin: *');
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
  http_response_code(413);
  echo json_encode(['error' => 'Fichier trop volumineux']);
  exit;
}

$originalName = isset($file['name']) && is_string($file['name']) ? $file['name'] : 'upload';
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
if (!in_array($ext, $allowed, true)) {
  http_response_code(400);
  echo json_encode(['error' => 'Extension de fichier non autorisee']);
  exit;
}
$extWithDot = '.' . $ext;

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

$unique = (string)round(microtime(true) * 1000) . '-' . randomString(6);
$relativeKey = "famille-{$familleId}/{$unique}{$extWithDot}";

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

$destPath = $familyDir . DIRECTORY_SEPARATOR . "{$unique}{$extWithDot}";
if (!move_uploaded_file($file['tmp_name'], $destPath)) {
  http_response_code(500);
  echo json_encode(['error' => 'Cannot store uploaded file']);
  exit;
}

$publicBaseUrl = publicBaseUrl();
$publicUrl = rtrim($publicBaseUrl, '/') . '/assets-mariage/' . rawurlencode("famille-{$familleId}") . '/' . rawurlencode("{$unique}{$extWithDot}");

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

