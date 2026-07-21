import { ApiError } from '../src/utils/apiClient';
import {
  AUTH_VALIDATION_MESSAGES,
  getAuthErrorPresentation,
} from '../src/screens/auth/authErrorPresentation';

describe('auth error presentation', () => {
  test('maps credential and registration codes to field-aware inline errors', () => {
    expect(
      getAuthErrorPresentation(
        new ApiError('raw credentials message', {
          code: 'INVALID_CREDENTIALS',
          status: 401,
        }),
        'sign-in',
      ),
    ).toEqual({
      field: 'password',
      message: "That email or password doesn't look right.",
      surface: 'inline',
    });

    expect(
      getAuthErrorPresentation(
        new ApiError('raw registration message', {
          code: 'EMAIL_ALREADY_REGISTERED',
          status: 409,
        }),
        'create-account',
      ),
    ).toEqual({
      field: 'email',
      message: 'An account already exists for this email. Sign in instead.',
      surface: 'inline',
    });
  });

  test('normalizes backend validation paths without exposing raw messages', () => {
    const presentation = getAuthErrorPresentation(
      new ApiError('Validation failed', {
        details: {
          errors: [
            {
              path: 'body.email',
              message: 'Expected a branded email schema value',
            },
          ],
        },
        status: 400,
      }),
      'create-account',
    );

    expect(presentation).toEqual({
      field: 'email',
      message: AUTH_VALIDATION_MESSAGES.emailInvalid,
      surface: 'inline',
    });
    expect(presentation?.message).not.toContain('branded');
  });

  test('defers connectivity failures to the global gate and keeps server dialogs', () => {
    expect(
      getAuthErrorPresentation(
        new ApiError('Network request failed', { isNetworkError: true }),
        'forgot-password',
      ),
    ).toBeNull();

    expect(
      getAuthErrorPresentation(
        new ApiError('Internal stack details', { status: 503 }),
        'reset-password',
      ),
    ).toEqual({
      message: "We couldn't complete that request right now. Please try again.",
      surface: 'dialog',
      title: 'Something went wrong',
    });
  });

  test('uses provider-specific dialogs and hides raw SDK errors', () => {
    const rawProviderError = new Error(
      'com.apple.AuthenticationServices.AuthorizationError 1004',
    );
    const presentation = getAuthErrorPresentation(rawProviderError, 'apple');

    expect(presentation).toEqual({
      message: 'Apple sign-in could not be completed. Please try again.',
      surface: 'dialog',
      title: 'Apple sign-in failed',
    });
    expect(presentation?.message).not.toContain('AuthorizationError');
  });

  test('keeps every provider failure on the dialog surface', () => {
    const presentation = getAuthErrorPresentation(
      new ApiError('Unexpected cross-flow code', {
        code: 'EMAIL_ALREADY_REGISTERED',
        status: 409,
      }),
      'google',
    );

    expect(presentation).toEqual({
      message: 'Google sign-in could not be completed. Please try again.',
      surface: 'dialog',
      title: 'Google sign-in failed',
    });
  });
});
