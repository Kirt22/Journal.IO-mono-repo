import { request } from '../utils/apiClient';

type AuthUser = {
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  createdAt?: string | null;
  isPremium?: boolean;
  premiumPlanKey?: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | null;
  premiumActivatedAt?: string | null;
  premiumProductId?: string | null;
  premiumExpiresAt?: string | null;
  premiumWillRenew?: boolean | null;
  premiumVerifiedAt?: string | null;
  premiumRevenueCatRequestDate?: string | null;
  revenueCatAppUserId?: string | null;
  premiumSource?: 'revenuecat_client_sync' | 'revenuecat_verified' | null;
  journalingGoals: string[];
  avatarColor: string | null;
  profileSetupCompleted: boolean;
  onboardingCompleted?: boolean;
  onboardingVersion?: number | null;
  onboardingCompletedAt?: string | null;
  hasJournalEntries?: boolean;
  journalCount?: number;
  profilePic: string | null;
  onboardingPreferences?: {
    ageRange: string | null;
    journalingExperience: string | null;
    whatBringsYouHere: string[];
    supportFocusAreas: string[];
    reflectionTone: string[];
    reminderPreference: string | null;
  };
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthOnboardingContext = {
  ageRange?: string;
  journalingExperience?: string;
  goals?: string[];
  supportFocus?: string[];
  reminderPreference?: string;
  privacyConsentAccepted?: boolean;
};

type EmailVerificationChallenge = {
  email: string;
  verificationRequired: boolean;
  expiresInSeconds: number;
  verificationCode?: string;
};

type SignUpWithEmailPayload = {
  email: string;
  password: string;
  onboardingContext?: AuthOnboardingContext;
  onboardingCompleted?: boolean;
};

type ResendEmailVerificationPayload = {
  email: string;
};

type PasswordResetChallenge = {
  email: string;
  expiresInSeconds: number;
  resetToken?: string;
  resetLink?: string;
  resetIssued?: boolean;
  resetSkippedReason?: 'user_not_found' | 'email_not_verified';
};

type RequestPasswordResetPayload = {
  email: string;
};

type ResetPasswordPayload = {
  token: string;
  password: string;
};

type VerifyEmailPayload = {
  email: string;
  code: string;
};

type VerifyEmailOptions = {
  onboardingGoals?: string[];
  onboardingCompleted?: boolean;
};

type SignInWithEmailPayload = {
  email: string;
  password: string;
  onboardingContext?: AuthOnboardingContext;
  onboardingCompleted?: boolean;
};

type GoogleSignInPayload = {
  idToken: string;
  onboardingContext?: AuthOnboardingContext;
  onboardingCompleted?: boolean;
};

type AppleFullNamePayload = {
  givenName?: string | null;
  familyName?: string | null;
  nickname?: string | null;
};

type AppleSignInPayload = {
  identityToken: string;
  nonce: string;
  email?: string | null;
  fullName?: AppleFullNamePayload | null;
  onboardingContext?: AuthOnboardingContext;
  onboardingCompleted?: boolean;
};

const applyDevPremiumDefault = <T extends AuthUser | AuthSession>(
  value: T,
): T => {
  if (!__DEV__) {
    return value;
  }

  if ('user' in value) {
    return {
      ...value,
      user: {
        ...value.user,
        isPremium: value.user.isPremium ?? false,
      },
    };
  }

  return {
    ...value,
    isPremium: value.isPremium ?? false,
  };
};

const signUpWithEmail = async (payload: SignUpWithEmailPayload) => {
  const response = await request<EmailVerificationChallenge>(
    '/auth/sign_up_with_email',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { showNetworkAlert: false },
  );

  if (__DEV__ && response.data.verificationCode) {
    console.info(
      `[Auth] Email verification code for ${response.data.email}: ${response.data.verificationCode}`,
    );
  }

  return response.data;
};

const resendEmailVerification = async (
  payload: ResendEmailVerificationPayload,
) => {
  const response = await request<EmailVerificationChallenge>(
    '/auth/resend_email_verification',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { showNetworkAlert: false },
  );

  if (__DEV__ && response.data.verificationCode) {
    console.info(
      `[Auth] Resent verification code for ${response.data.email}: ${response.data.verificationCode}`,
    );
  }

  return response.data;
};

const requestPasswordReset = async (payload: RequestPasswordResetPayload) => {
  const response = await request<PasswordResetChallenge>(
    '/auth/request_password_reset',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { showNetworkAlert: false },
  );

  if (__DEV__ && response.data.resetLink) {
    console.info(`[Auth] Password reset link: ${response.data.resetLink}`);
  }

  return response.data;
};

const resetPassword = async (payload: ResetPasswordPayload) => {
  await request<{}>(
    '/auth/reset_password',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { showNetworkAlert: false },
  );
};

const verifyEmail = async (
  payload: VerifyEmailPayload,
  options: VerifyEmailOptions = {},
) => {
  const response = await request<AuthSession>(
    '/auth/verify_email',
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        // Only sent when the caller actually knows the answer. Defaulting to
        // `false` meant every verification told the server "this account has not
        // finished onboarding" — which it honoured, so re-verifying an email
        // downgraded a completed account.
        ...(options.onboardingCompleted === undefined
          ? {}
          : { onboardingCompleted: options.onboardingCompleted }),
      }),
    },
    { showNetworkAlert: false },
  );

  return applyDevPremiumDefault(response.data);
};

const signInWithEmail = async (payload: SignInWithEmailPayload) => {
  const response = await request<AuthSession>(
    '/auth/sign_in_with_email',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { showNetworkAlert: false },
  );

  return applyDevPremiumDefault(response.data);
};

const signInWithGoogle = async (payload: GoogleSignInPayload) => {
  const response = await request<AuthSession>(
    '/auth/google/mobile',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { showNetworkAlert: false },
  );

  return applyDevPremiumDefault(response.data);
};

const signInWithApple = async (payload: AppleSignInPayload) => {
  const response = await request<AuthSession>(
    '/auth/apple/mobile',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { showNetworkAlert: false },
  );

  return applyDevPremiumDefault(response.data);
};

const logout = async () => {
  await request<{}>('/auth/logout', {
    method: 'POST',
  });
};

export {
  applyDevPremiumDefault,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  logout,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmail,
};
export type {
  AuthOnboardingContext,
  AuthSession,
  AuthUser,
  AppleSignInPayload,
  EmailVerificationChallenge,
  GoogleSignInPayload,
  PasswordResetChallenge,
  RequestPasswordResetPayload,
  ResendEmailVerificationPayload,
  ResetPasswordPayload,
  SignInWithEmailPayload,
  SignUpWithEmailPayload,
  VerifyEmailOptions,
  VerifyEmailPayload,
};
