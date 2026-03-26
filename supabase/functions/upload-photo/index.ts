// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-ignore - import résolu par Deno via jsr:namespace
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Client } from 'jsr:@ein/ssh2-ts';
// For editors that don't include Deno types in this workspace
// deno-lint-ignore no-var
declare const Deno: any;

// Edge Function servant de proxy d’upload vers IONOS via SFTP.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  // In a future iteration, validate an app token from header to associate famille_id
  const appToken = req.headers.get('x-app-token');
  if (!appToken) {
    return json(400, { error: 'Missing x-app-token header' });
  }

  // Parse multipart form to ensure payload looks correct
  let file: File;
  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return json(400, { error: 'Content-Type must be multipart/form-data' });
    }
    const form = await req.formData();
    const parsed = form.get('file');
    if (!(parsed instanceof File)) {
      return json(400, { error: 'Champ "file" manquant' });
    }
    file = parsed;
  } catch (e) {
    return json(400, { error: 'Invalid multipart payload', details: String(e) });
  }

  const authProbe: { called?: boolean; method?: unknown; allowed?: unknown } = { called: false };
  try {
    // ENV
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const PUBLIC_BASE_URL = Deno.env.get('PUBLIC_BASE_URL'); // ex: https://amaurythibaud.be

    // IONOS SFTP
    const SFTP_SERVER = Deno.env.get('SFTP_SERVER');
    const SFTP_PORT = Number(Deno.env.get('SFTP_PORT') || '22');
    const SFTP_USERNAME = Deno.env.get('SFTP_USERNAME');
    const SFTP_PASSWORD = Deno.env.get('SFTP_PASSWORD');
    // Dossier distant (dans le scope utilisateur SFTP) où l'on stocke les photos
    const SFTP_REMOTE_ASSETS_DIR = Deno.env.get('SFTP_REMOTE_ASSETS_DIR') || 'public/assets-mariage';
    // Chemin web (dans l'URL) correspondant au dossier SFTP_remote_assets_dir
    const SFTP_WEB_ASSETS_PATH = Deno.env.get('SFTP_WEB_ASSETS_PATH') || 'assets-mariage';

    const MAX_UPLOAD_BYTES = Number(Deno.env.get('MAX_UPLOAD_BYTES') || '10485760'); // 10MB default

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Missing Supabase service config' });
    if (!PUBLIC_BASE_URL) {
      return json(500, { error: 'PUBLIC_BASE_URL manquant (ex: https://domaine.tld)' });
    }
    if (!SFTP_SERVER || !SFTP_USERNAME || !SFTP_PASSWORD || !Number.isFinite(SFTP_PORT) || SFTP_PORT <= 0) {
      return json(500, { error: 'Secrets SFTP manquants (voir README)' });
    }

    // Taille: limiter
    if (file.size > MAX_UPLOAD_BYTES) {
      return json(413, { error: `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB)` });
    }

    // Valider le token et récupérer famille_id
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: fam, error: famErr } = await supabase.rpc('get_famille_by_token', { p_token: appToken });
    if (famErr) return json(401, { error: 'Token invalide', details: famErr.message });
    const famille = Array.isArray(fam) ? fam[0] : fam;
    if (!famille?.id) return json(401, { error: 'Token invalide' });

    const familleId = famille.id as number;

    // Construire la clé d’objet
    const ext = safeExt(file.name);
    if (!ext) {
      return json(400, { error: 'Extension de fichier non autorisee' });
    }
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const key = `famille-${familleId}/${unique}${ext}`;

    // Upload sur IONOS via SFTP
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const remoteFilePath = `${normalizeRemotePath(SFTP_REMOTE_ASSETS_DIR)}/${key}`;
    const remoteFamilyDir = `${normalizeRemotePath(SFTP_REMOTE_ASSETS_DIR)}/famille-${familleId}`;

    const conn = new Client();
    // Si IONOS demande un keyboard-interactive, répondre avec le password.
    try {
      conn.on('keyboard-interactive', (_name: string, _instructions: string, _lang: string, prompts: Array<{ prompt: string; echo: boolean }>, finish: (responses: string[]) => void) => {
        authProbe.called = true;
        authProbe.method = 'keyboard-interactive';
        authProbe.allowed = ['keyboard-interactive'];
        finish(prompts.map(() => SFTP_PASSWORD));
      });

      await conn.connect({
        host: SFTP_SERVER,
        port: SFTP_PORT,
        username: SFTP_USERNAME,
        password: SFTP_PASSWORD,
        tryKeyboard: true,
      });

      const sftp = await conn.sftp();
      await ensureRemoteDir(sftp, remoteFamilyDir);
      await sftp.writeFile(remoteFilePath, fileBytes);
    } finally {
      try { conn.end(); } catch {}
    }

    const publicUrl = buildSftpPublicUrl(PUBLIC_BASE_URL, SFTP_WEB_ASSETS_PATH, key);
    return json(200, { path: key, publicUrl, familleId });
  } catch (e) {
    const details = extractErrorDetails(e);
    const msg = typeof details?.message === 'string' ? details.message : String(e || '');
    const status = msg.includes('authentication') || msg.includes('Auth') ? 502 : 500;
    // Expose un minimum d'info d'auth pour debug (sans secrets)
    return json(status, { error: 'SFTP upload failed', details, auth: authProbe });
  }
});

