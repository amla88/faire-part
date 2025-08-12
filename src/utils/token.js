export function generateLoginToken() {
  return crypto.randomUUID();
}