// src/modules/user/user.schemas.ts
import { z } from "zod";

const phoneSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .max(15, "Phone number must be at most 15 digits")
  .regex(/^[0-9]+$/, "Phone number must contain only digits");

const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^[0-9]+$/, "OTP must contain only digits");

// POST /send_otp
const sendOtpSchema = z.object({
  body: z.object({
    phone_number: phoneSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /verify_otp
const verifyOtpSchema = z.object({
  body: z.object({
    phone_number: phoneSchema,
    otp: otpSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /register_from_googleOAuth
const registerFromGoogleOAuthSchema = z.object({
  body: z.object({
    googleOAuthToken: z.string().min(1, "Google OAuth token is required"),
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    // add anything else you actually use in controller
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /register
const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    // add anything else you actually use in controller
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// GET /get_user_profile
const getUserProfileSchema = z.object({
  body: z.object({}), // JWT identifies user
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /edit_user_profile
const editUserProfileSchema = z.object({
  body: z.object({
    new_name: z.string().min(1).optional(),
    new_email: z.string().email().optional(),
    // add editable fields here
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// POST /logout
const logoutSchema = z.object({
  query: z.object({}), // nothing for now
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  sendOtpSchema,
  verifyOtpSchema,
  registerFromGoogleOAuthSchema,
  registerSchema,
  getUserProfileSchema,
  editUserProfileSchema,
  logoutSchema,
};
