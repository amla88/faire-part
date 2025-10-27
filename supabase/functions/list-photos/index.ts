// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-ignore Supabase client résolu via JSR au runtime Deno
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  const oracle = readOracleConfig();
  if (!oracle) {
    return json(500, { error: 'Oracle Object Storage configuration missing' });
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

  try {
    const objects = await listObjects(oracle, `famille-${familleId}/`);
    const items = objects.map((obj) => ({
      key: obj.key,
      name: obj.key.replace(/^.*\//, ''),
      url: buildPublicUrl(oracle, obj.key),
      size: obj.size,
      lastModified: obj.lastModified,
    }));
    return json(200, { items } satisfies ListResponse);
  } catch (err) {
    console.error('[list-photos] listObjects error', err);
    return json(502, { error: 'Impossible de lister les photos', details: extractErrorDetails(err) });
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
  const pattern = new RegExp(`<${tag}>([\s\S]*?)</${tag}>`, 'i');
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
