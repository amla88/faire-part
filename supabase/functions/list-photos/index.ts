// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-ignore Supabase client résolu via JSR au runtime Deno
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Client } from 'jsr:@ein/ssh2-ts';

// deno-lint-ignore no-var
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
  });
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

type ListedObject = {
  key: string;
  size: number;
  lastModified: string;
  eTag?: string;
};

type OracleConfig = {
  namespace: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicBaseUrl?: string;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type ListResponse = {
  items: Array<{
    key: string;
    name: string;
    url: string;
    size: number;
    lastModified: string;
  }>;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const token = req.headers.get('x-app-token');
  if (!token) {
    return json(400, { error: 'Missing x-app-token header' });
  }

  const supabaseConfig = readSupabaseConfig();
  if (!supabaseConfig) {
    return json(500, { error: 'Supabase configuration missing' });
  }

  // IONOS SFTP (remplace l'ancienne logique OCI/S3)
  const PUBLIC_BASE_URL = Deno.env.get('PUBLIC_BASE_URL'); // ex: https://amaurythibaud.be
  const SFTP_SERVER = Deno.env.get('SFTP_SERVER');
  const SFTP_PORT = Number(Deno.env.get('SFTP_PORT') || '22');
  const SFTP_USERNAME = Deno.env.get('SFTP_USERNAME');
  const SFTP_PASSWORD = Deno.env.get('SFTP_PASSWORD');
  const SFTP_REMOTE_ASSETS_DIR = Deno.env.get('SFTP_REMOTE_ASSETS_DIR') || 'public/assets-mariage';
  const SFTP_WEB_ASSETS_PATH = Deno.env.get('SFTP_WEB_ASSETS_PATH') || 'assets-mariage';

  if (!PUBLIC_BASE_URL || !SFTP_SERVER || !SFTP_USERNAME || !SFTP_PASSWORD || !Number.isFinite(SFTP_PORT) || SFTP_PORT <= 0) {
    return json(500, { error: 'Secrets SFTP/Public manquants (voir README)' });
  }

  const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

  let familleId: number;
  try {
    const { data, error } = await supabase.rpc('get_famille_by_token', { p_token: token });
    if (error) throw error;
    const famille = Array.isArray(data) ? data[0] : data;
    if (!famille?.id) {
      return json(404, { error: 'Famille introuvable' });
    }
    familleId = Number(famille.id);
    if (!Number.isFinite(familleId)) {
      return json(500, { error: 'Identifiant famille invalide' });
    }
  } catch (err) {
    console.error('[list-photos] get_famille_by_token error', err);
    return json(401, { error: 'Token invalide' });
  }

  let conn: Client | null = null;
  try {
    conn = new Client();
    await conn.connect({
      host: SFTP_SERVER,
      port: SFTP_PORT,
      username: SFTP_USERNAME,
      password: SFTP_PASSWORD,
    });
    const sftp = await conn.sftp();

    const remoteFamilyDir = `${normalizeRemotePath(SFTP_REMOTE_ASSETS_DIR)}/famille-${familleId}`;
    const familyExists = await sftp.exists(remoteFamilyDir);
    if (!familyExists) {
      return json(200, { items: [] satisfies ListResponse['items'] });
    }

    const entries: any[] = await sftp.readdir(remoteFamilyDir, { full: true });

    const items = entries
      .map((entry) => mapSftpEntryToPhoto(entry, familleId, PUBLIC_BASE_URL, SFTP_WEB_ASSETS_PATH))
      .filter((x: unknown): x is ListResponse['items'][number] => !!x);

    return json(200, { items } satisfies ListResponse);
  } catch (err) {
    console.error('[list-photos] SFTP listing error', err);
    return json(502, { error: 'Impossible de lister les photos', details: extractErrorDetails(err) });
  } finally {
    if (conn) {
      try { conn.end(); } catch {}
    }
  }
});

function readSupabaseConfig(): SupabaseConfig | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return null;
  }
  return { url, serviceRoleKey: key };
}

function readOracleConfig(): OracleConfig | null {
  const namespace = Deno.env.get('OCI_NAMESPACE');
  const region = Deno.env.get('OCI_REGION');
  const bucket = Deno.env.get('OCI_BUCKET');
  const accessKey = Deno.env.get('OCI_S3_ACCESS_KEY');
  const secretKey = Deno.env.get('OCI_S3_SECRET_KEY');
  const publicBaseUrl = Deno.env.get('PUBLIC_BASE_URL');

  if (!namespace || !region || !bucket || !accessKey || !secretKey) {
    return null;
  }
  return { namespace, region, bucket, accessKey, secretKey, publicBaseUrl };
}

