const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const indexPath = path.resolve(__dirname, '..', 'src', 'index.html');

function parseEnv(content) {
  const out = {};
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) {
      out[m[1]] = m[2].trim();
    }
  });
  return out;
}

if (!fs.existsSync(envPath)) {
  console.warn('.env.local not found at', envPath);
  process.exit(0);
}

const envRaw = fs.readFileSync(envPath, 'utf8');
const env = parseEnv(envRaw);

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_ANON_KEY;
const qrCodeBaseUrl = env.QR_CODE_BASE_URL;
const weddingDateIso = env.WEDDING_DATE_ISO;

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not found in .env.local');
  process.exit(0);
}

if (!qrCodeBaseUrl) {
  console.warn('QR_CODE_BASE_URL not found in .env.local');
  process.exit(0);
}

let index = fs.readFileSync(indexPath, 'utf8');

function upsertMeta(name, content) {
  const re = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*">`, 'i');
  const tag = `<meta name="${name}" content="${content}">`;
  if (re.test(index)) {
    index = index.replace(re, tag);
  } else {
    index = index.replace(/<\/head>/i, `  ${tag}\n</head>`);
  }
}

/**
 * Déduit <base href> depuis QR_CODE_BASE_URL.
 * Ex. https://host/authentication/quick/ → /
 * Ex. https://host/sous-app/authentication/quick/ → /sous-app/
 */
function deriveAppBaseHrefFromQr(qrUrl) {
  try {
    const u = new URL(qrUrl);
    let p = u.pathname.replace(/\/+$/, '') || '/';
    const suf = '/authentication/quick';
    if (p.endsWith(suf)) {
      p = p.slice(0, -suf.length) || '/';
      if (p === '/' || p === '') return '/';
      return p.endsWith('/') ? p : `${p}/`;
    }
  } catch (_) {
    /* ignore */
  }
  return '/';
}

function upsertBaseHref(href) {
  const normalized = href.endsWith('/') ? href : `${href}/`;
  const re = /<base\s+href="[^"]*"\s*>/i;
  const tag = `<base href="${normalized}">`;
  if (re.test(index)) {
    index = index.replace(re, tag);
  }
}

const appBaseHref = env.APP_BASE_HREF || deriveAppBaseHrefFromQr(qrCodeBaseUrl);

upsertMeta('supabase-url', supabaseUrl);
upsertMeta('supabase-anon-key', supabaseKey);
upsertMeta('qr-code-base-url', qrCodeBaseUrl);
upsertBaseHref(appBaseHref);
if (weddingDateIso) {
  upsertMeta('wedding-date-iso', weddingDateIso);
}

fs.writeFileSync(indexPath, index, 'utf8');
console.log('Injected SUPABASE, QR meta, and <base href> into src/index.html');
