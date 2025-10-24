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

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not found in .env.local');
  process.exit(0);
}

let index = fs.readFileSync(indexPath, 'utf8');

function upsertMeta(name, content) {
  const re = new RegExp(`<meta\\s+name=\"${name}\"\\s+content=\"[^\"]*\">`, 'i');
  const tag = `<meta name="${name}" content="${content}">`;
  if (re.test(index)) {
    index = index.replace(re, tag);
  } else {
    index = index.replace(/<\/head>/i, `  ${tag}\n</head>`);
  }
}

upsertMeta('supabase-url', supabaseUrl);
upsertMeta('supabase-anon-key', supabaseKey);

fs.writeFileSync(indexPath, index, 'utf8');
console.log('Injected SUPABASE meta tags into src/index.html');
