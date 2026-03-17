import { request } from "./apiClient";

type AuthUser = {
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  profilePic: string | null;
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type SendOtpResponse = {
  phoneNumber: string;
  expiresInSeconds: number;
  debugOtp?: string;
};

type VerifyOtpResponse = AuthSession & {
  isNewUser: boolean;
};

const sendOtp = async (payload: { phoneNumber: string }) => {
  const response = await request<SendOtpResponse>("/auth/send_otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

const verifyOtp = async (payload: {
  phoneNumber: string;
  otp: string;
  name?: string;
}) => {
  const response = await request<VerifyOtpResponse>("/auth/verify_otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

const signInWithGoogle = async (payload: {
  googleIdToken: string;
  googleUserId?: string;
  email: string;
  name: string;
  profilePic?: string;
}) => {
  const response = await request<AuthSession>("/auth/register_from_googleOAuth", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
};

export { sendOtp, signInWithGoogle, verifyOtp };
export type { AuthSession, AuthUser, SendOtpResponse, VerifyOtpResponse };
