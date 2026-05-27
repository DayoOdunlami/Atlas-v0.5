/**
 * storage-utils — minimal content-type helper for file uploads.
 * Maps file extensions to MIME types for Supabase Storage uploads.
 */

const EXT_MAP: Record<string, string> = {
  pdf:  "application/pdf",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
  svg:  "image/svg+xml",
  txt:  "text/plain",
  md:   "text/markdown",
  csv:  "text/csv",
  json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * getContentTypeFromFilename — returns MIME type for a given filename,
 * defaulting to application/octet-stream for unknown extensions.
 */
export function getContentTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? "application/octet-stream";
}
