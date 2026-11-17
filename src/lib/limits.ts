// Shared by server and browser code. Must match the checks in the database migration.
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];

export function formatSize(b: number) {
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}
