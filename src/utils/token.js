export function generateLoginToken(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < length; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
}