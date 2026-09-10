<?php
declare(strict_types=1);

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
if (!is_string($token) || $token === '') {
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

$message = isset($payload['message']) && is_string($payload['message']) ? trim($payload['message']) : '';
if (strlen($message) < 8) {
  http_response_code(400);
  echo json_encode(['error' => 'Message trop court']);
  exit;
}
if (strlen($message) > 4000) {
  http_response_code(400);
  echo json_encode(['error' => 'Message trop long']);
  exit;
}

$contactEmail = isset($payload['contactEmail']) && is_string($payload['contactEmail'])
  ? trim($payload['contactEmail'])
  : '';
$contactEmail = str_replace(["\r", "\n"], '', $contactEmail);
if ($contactEmail !== '' && !filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['error' => 'Adresse e-mail invalide']);
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

$names = [];
foreach ($personnes as $row) {
  if (!is_array($row)) continue;
  $prenom = isset($row['prenom']) && is_string($row['prenom']) ? trim($row['prenom']) : '';
  $nom = isset($row['nom']) && is_string($row['nom']) ? trim($row['nom']) : '';
  $label = trim($prenom . ' ' . $nom);
  if ($label !== '') $names[] = $label;
}

$to = 'larive.amaury@gmail.com';
$subject = 'Demande de modification RSVP — famille #' . $familleId;
$lines = [
  'Une famille demande une modification de ses réponses (période RSVP close).',
  '',
  'Famille id: ' . $familleId,
  'Membres: ' . (count($names) > 0 ? implode(', ', $names) : '(aucun)'),
  'E-mail de contact: ' . ($contactEmail !== '' ? $contactEmail : '(non renseigné)'),
  '',
  'Message:',
  $message,
];
$body = implode("\n", $lines);

$from = 'Faire-part <noreply@amaurythibaud.be>';
$headerLines = [
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'From: ' . $from,
];
if ($contactEmail !== '') {
  $headerLines[] = 'Reply-To: ' . $contactEmail;
}
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$ok = @mail($to, $encodedSubject, $body, implode("\r\n", $headerLines), '-f noreply@amaurythibaud.be');
if (!$ok) {
  http_response_code(500);
  echo json_encode(['error' => 'Envoi du courriel impossible']);
  exit;
}

echo json_encode(['ok' => true]);

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
