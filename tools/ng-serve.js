const { execSync } = require('child_process');
const path = require('path');
const { readIndexBaseHref } = require('./read-index-base-href');

const root = path.join(__dirname, '..');
const base = (readIndexBaseHref() || '/').replace(/\/$/, '') || '/';
// ng serve (Vite) : pas de --base-href ; --serve-path seulement si l’app n’est pas à la racine.
const atRoot = base === '' || base === '/';
const servePathArg = atRoot ? '' : ` --serve-path=${base.startsWith('/') ? base : `/${base}`}/`;
const forwarded = process.argv.slice(2).join(' ');
const cmd = forwarded
  ? `npx ng serve --proxy-config proxy.conf.json${servePathArg} ${forwarded}`.replace(/\s+/g, ' ').trim()
  : `npx ng serve --proxy-config proxy.conf.json${servePathArg}`.replace(/\s+/g, ' ').trim();
execSync(cmd, { stdio: 'inherit', cwd: root, shell: true });
