import { z } from "zod";

export const UserZodSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().email(),
  role: z.string().optional(),
  createdAt: z.string().or(z.date()).optional(),
});

export type BasicUser = z.infer<typeof UserZodSchema>;
