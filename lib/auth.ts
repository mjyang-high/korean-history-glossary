// 미들웨어(Edge 런타임)에서도 동작해야 하므로 Node crypto 대신 Web Crypto API를 사용한다.
export const AUTH_COOKIE_NAME = 'ks_auth';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function expectedAuthToken(): Promise<string> {
  const password = process.env.CLASS_PASSWORD ?? '';
  return sha256Hex(password);
}

export async function isValidAuthToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  if (!process.env.CLASS_PASSWORD) return false;
  const expected = await expectedAuthToken();
  return token === expected;
}
