import 'server-only';
import { env } from '../env';

const VERCEL_API = 'https://api.vercel.com';

export type DomainConfig = {
  name: string;
  apexName: string;
  projectId: string;
  redirect: string | null;
  redirectStatusCode: number | null;
  gitBranch: string | null;
  updatedAt: number;
  createdAt: number;
  verified: boolean;
};

type Disabled = { disabled: true };
type Ok<T> = { disabled: false; data: T };
export type Result<T> = Disabled | Ok<T>;

function isEnabled(): boolean {
  return Boolean(env.VERCEL_API_TOKEN && env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID_TENANT);
}

function teamQuery(): string {
  return env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : '';
}

async function call<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Result<T>> {
  if (!isEnabled()) return { disabled: true };
  const res = await fetch(`${VERCEL_API}${path}${teamQuery()}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel ${method} ${path} failed: ${res.status} ${text}`);
  }
  return { disabled: false, data: (await res.json()) as T };
}

export async function addDomain(name: string): Promise<Result<DomainConfig>> {
  return call('POST', `/v10/projects/${env.VERCEL_PROJECT_ID_TENANT}/domains`, { name });
}

export async function verifyDomain(name: string): Promise<Result<DomainConfig>> {
  return call(
    'POST',
    `/v9/projects/${env.VERCEL_PROJECT_ID_TENANT}/domains/${encodeURIComponent(name)}/verify`,
  );
}

export async function removeDomain(name: string): Promise<Result<{ uid: string }>> {
  return call(
    'DELETE',
    `/v9/projects/${env.VERCEL_PROJECT_ID_TENANT}/domains/${encodeURIComponent(name)}`,
  );
}

export const vercelEnabled = isEnabled;
