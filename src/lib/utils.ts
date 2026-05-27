import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * parseEnvBoolean — parses a string env variable as a boolean.
 * "1", "true", "yes" → true; everything else → false.
 */
export function parseEnvBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase().trim());
}
