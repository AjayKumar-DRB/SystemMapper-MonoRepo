/**
 * Central API configuration helper.
 * Uses NEXT_PUBLIC_API_URL env var (set in .env.local for dev, deployment env for prod).
 * Fallback to localhost:3001 for convenience.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://systemmapper.netlify.app'
    : 'http://localhost:3001');
