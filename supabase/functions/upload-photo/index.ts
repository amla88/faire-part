// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-ignore - import résolu par Deno via jsr:namespace
import { createClient } from 'jsr:@supabase/supabase-js@2';
// For editors that don't include Deno types in this workspace
// deno-lint-ignore no-var
declare const Deno: any;

// Edge Function servant de proxy d'upload vers Oracle Object Storage.

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
  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return json(400, { error: 'Content-Type must be multipart/form-data' });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return json(400, { error: 'Champ "file" manquant' });
    }

    // ENV
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OCI_REGION = Deno.env.get('OCI_REGION');
    const OCI_NAMESPACE = Deno.env.get('OCI_NAMESPACE');
    const OCI_BUCKET = Deno.env.get('OCI_BUCKET');
    const OCI_S3_ACCESS_KEY = Deno.env.get('OCI_S3_ACCESS_KEY');
    const OCI_S3_SECRET_KEY = Deno.env.get('OCI_S3_SECRET_KEY');
    const PUBLIC_BASE_URL = Deno.env.get('PUBLIC_BASE_URL'); // ex: https://.../n/<ns>/b/<bucket>/o/
    const MAX_UPLOAD_BYTES = Number(Deno.env.get('MAX_UPLOAD_BYTES') || '10485760'); // 10MB default

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Missing Supabase service config' });
    if (!OCI_REGION || !OCI_NAMESPACE || !OCI_BUCKET || !OCI_S3_ACCESS_KEY || !OCI_S3_SECRET_KEY) {
      return json(500, { error: 'OCI secrets manquants (voir README)' });
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
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const key = `famille-${familleId}/${unique}${ext}`;

    // Signer et envoyer vers l’endpoint S3-compatible d’OCI
    const host = `${OCI_NAMESPACE}.compat.objectstorage.${OCI_REGION}.oraclecloud.com`;
    const url = `https://${host}/${encodeURIComponent(OCI_BUCKET)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const contentType = file.type || 'application/octet-stream';
    const body = new Uint8Array(await file.arrayBuffer());

    const now = new Date();
    const amzDate = toAmzDate(now); // yyyymmddThhmmssZ
    const dateStamp = amzDate.slice(0, 8); // yyyymmdd
    const service = 's3';
    const region = OCI_REGION;

    const payloadHash = await sha256Hex(body);
    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      `/${encodeURIComponent(OCI_BUCKET)}/${key.split('/').map(encodeURIComponent).join('/')}`,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = await getSignatureKey(OCI_S3_SECRET_KEY, dateStamp, region, service);
    const signature = await hmacHex(signingKey, stringToSign);

    const authorization = `${algorithm} Credential=${OCI_S3_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'content-type': contentType,
        host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
      body,
    });

    if (!putRes.ok) {
      const text = await safeText(putRes);
      return json(502, { error: 'OCI upload failed', status: putRes.status, body: text });
    }

    const publicUrl = buildPublicUrl({ bucket: OCI_BUCKET, key, baseUrl: PUBLIC_BASE_URL });
    return json(200, {
      path: `${OCI_BUCKET}/${key}`,
      publicUrl,
      familleId,
    });
  } catch (e) {
    return json(400, { error: 'Invalid multipart payload', details: String(e) });
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
