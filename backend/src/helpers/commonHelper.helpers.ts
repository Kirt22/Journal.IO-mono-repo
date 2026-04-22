export const apiResponse = (success: boolean, message: string, data: any, extras?: any) => {
  return {
    success,
    message,
    data,
    ...extras
  };
};

export const API_MESSAGES = {
  unauthorized: "Please sign in to continue.",
  internalError: "Something went wrong. Please try again.",
  validationFailed: "Please review the details and try again.",
  routeNotFound: "We couldn't find what you were looking for.",
  userNotFound: "We couldn't find your account.",
  sessionExpired: "Your session has ended. Please sign in again.",
} as const;

export const notFoundMessage = (resource: string) =>
  `We couldn't find that ${resource}.`;
