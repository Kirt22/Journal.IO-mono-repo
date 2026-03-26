import https from "https";

type SendOtpSmsInput = {
  phoneNumber: string;
};

type VerifyOtpSmsInput = {
  phoneNumber: string;
  otp: string;
};

type ResendOtpSmsInput = {
  phoneNumber: string;
  retryType?: "text";
};

type Msg91ApiResponse = {
  type?: string;
  message?: string;
};

const getEnvValue = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const isMsg91SmsConfigured = (): boolean => {
  return Boolean(getEnvValue("MSG91_AUTH_KEY") && getEnvValue("MSG91_TEMPLATE_ID"));
};

const buildMsg91OtpUrl = ({ phoneNumber }: SendOtpSmsInput): URL => {
  const authKey = getEnvValue("MSG91_AUTH_KEY");
  const templateId = getEnvValue("MSG91_TEMPLATE_ID");
  const apiUrl =
    getEnvValue("MSG91_OTP_API_URL") ||
    "https://control.msg91.com/api/v5/otp";

  if (!authKey || !templateId) {
    throw new Error("MSG91 SMS service is not configured.");
  }

  const url = new URL(apiUrl);
  url.searchParams.set("authkey", authKey);
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", phoneNumber);

  return url;
};

const buildMsg91VerifyOtpUrl = ({
  phoneNumber,
  otp,
}: VerifyOtpSmsInput): URL => {
  const authKey = getEnvValue("MSG91_AUTH_KEY");
  const apiUrl =
    getEnvValue("MSG91_OTP_VERIFY_API_URL") ||
    "https://control.msg91.com/api/v5/otp/verify";

  if (!authKey) {
    throw new Error("MSG91 SMS service is not configured.");
  }

  const url = new URL(apiUrl);
  url.searchParams.set("otp", otp);
  url.searchParams.set("mobile", phoneNumber);

  return url;
};

const buildMsg91RetryOtpUrl = ({
  phoneNumber,
  retryType = "text",
}: ResendOtpSmsInput): URL => {
  const authKey = getEnvValue("MSG91_AUTH_KEY");
  const apiUrl =
    getEnvValue("MSG91_OTP_RETRY_API_URL") ||
    "https://control.msg91.com/api/v5/otp/retry";

  if (!authKey) {
    throw new Error("MSG91 SMS service is not configured.");
  }

  const url = new URL(apiUrl);
  url.searchParams.set("authkey", authKey);
  url.searchParams.set("retrytype", retryType);
  url.searchParams.set("mobile", phoneNumber);

  return url;
};

const parseMsg91Response = (body: string): Msg91ApiResponse | null => {
  try {
    return JSON.parse(body) as Msg91ApiResponse;
  } catch {
    return null;
  }
};

const sendOtpSmsViaMsg91 = async (input: SendOtpSmsInput): Promise<void> => {
  const url = buildMsg91OtpUrl(input);

  await new Promise<void>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      },
      response => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });

        response.on("end", () => {
          const parsedResponse = parseMsg91Response(body);
          const isSuccessfulStatus =
            typeof response.statusCode === "number" &&
            response.statusCode >= 200 &&
            response.statusCode < 300;
          const isSuccessfulBody =
            parsedResponse?.type === "success" ||
            /"type"\s*:\s*"success"/i.test(body);

          if (isSuccessfulStatus && isSuccessfulBody) {
            resolve();
            return;
          }

          const failureMessage =
            parsedResponse?.message || body.trim() || `HTTP ${response.statusCode || "unknown"}`;
          reject(new Error(`MSG91 OTP delivery failed: ${failureMessage}`));
        });
      }
    );

    request.on("error", error => {
      reject(error);
    });

    request.write("{}");
    request.end();
  });
};

const verifyOtpSmsViaMsg91 = async (input: VerifyOtpSmsInput): Promise<void> => {
  const url = buildMsg91VerifyOtpUrl(input);
  const authKey = getEnvValue("MSG91_AUTH_KEY");

  if (!authKey) {
    throw new Error("MSG91 SMS service is not configured.");
  }

  await new Promise<void>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          authkey: authKey,
          accept: "application/json",
        },
      },
      response => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });

        response.on("end", () => {
          const parsedResponse = parseMsg91Response(body);
          const normalizedMessage = `${parsedResponse?.message || body}`.toLowerCase();
          const isSuccessfulStatus =
            typeof response.statusCode === "number" &&
            response.statusCode >= 200 &&
            response.statusCode < 300;
          const isSuccessfulBody =
            parsedResponse?.type === "success" ||
            normalizedMessage.includes("otp verified success") ||
            normalizedMessage.includes("number_verified_successfully");

          if (isSuccessfulStatus && isSuccessfulBody) {
            resolve();
            return;
          }

          const failureMessage =
            parsedResponse?.message || body.trim() || `HTTP ${response.statusCode || "unknown"}`;
          reject(new Error(`MSG91 OTP verification failed: ${failureMessage}`));
        });
      }
    );

    request.on("error", error => {
      reject(error);
    });

    request.end();
  });
};

const resendOtpSmsViaMsg91 = async (
  input: ResendOtpSmsInput
): Promise<void> => {
  const url = buildMsg91RetryOtpUrl(input);

  await new Promise<void>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      },
      response => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });

        response.on("end", () => {
          const parsedResponse = parseMsg91Response(body);
          const normalizedMessage = `${parsedResponse?.message || body}`.toLowerCase();
          const isSuccessfulStatus =
            typeof response.statusCode === "number" &&
            response.statusCode >= 200 &&
            response.statusCode < 300;
          const isSuccessfulBody =
            parsedResponse?.type === "success" ||
            normalizedMessage.includes("success");

          if (isSuccessfulStatus && isSuccessfulBody) {
            resolve();
            return;
          }

          const failureMessage =
            parsedResponse?.message || body.trim() || `HTTP ${response.statusCode || "unknown"}`;
          reject(new Error(`MSG91 OTP retry failed: ${failureMessage}`));
        });
      }
    );

    request.on("error", error => {
      reject(error);
    });

    request.end();
  });
};

export {
  isMsg91SmsConfigured,
  resendOtpSmsViaMsg91,
  sendOtpSmsViaMsg91,
  verifyOtpSmsViaMsg91,
};
