import { z } from "zod";

const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only digits");

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .transform(value => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

const onboardingContextSchema = z
  .object({
    ageRange: z.string().min(1).max(32).optional(),
    journalingExperience: z.string().min(1).max(64).optional(),
    goals: z.array(z.string().min(1)).max(8).optional(),
    supportFocus: z.array(z.string().min(1)).max(8).optional(),
    reminderPreference: z.string().min(1).max(32).optional(),
    aiOptIn: z.boolean().optional(),
    privacyConsentAccepted: z.boolean().optional(),
  })
  .strict()
  .optional();

const signUpWithEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    onboardingContext: onboardingContextSchema,
    onboardingCompleted: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const resendEmailVerificationSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const verifyEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
    code: otpSchema,
    onboardingCompleted: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const signInWithEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    onboardingCompleted: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const registerFromGoogleOAuthSchema = z.object({
  body: z.object({
    googleIdToken: z.string().min(1, "Google ID token is required"),
    googleUserId: z.string().min(1).optional(),
    email: emailSchema.optional(),
    name: z.string().min(1, "Name is required").optional(),
    profilePic: z.string().url("Profile picture must be a valid URL").optional(),
    onboardingCompleted: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const googleMobileSignInSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, "Google ID token is required"),
    onboardingContext: onboardingContextSchema,
    onboardingCompleted: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const logoutSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  googleMobileSignInSchema,
  logoutSchema,
  refreshSchema,
  registerFromGoogleOAuthSchema,
  resendEmailVerificationSchema,
  signInWithEmailSchema,
  signUpWithEmailSchema,
  verifyEmailSchema,
};
