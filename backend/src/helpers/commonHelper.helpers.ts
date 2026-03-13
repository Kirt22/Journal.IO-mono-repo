export const apiResponse = (success: boolean, message: string, data: any, extras?: any) => {
  return {
    success,
    message,
    data,
    ...extras
  };
};
