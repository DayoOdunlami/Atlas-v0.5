export const USER_ROLES = {
  ADMIN: "admin",
  EDITOR: "editor",
  USER: "user",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const DEFAULT_USER_ROLE: UserRole = USER_ROLES.USER;
