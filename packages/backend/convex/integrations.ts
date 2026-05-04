import { R2 } from '@convex-dev/r2';
import { Resend } from '@convex-dev/resend';
import { components } from './_generated/api';

let warned = false;

function logDisabledOnce() {
  if (warned) return;
  const disabled: string[] = [];
  if (!hasR2Env())
    disabled.push(
      'R2 (set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET to enable)',
    );
  if (!hasResendEnv()) disabled.push('Resend (set RESEND_API_KEY to enable)');
  if (disabled.length > 0) {
    console.warn('[integrations] disabled:', disabled.join('; '));
  }
  warned = true;
}

function hasR2Env(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function hasResendEnv(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let r2Instance: R2 | null = null;
let resendInstance: Resend | null = null;

/**
 * Returns an R2 client only if all R2_* env vars are set on the Convex
 * deployment. Callers branch on null:
 *   const r2 = getR2(); if (!r2) return; await r2.getUrl(key);
 */
export function getR2(): R2 | null {
  logDisabledOnce();
  if (!hasR2Env()) return null;
  if (!r2Instance) r2Instance = new R2(components.r2);
  return r2Instance;
}

/** Returns a Resend client only if RESEND_API_KEY is set. Callers branch on null. */
export function getResend(): Resend | null {
  logDisabledOnce();
  if (!hasResendEnv()) return null;
  if (!resendInstance) resendInstance = new Resend(components.resend, {});
  return resendInstance;
}
