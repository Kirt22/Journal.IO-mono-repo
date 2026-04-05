import { z } from "zod";

const profileGoalsSchema = z.array(z.string().min(1)).max(8).optional();

const getProfileSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(60, "Name is too long"),
    avatarColor: z.string().min(1).max(40).optional(),
    goals: profileGoalsSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updatePremiumStatusSchema = z.object({
  body: z.object({
    isPremium: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export { getProfileSchema, updatePremiumStatusSchema, updateProfileSchema };
