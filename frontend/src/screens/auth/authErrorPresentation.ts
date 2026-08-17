import { ApiError } from '../../utils/apiClient';

type AuthErrorContext =
  | 'apple'
  | 'create-account'
  | 'email-choice'
  | 'forgot-password'
  | 'google'
  | 'resend-verification'
  | 'reset-password'
  | 'sign-in'
  | 'verify-email';

type AuthErrorSurface = 'dialog' | 'inline';

type AuthFieldKey = 'code' | 'confirmPassword' | 'email' | 'password' | 'token';

type AuthErrorPresentation = {
  field?: AuthFieldKey;
  message: string;
  surface: AuthErrorSurface;
  title?: string;
};

const AUTH_VALIDATION_MESSAGES = {
  codeRequired: 'Enter the full 6-digit verification code.',
  confirmPasswordRequired: 'Confirm your password.',
  emailInvalid: 'Enter a valid email address.',
  emailRequired: 'Email is required.',
  passwordMismatch: 'Passwords do not match.',
  passwordRequired: 'Password is required.',
  passwordTooShort: 'Use at least 8 characters.',
  resetTokenMissing:
    'This reset link is missing a token. Please request a new one.',
} as const;

const knownErrorPresentations: Record<string, AuthErrorPresentation> = {
  ACCOUNT_LOOKUP_CONFLICT: {
    message:
      'We found more than one account for this sign-in, so we stopped rather than guess. Please contact support and we can merge them.',
    surface: 'dialog',
    title: "We couldn't pick your account",
  },
  APPLE_ACCOUNT_ALREADY_LINKED: {
    message:
      'This email is already linked to another Apple account. Try a different sign-in method.',
    surface: 'dialog',
    title: 'Apple sign-in failed',
  },
  EMAIL_ALREADY_REGISTERED: {
    field: 'email',
    message: 'An account already exists for this email. Sign in instead.',
    surface: 'inline',
  },
  EMAIL_ALREADY_VERIFIED: {
    message: 'This email is already verified. Sign in instead.',
    surface: 'inline',
  },
  EMAIL_OTP_EXPIRED: {
    field: 'code',
    message: 'That verification code has expired. Request a new one.',
    surface: 'inline',
  },
  EMAIL_OTP_INVALID: {
    field: 'code',
    message: "That verification code doesn't look right.",
    surface: 'inline',
  },
  EMAIL_OTP_LOCKED: {
    field: 'code',
    message: 'Too many incorrect attempts. Request a new code.',
    surface: 'inline',
  },
  EMAIL_OTP_NOT_FOUND: {
    field: 'code',
    message: 'No active verification code was found. Request a new one.',
    surface: 'inline',
  },
  GOOGLE_ACCOUNT_ALREADY_LINKED: {
    message:
      'This email is already linked to another Google account. Try a different sign-in method.',
    surface: 'dialog',
    title: 'Google sign-in failed',
  },
  INVALID_APPLE_ID_TOKEN: {
    message: "We couldn't verify that Apple sign-in. Please try again.",
    surface: 'dialog',
    title: 'Apple sign-in failed',
  },
  INVALID_CREDENTIALS: {
    field: 'password',
    message: "That email or password doesn't look right.",
    surface: 'inline',
  },
  INVALID_GOOGLE_ID_TOKEN: {
    message: "We couldn't verify that Google sign-in. Please try again.",
    surface: 'dialog',
    title: 'Google sign-in failed',
  },
  PASSWORD_RESET_TOKEN_INVALID: {
    field: 'token',
    message: 'That reset link is invalid or has expired. Request a new one.',
    surface: 'inline',
  },
  PENDING_ACCOUNT_NOT_FOUND: {
    message: "We couldn't find a pending sign-up for this email.",
    surface: 'inline',
  },
};

const providerFallbacks: Record<'apple' | 'google', AuthErrorPresentation> = {
  apple: {
    message: 'Apple sign-in could not be completed. Please try again.',
    surface: 'dialog',
    title: 'Apple sign-in failed',
  },
  google: {
    message: 'Google sign-in could not be completed. Please try again.',
    surface: 'dialog',
    title: 'Google sign-in failed',
  },
};

const inlineFallbacks: Record<
  Exclude<AuthErrorContext, 'apple' | 'email-choice' | 'google'>,
  string
