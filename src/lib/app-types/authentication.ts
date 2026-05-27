import { z } from "zod";

export const GitHubConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  disableSignUp: z.boolean().optional(),
});
export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

export const GoogleConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  disableSignUp: z.boolean().optional(),
  prompt: z.string().optional(),
});
export type GoogleConfig = z.infer<typeof GoogleConfigSchema>;

export const MicrosoftConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  tenantId: z.string().optional(),
  disableSignUp: z.boolean().optional(),
  prompt: z.string().optional(),
});
export type MicrosoftConfig = z.infer<typeof MicrosoftConfigSchema>;

export const AuthConfigSchema = z.object({
  emailAndPasswordEnabled: z.boolean(),
  signUpEnabled: z.boolean(),
  socialAuthenticationProviders: z.object({
    github: GitHubConfigSchema.optional(),
    google: GoogleConfigSchema.optional(),
    microsoft: MicrosoftConfigSchema.optional(),
  }),
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
