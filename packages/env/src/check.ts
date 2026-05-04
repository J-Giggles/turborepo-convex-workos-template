#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  websiteClientSchema,
  dashboardServerSchema,
  dashboardClientSchema,
  tenantServerSchema,
  tenantClientSchema,
  nativeSchema,
} from './index';

type AppCheck = {
  name: string;
  envPath: string;
  schemas: Array<Record<string, z.ZodTypeAny>>;
};

function repoRoot(): string {
  let dir = process.cwd();
  while (dir !== '/') {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('Could not find pnpm-workspace.yaml above cwd');
}

function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === '') continue;
    result[key] = value;
  }
  return result;
}

function checkApp(app: AppCheck): { app: string; status: 'pass' | 'fail' | 'skip'; errors: string[] } {
  const fullPath = resolve(repoRoot(), app.envPath);
  if (!existsSync(fullPath)) {
    return { app: app.name, status: 'skip', errors: [`no file at ${app.envPath}`] };
  }
  const content = readFileSync(fullPath, 'utf-8');
  const parsed = parseDotenv(content);
  const errors: string[] = [];
  for (const schema of app.schemas) {
    for (const [key, validator] of Object.entries(schema)) {
      const value = parsed[key];
      const result = (validator as z.ZodTypeAny).safeParse(value);
      if (!result.success) {
        const issue = result.error.issues[0];
        errors.push(`${key}: ${issue?.message ?? 'invalid'}`);
      }
    }
  }
  return { app: app.name, status: errors.length === 0 ? 'pass' : 'fail', errors };
}

const APPS: AppCheck[] = [
  {
    name: 'website',
    envPath: 'apps/website/.env.local',
    schemas: [websiteClientSchema],
  },
  {
    name: 'dashboard',
    envPath: 'apps/dashboard/.env.local',
    schemas: [dashboardServerSchema, dashboardClientSchema],
  },
  {
    name: 'tenant',
    envPath: 'apps/tenant/.env.local',
    schemas: [tenantServerSchema, tenantClientSchema],
  },
  {
    name: 'native',
    envPath: 'apps/native/.env',
    schemas: [nativeSchema],
  },
];

const results = APPS.map(checkApp);
let failed = false;

for (const r of results) {
  const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '·';
  const colour = r.status === 'pass' ? '\x1b[32m' : r.status === 'fail' ? '\x1b[31m' : '\x1b[90m';
  console.log(`${colour}${icon}\x1b[0m ${r.app.padEnd(12)} ${r.status}`);
  if (r.status === 'fail') {
    failed = true;
    for (const err of r.errors) console.log(`    \x1b[31m${err}\x1b[0m`);
  } else if (r.status === 'skip') {
    for (const err of r.errors) console.log(`    \x1b[90m${err}\x1b[0m`);
  }
}

if (failed) {
  console.error('\n\x1b[31mEnv validation failed.\x1b[0m See above for missing/invalid keys, or run `pnpm convex:env` to view current Convex deployment env.');
  process.exit(1);
}
console.log('\n\x1b[32mAll present .env files validate cleanly.\x1b[0m');
