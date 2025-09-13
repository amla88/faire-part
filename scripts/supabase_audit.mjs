#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Load env the same way Vite would (use .env.local if present)
const root = process.cwd();
const dotenvPaths = [path.join(root, '.env.local'), path.join(root, '.env')];
const loadedEnv = [];
const loadedVars = {};
for (const p of dotenvPaths) {
  if (fs.existsSync(p)) {
    loadedEnv.push(p);
    const raw = fs.readFileSync(p, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2];
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val; // override for audit clarity
        loadedVars[key] = val;
      }
    }
    // Fallback: force-parse token vars if still missing
    const ensureVar = (k) => {
      if (!process.env[k]) {
        const re = new RegExp(`^\\s*${k}\\s*=\\s*(.*)\\s*$`, 'm');
        const mm = raw.match(re);
        if (mm) {
          let v = mm[1];
          if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
          if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
          process.env[k] = v;
          loadedVars[k] = v;
        }
      }
    };
    ['AUDIT_SAMPLE_TOKEN', 'AUDIT_SAMPLE_TOKEN_USER', 'AUDIT_SAMPLE_TOKEN_ADMIN'].forEach(ensureVar);
  }
}
console.log('Loaded env files:', loadedEnv);
const mask = (s) => (s ? `${String(s).slice(0,2)}***${String(s).slice(-2)}` : null);
console.log('Loaded env vars (masked subset):', Object.fromEntries(
  Object.keys(loadedVars)
    .filter(k => /^(VITE_|AUDIT_)/.test(k))
    .map(k => [k, mask(loadedVars[k])])
));
console.log('Debug tokens raw:', {
  AUDIT_SAMPLE_TOKEN: process.env.AUDIT_SAMPLE_TOKEN || null,
  AUDIT_SAMPLE_TOKEN_USER: process.env.AUDIT_SAMPLE_TOKEN_USER || null,
  AUDIT_SAMPLE_TOKEN_ADMIN: process.env.AUDIT_SAMPLE_TOKEN_ADMIN || null,
});

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env/.env.local');
  process.exit(1);
}

const supabase = createClient(url, anon);

function hr(title) {
  console.log(`\n=== ${title} ===`);
}

(async () => {
  try {
    hr('Connectivity');
    const { data: time, error: pingErr } = await supabase.rpc('now');
    if (pingErr) console.log('No now() RPC (ok), trying auth.getSession...');
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('Session (anon expected null user):', sessionData?.session?.user?.id || null);

    hr('Users lookup by login_token (samples)');
    const tokens = [
      process.env.AUDIT_SAMPLE_TOKEN,
      process.env.AUDIT_SAMPLE_TOKEN_USER,
      process.env.AUDIT_SAMPLE_TOKEN_ADMIN,
    ].filter(Boolean);
  if (tokens.length === 0) {
      console.log('No sample tokens set. Define AUDIT_SAMPLE_TOKEN[_USER|_ADMIN] in .env.local');
      console.log('Env has:', {
        AUDIT_SAMPLE_TOKEN: !!process.env.AUDIT_SAMPLE_TOKEN,
        AUDIT_SAMPLE_TOKEN_USER: !!process.env.AUDIT_SAMPLE_TOKEN_USER,
        AUDIT_SAMPLE_TOKEN_ADMIN: !!process.env.AUDIT_SAMPLE_TOKEN_ADMIN,
      });
    } else {
      console.log('Detected tokens:', tokens.map(mask));
    }

    for (const t of tokens) {
      console.log(`\n-- Testing token: ${t}`);
      // Direct SELECT (may be blocked by RLS)
      const { data: userBySelect, error: userErr } = await supabase
        .from('users')
        .select('id, login_token, auth_uuid')
        .eq('login_token', t)
        .maybeSingle();
      console.log('users SELECT error:', userErr?.message || null);
      console.log('users SELECT data:', userBySelect || null);

      // RPC (SECURITY DEFINER)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_user_by_token', { p_token: t });
      const rpcRow = Array.isArray(rpcData) ? (rpcData[0] ?? null) : (rpcData ?? null);
      console.log('users RPC error:', rpcErr?.message || null);
      console.log('users RPC data:', rpcRow || null);

      const uid = (userBySelect && userBySelect.id) || (rpcRow && rpcRow.id) || null;
      if (uid) {
        const { data: personnes, error: persErr } = await supabase
          .from('personnes')
          .select('id, nom, prenom, user_id')
          .eq('user_id', uid);
        console.log('personnes error:', persErr?.message || null);
        console.log('personnes count:', personnes?.length || 0);
      }
    }

    hr('Profiles (admin role check)');
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, role')
      .limit(3);
    console.log('profiles error:', profErr?.message || null);
    console.log('profiles sample:', profiles || []);

    hr('RLS quick sanity');
    console.log('Note: Using anon key; if RLS blocks, you will see errors above (expected if policies require auth).');

    console.log('\nAudit finished.');
  } catch (e) {
    console.error('Audit failed:', e);
    process.exit(2);
  }
})();