// Utils
function toAmzDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function safeExt(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  const ext = name.slice(i).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '';
}

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const enc =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
  const hash = await (crypto as any).subtle.digest('SHA-256', enc);
  return toHex(new Uint8Array(hash as ArrayBuffer));
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const raw = key instanceof Uint8Array ? key : new Uint8Array(key);
  const cryptoKey = await (crypto as any).subtle.importKey(
    'raw',
    raw as any,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await (crypto as any).subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return sig as ArrayBuffer;
}

async function hmacHex(key: ArrayBuffer | Uint8Array, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return toHex(new Uint8Array(sig));
}

async function getSignatureKey(secretKey: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmac(kDate, regionName);
  const kService = await hmac(kRegion, serviceName);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}

function buildPublicUrl(options: { bucket: string; key: string; baseUrl?: string | null }): string {
  const { bucket, key, baseUrl } = options;
  if (baseUrl) {
    const separator = baseUrl.endsWith('/') ? '' : '/';
    return `${baseUrl}${separator}${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  return `s3://${bucket}/${key}`;
}

function normalizeRemotePath(path: string): string {
  // SFTP attend un chemin Unix (slash).
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function buildSftpPublicUrl(publicBaseUrl: string, webAssetsPath: string, key: string): string {
  const base = publicBaseUrl.replace(/\/+$/, '');
  const assetsPath = webAssetsPath.replace(/^\/+|\/+$/g, '');
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${base}/${assetsPath}/${encodedKey}`;
}

async function ensureRemoteDir(sftp: any, dirPath: string): Promise<void> {
  const normalized = normalizeRemotePath(dirPath);
  const parts = normalized.split('/').filter(Boolean);
  let current = normalized.startsWith('/') ? '/' : '';

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    // sftp.exists évite de dépendre du message d'erreur de mkdir si le dossier existe déjà.
    if (!(await sftp.exists(current))) {
      await sftp.mkdir(current);
    }
  }
}

// Note: on utilise l'event `keyboard-interactive` plutôt que `authHandler`,
// car `authHandler` ne semble pas être invoqué dans l'environnement Edge.

function extractErrorDetails(err: unknown): any {
  if (err instanceof Error) {
    const anyErr = err as any;
    const extra: Record<string, unknown> = {};
    for (const key of Object.keys(anyErr)) {
      if (key === 'stack') continue;
      extra[key] = anyErr[key];
    }
    return {
      name: err.name,
      message: err.message,
      ...extra,
      stack: err.stack ? truncate(err.stack) : undefined,
    };
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    return obj;
  }
  return { message: typeof err === 'string' ? err : String(err) };
}

function truncate(value: string, max = 800): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}