> = {
  'create-account':
    "We couldn't create your account with those details. Please check them and try again.",
  'forgot-password':
    "We couldn't send a reset link right now. Please try again.",
  'resend-verification':
    "We couldn't send a new verification code right now. Please try again.",
  'reset-password':
    "We couldn't reset your password with that link. Please request a new one.",
  'sign-in':
    "We couldn't sign in with those details. Please check them and try again.",
  'verify-email':
    "We couldn't verify that code. Please check it and try again.",
};

const getValidationField = (error: ApiError): AuthFieldKey | undefined => {
  if (!error.details || typeof error.details !== 'object') {
    return undefined;
  }

  const details = error.details as { errors?: unknown };
  if (!Array.isArray(details.errors)) {
    return undefined;
  }

  for (const issue of details.errors) {
    if (!issue || typeof issue !== 'object' || !('path' in issue)) {
      continue;
    }

    const path = String((issue as { path?: unknown }).path || '');
    const field = path.split('.').pop();

    if (
      field === 'code' ||
      field === 'email' ||
      field === 'password' ||
      field === 'token'
    ) {
      return field;
    }
  }

  return undefined;
};

const getValidationPresentation = (
  field: AuthFieldKey,
): AuthErrorPresentation => {
  const messages: Record<AuthFieldKey, string> = {
    code: AUTH_VALIDATION_MESSAGES.codeRequired,
    confirmPassword: AUTH_VALIDATION_MESSAGES.confirmPasswordRequired,
    email: AUTH_VALIDATION_MESSAGES.emailInvalid,
    password: AUTH_VALIDATION_MESSAGES.passwordTooShort,
    token: AUTH_VALIDATION_MESSAGES.resetTokenMissing,
  };

  return {
    field,
    message: messages[field],
    surface: 'inline',
  };
};

const getDialogFallback = (): AuthErrorPresentation => ({
  message: "We couldn't complete that request right now. Please try again.",
  surface: 'dialog',
  title: 'Something went wrong',
});

// A native SDK error, a rejected token and a server fault all collapse into the
// same provider fallback sentence. Tagging it with a short reference code is the
// difference between a reproducible bug report and guesswork. The code only —
// never the raw error text, which is not written for users.
const getDiagnosticCode = (error: unknown): string | null => {
  if (error instanceof ApiError) {
    if (error.code) {
      return error.code;
    }

    return error.status ? `HTTP_${error.status}` : null;
  }

  const nativeCode = (error as { code?: unknown } | null)?.code;

  if (typeof nativeCode === 'string' && nativeCode) {
    return nativeCode;
  }

  return typeof nativeCode === 'number' ? `GSI_${nativeCode}` : null;
};

const withDiagnosticCode = (
  presentation: AuthErrorPresentation,
  error: unknown,
): AuthErrorPresentation => {
  const code = getDiagnosticCode(error);

  if (!code) {
    return presentation;
  }

  return { ...presentation, message: `${presentation.message} (${code})` };
};

const getAuthErrorPresentation = (
  error: unknown,
  context: AuthErrorContext,
): AuthErrorPresentation | null => {
  if (error instanceof ApiError && error.isNetworkError) {
    return null;
  }

  if (context === 'apple' || context === 'google') {
    if (error instanceof ApiError && error.code) {
      const knownPresentation = knownErrorPresentations[error.code];

      if (knownPresentation?.surface === 'dialog') {
        return knownPresentation;
      }
    }

    return withDiagnosticCode(providerFallbacks[context], error);
  }

  if (error instanceof ApiError) {
    if (error.status && error.status >= 500) {
      return getDialogFallback();
    }

    if (error.code && knownErrorPresentations[error.code]) {
      return knownErrorPresentations[error.code];
    }

    const validationField = getValidationField(error);
    if (validationField) {
      return getValidationPresentation(validationField);
    }

    if (context !== 'email-choice') {
      return {
        message: inlineFallbacks[context],
        surface: 'inline',
      };
    }
  }

  return getDialogFallback();
};

export { AUTH_VALIDATION_MESSAGES, getAuthErrorPresentation };
export type {
  AuthErrorContext,
  AuthErrorPresentation,
  AuthErrorSurface,
  AuthFieldKey,
};
