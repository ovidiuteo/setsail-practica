// ============================================================================
// CDS Landing — Cloudflare R2 upload.
// Re-exports the generic R2 module (lib/r2.ts) to keep a single implementation.
// ============================================================================
export { r2Enabled, r2Upload, r2Delete, r2KeyFromUrl } from '@/lib/r2'
