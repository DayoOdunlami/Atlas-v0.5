export const PERMISSION_TYPES = {
  READ: "read",
  WRITE: "write",
  DELETE: "delete",
  ADMIN: "admin",
} as const;

export type PermissionType = (typeof PERMISSION_TYPES)[keyof typeof PERMISSION_TYPES];
