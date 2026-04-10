const { execSync } = require('child_process');
const path = require('path');
const { readIndexBaseHref } = require('./read-index-base-href');

const root = path.join(__dirname, '..');
const base = readIndexBaseHref();
const forwarded = process.argv.slice(2).join(' ');
const cmd = forwarded
  ? `npx ng build ${forwarded} --base-href=${base}`
  : `npx ng build --base-href=${base}`;
execSync(cmd, { stdio: 'inherit', cwd: root, shell: true });
