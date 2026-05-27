/**
 * User utility helpers — role checks and basic user predicates.
 */

interface UserWithRole {
  role?: string | null;
  [key: string]: unknown;
}

/**
 * Returns true if the user has the "admin" role.
 */
export function getIsUserAdmin(user: UserWithRole | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin";
}
