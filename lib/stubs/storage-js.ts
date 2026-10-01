/**
 * Browser stand-in for @supabase/storage-js (see turbopack.resolveAlias in
 * next.config.ts). Tookbaht stores no files; supabase-js still creates a
 * Storage client up front, so this keeps it out of the first-load bundle.
 */
export class StorageApiError extends Error {}

export class StorageClient {
  constructor(..._args: unknown[]) {
    void _args
  }
  from(): never {
    throw new Error("Supabase Storage is not bundled in Tookbaht")
  }
}
