import { z } from "zod";

const phoneNumberSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .max(16, "Phone number must be at most 15 digits plus an optional +")
  .regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid phone number");

const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only digits");

const emailSchema = z.string().trim().email("Invalid email address");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

const onboardingStringSchema = z.string().trim().min(1).max(80);

const onboardingContextSchema = z
  .object({
    ageRange: onboardingStringSchema.max(40).optional(),
    journalingExperience: onboardingStringSchema.max(40).optional(),
    goals: z.array(onboardingStringSchema).max(8).optional(),
    supportFocus: z.array(onboardingStringSchema).max(8).optional(),
    reminderPreference: onboardingStringSchema.max(40).optional(),
    aiOptIn: z.boolean().optional(),
    privacyConsentAccepted: z.boolean().optional(),
  })
  .refine(
    value => value.privacyConsentAccepted !== false,
    {
      message: "Privacy consent must be accepted to continue.",
      path: ["privacyConsentAccepted"],
    }
  )
  .optional();

const sendOtpSchema = z.object({
  body: z.object({
    phoneNumber: phoneNumberSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const resendOtpSchema = z.object({
  body: z.object({
    phoneNumber: phoneNumberSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const verifyOtpSchema = z.object({
  body: z.object({
    phoneNumber: phoneNumberSchema,
    otp: otpSchema,
    name: z.string().min(1, "Name is required").optional(),
    goals: z.array(z.string().min(1)).max(8).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const registerFromGoogleOAuthSchema = z.object({
  body: z.object({
    googleIdToken: z.string().min(1, "Google ID token is required"),
    googleUserId: z.string().min(1).optional(),
    email: emailSchema,
    name: z.string().min(1, "Name is required"),
    profilePic: z.string().url("Profile picture must be a valid URL").optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const signUpWithEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    onboardingContext: onboardingContextSchema,
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
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const signInWithEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
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
  logoutSchema,
  resendEmailVerificationSchema,
  resendOtpSchema,
  refreshSchema,
  registerFromGoogleOAuthSchema,
  sendOtpSchema,
  signInWithEmailSchema,
  signUpWithEmailSchema,
  verifyEmailSchema,
  verifyOtpSchema,
};