async function listObjects(config: OracleConfig, prefix: string): Promise<ListedObject[]> {
  const host = `${config.namespace}.compat.objectstorage.${config.region}.oraclecloud.com`;
  const queryParams = new URLSearchParams({
    'list-type': '2',
    prefix,
  });

  const canonicalQuery = Array.from(queryParams.entries())
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .sort()
    .join('&');

  const path = `/${encodeURIComponent(config.bucket)}`;
  const url = `https://${host}${path}?${canonicalQuery}`;

  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const service = 's3';

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${EMPTY_HASH}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'GET',
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    EMPTY_HASH,
  ].join('\n');

  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(config.secretKey, dateStamp, config.region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      host,
      'x-amz-content-sha256': EMPTY_HASH,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[list-photos] OCI listObjects failure', {
      status: res.status,
      body: text,
      prefix,
    });
    throw {
      name: 'OracleListError',
      status: res.status,
      body: text,
      prefix,
    };
  }

  const xml = await res.text();
  return parseListResponse(xml, prefix);
}

const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

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

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await (crypto as any).subtle.digest('SHA-256', buffer);
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
  const encoder = new TextEncoder();
  const kDate = await hmac(encoder.encode('AWS4' + secretKey), dateStamp);
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

function parseListResponse(xml: string, prefix: string): ListedObject[] {
  try {
    const chunks = xml.split('<Contents>').slice(1);
    const items: ListedObject[] = [];
    for (const chunk of chunks) {
      const segment = chunk.split('</Contents>')[0] ?? '';
      const key = extractTagValue(segment, 'Key');
      if (!key || !key.startsWith(prefix)) {
        continue;
      }
      const sizeText = extractTagValue(segment, 'Size') ?? '0';
      const lastModified = extractTagValue(segment, 'LastModified') ?? '';
      const eTag = extractTagValue(segment, 'ETag') ?? undefined;
      items.push({
        key,
        size: Number(sizeText) || 0,
        lastModified,
        eTag,
      });
    }
    return items;
  } catch (err) {
    console.error('[list-photos] parse error', err);
    throw err;
  }
}

function extractTagValue(segment: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = segment.match(pattern);
  if (!match) {
    return null;
  }
  return match[1]?.trim() ?? null;
}

function buildPublicUrl(config: OracleConfig, key: string): string {
  const base = config.publicBaseUrl?.trim().replace(/\/+$/, '') || `https://${config.namespace}.compat.objectstorage.${config.region}.oraclecloud.com/n/${config.namespace}/b/${encodeURIComponent(config.bucket)}/o`;
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${base}/${encodedKey}`;
}

function extractErrorDetails(err: unknown) {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack ? truncate(err.stack) : undefined,
    };
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const status = typeof obj['status'] === 'number' ? obj['status'] : undefined;
    const prefix = typeof obj['prefix'] === 'string' ? obj['prefix'] : undefined;
    const body = typeof obj['body'] === 'string' ? truncate(obj['body'] as string) : undefined;
    const message = typeof obj['message'] === 'string' ? obj['message'] : undefined;
    return { status, prefix, body, message };
  }
  return { message: typeof err === 'string' ? err : JSON.stringify(err) };
}

function truncate(value: string, max = 500): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

function normalizeRemotePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function buildSftpPublicUrl(publicBaseUrl: string, webAssetsPath: string, key: string): string {
  const base = publicBaseUrl.replace(/\/+$/, '');
  const assetsPath = webAssetsPath.replace(/^\/+|\/+$/g, '');
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${base}/${assetsPath}/${encodedKey}`;
}

function mapSftpEntryToPhoto(
  entry: any,
  familleId: number,
  publicBaseUrl: string,
  webAssetsPath: string
): ListResponse['items'][number] | null {
  if (!entry) return null;

  const filename = typeof entry.filename === 'string'
    ? entry.filename
    : typeof entry.name === 'string'
      ? entry.name
      : null;

  if (!filename) return null;
  if (!filename || filename === '.' || filename === '..') return null;

  const key = `famille-${familleId}/${filename}`;
  const size = Number(entry?.attrs?.size ?? entry?.size ?? 0) || 0;

  // lastModified est optionnel : si on n'arrive pas à le dériver, on laisse null.
  const mtime = entry?.attrs?.mtime ?? entry?.attrs?.modifyTime ?? entry?.mtime ?? null;
  let lastModified: string | null = null;
  if (mtime instanceof Date) {
    lastModified = mtime.toISOString();
  } else if (typeof mtime === 'string') {
    lastModified = mtime;
  } else if (typeof mtime === 'number' && Number.isFinite(mtime)) {
    // Heuristique: secondes vs millisecondes
    const ms = mtime > 1e12 ? mtime : mtime * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) lastModified = d.toISOString();
  }

  return {
    key,
    name: filename,
    url: buildSftpPublicUrl(publicBaseUrl, webAssetsPath, key),
    size,
    lastModified,
  };
}
