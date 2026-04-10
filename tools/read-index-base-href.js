const fs = require('fs');
const path = require('path');

/** Lit le href de <base> dans src/index.html (après inject-env si besoin). */
function readIndexBaseHref() {
  const indexPath = path.join(__dirname, '..', 'src', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const m = html.match(/<base\s+href="([^"]*)"/i);
  return (m && m[1]) || '/';
}

module.exports = { readIndexBaseHref };
