/**
 * Application Version & Git Build Metadata
 * Sourced from the root VERSION file and git commit hash via Vite define.
 */
export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string) || '0.1.0-alpha5';

export const GIT_COMMIT_HASH: string =
  (import.meta.env.VITE_GIT_COMMIT_HASH as string) || '';

export const FULL_VERSION_STRING: string = `v${APP_VERSION}${
  GIT_COMMIT_HASH ? ` (${GIT_COMMIT_HASH})` : ''
}`;
