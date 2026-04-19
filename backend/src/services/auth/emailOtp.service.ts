import os from "os";
import tls from "tls";

type SendEmailVerificationInput = {
  email: string;
  code: string;
};

type EmailDeliveryMode = "console" | "smtp";

type SmtpMailInput = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  helloHost: string;
};

type SmtpResponse = {
  code: number;
  lines: string[];
};

const DEFAULT_RESEND_SMTP_HOST = "smtp.resend.com";
const DEFAULT_RESEND_SMTP_PORT = 465;
const DEFAULT_RESEND_SMTP_USERNAME = "resend";
const DEFAULT_FROM_NAME = "Journal.IO";
const DEFAULT_SMTP_TIMEOUT_MS = 15_000;

const getEnvValue = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const maskEmailAddress = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  const [localPart = "", domain = ""] = trimmed.split("@");

  if (!localPart || !domain) {
    return trimmed;
  }

  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] || ""}*`
      : `${localPart.slice(0, 2)}***`;

  return `${visibleLocal}@${domain}`;
};

const getDurationLabel = (value: string, fallback = "30 minutes") => {
  const match = value.trim().match(/^(\d+)([smhd])$/i);

  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback;
  }

  const unitLabels: Record<string, string> = {
    s: "second",
    m: "minute",
    h: "hour",
    d: "day",
  };
  const normalizedUnitKey = match[2]?.toLowerCase() || "m";
  const unit = unitLabels[normalizedUnitKey] || "minute";
  const suffix = amount === 1 ? "" : "s";

  return `${amount} ${unit}${suffix}`;
};

const getEmailDeliveryMode = (): EmailDeliveryMode => {
  const configuredMode = getEnvValue("AUTH_EMAIL_DELIVERY_MODE")?.toLowerCase();

  if (configuredMode === "console") {
    return "console";
  }

  if (configuredMode === "smtp") {
    return "smtp";
  }

  if (
    getEnvValue("RESEND_SMTP_PASSWORD") &&
    getEnvValue("AUTH_EMAIL_FROM_ADDRESS")
  ) {
    return "smtp";
  }

  return process.env.NODE_ENV === "production" ? "smtp" : "console";
};

const getSmtpPort = (): number => {
  const rawPort = getEnvValue("RESEND_SMTP_PORT");
  const parsedPort = rawPort ? Number(rawPort) : DEFAULT_RESEND_SMTP_PORT;

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error("RESEND_SMTP_PORT must be a valid positive integer.");
  }

  return parsedPort;
};

const buildSmtpMailInput = ({
  email,
  code,
}: SendEmailVerificationInput): SmtpMailInput => {
  const password = getEnvValue("RESEND_SMTP_PASSWORD");
  const fromAddress = getEnvValue("AUTH_EMAIL_FROM_ADDRESS");
  const replyTo = getEnvValue("AUTH_EMAIL_REPLY_TO");

  if (!password || !fromAddress) {
    throw new Error("Email verification delivery is not configured.");
  }

  const subject = "Your Journal.IO verification code";
  const expiryLabel = getDurationLabel(
    getEnvValue("AUTH_EMAIL_OTP_EXPIRES_IN") || "30m"
  );
  const text = [
    "Your Journal.IO verification code is:",
    "",
    code,
    "",
    `This code expires in ${expiryLabel}.`,
    "If you did not request this email, you can ignore it.",
  ].join("\n");

  return {
    host: getEnvValue("RESEND_SMTP_HOST") || DEFAULT_RESEND_SMTP_HOST,
    port: getSmtpPort(),
    username: getEnvValue("RESEND_SMTP_USERNAME") || DEFAULT_RESEND_SMTP_USERNAME,
    password,
    fromAddress,
    fromName: getEnvValue("AUTH_EMAIL_FROM_NAME") || DEFAULT_FROM_NAME,
    ...(replyTo ? { replyTo } : {}),
    to: email,
    subject,
    text,
    helloHost: getEnvValue("AUTH_EMAIL_HELO_HOST") || os.hostname() || "localhost",
  };
};

const sanitizeHeaderValue = (value: string) => {
  return value.replace(/[\r\n]+/g, " ").trim();
};

const formatAddressHeader = ({
  address,
  name,
}: {
  address: string;
  name?: string;
}) => {
  const sanitizedAddress = sanitizeHeaderValue(address);
  const sanitizedName = name ? sanitizeHeaderValue(name).replace(/"/g, '\\"') : "";

  if (!sanitizedName) {
    return `<${sanitizedAddress}>`;
  }

  return `"${sanitizedName}" <${sanitizedAddress}>`;
};

const buildMessageId = (fromAddress: string) => {
  const domain = fromAddress.split("@")[1] || "localhost";
  const uniquePart = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;

  return `<${uniquePart}@${domain}>`;
};

const buildSmtpMessage = ({
  fromAddress,
  fromName,
  replyTo,
  to,
  subject,
  text,
}: Pick<
  SmtpMailInput,
  "fromAddress" | "fromName" | "replyTo" | "to" | "subject" | "text"
>) => {
  const normalizedBody = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
  const headers = [
    `From: ${formatAddressHeader({ address: fromAddress, name: fromName })}`,
    `To: ${formatAddressHeader({ address: to })}`,
    ...(replyTo ? [`Reply-To: ${formatAddressHeader({ address: replyTo })}`] : []),
    `Subject: ${sanitizeHeaderValue(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${buildMessageId(fromAddress)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${normalizedBody}\r\n`;
};

const createSmtpResponseReader = (socket: tls.TLSSocket) => {
  let buffer = "";
  let activeResponseResolver:
    | {
        resolve: (response: SmtpResponse) => void;
        reject: (error: Error) => void;
        lines: string[];
      }
    | null = null;

  const flushBuffer = () => {
    if (!activeResponseResolver) {
      return;
    }

    while (true) {
      const lineBreakIndex = buffer.indexOf("\r\n");

      if (lineBreakIndex < 0) {
        return;
      }

      const line = buffer.slice(0, lineBreakIndex);
      buffer = buffer.slice(lineBreakIndex + 2);

      if (!line) {
        continue;
      }

      activeResponseResolver.lines.push(line);

      if (/^\d{3} /.test(line)) {
        const response = {
          code: Number(line.slice(0, 3)),
          lines: [...activeResponseResolver.lines],
        };
        const { resolve } = activeResponseResolver;
        activeResponseResolver = null;
        resolve(response);
        return;
      }

      if (!/^\d{3}-/.test(line)) {
        const { reject } = activeResponseResolver;
        activeResponseResolver = null;
        reject(new Error(`Unexpected SMTP response line: ${line}`));
        return;
      }
    }
  };

  socket.on("data", chunk => {
    buffer += chunk.toString("utf8");
    flushBuffer();
  });

  socket.on("error", error => {
    if (!activeResponseResolver) {
      return;
    }

    const { reject } = activeResponseResolver;
    activeResponseResolver = null;
    reject(error);
  });

  socket.on("close", () => {
    if (!activeResponseResolver) {
      return;
    }

    const { reject } = activeResponseResolver;
    activeResponseResolver = null;
    reject(new Error("SMTP connection closed unexpectedly."));
  });

  return {
    readResponse: () =>
      new Promise<SmtpResponse>((resolve, reject) => {
        if (activeResponseResolver) {
          reject(new Error("SMTP response already pending."));
          return;
        }

        activeResponseResolver = {
          resolve,
          reject,
          lines: [],
        };
        flushBuffer();
      }),
  };
};

const assertSmtpResponseCode = (
  response: SmtpResponse,
  allowedCodes: number[],
  stage: string
) => {
  if (allowedCodes.includes(response.code)) {
    return;
  }

  throw new Error(
    `SMTP ${stage} failed with ${response.code}: ${response.lines.join(" | ")}`
  );
};

const writeSmtpLine = (socket: tls.TLSSocket, line: string) => {
  socket.write(`${line}\r\n`);
};

const sendMailViaSmtp = async (input: SmtpMailInput) => {
  const socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
    const connection = tls.connect(
      {
        host: input.host,
        port: input.port,
        servername: input.host,
        minVersion: "TLSv1.2",
      },
      () => {
        resolve(connection);
      }
    );

    connection.setTimeout(DEFAULT_SMTP_TIMEOUT_MS, () => {
      connection.destroy(new Error("SMTP connection timed out."));
    });
    connection.once("error", reject);
  });
  const responseReader = createSmtpResponseReader(socket);

  try {
    assertSmtpResponseCode(
      await responseReader.readResponse(),
      [220],
      "connect"
    );

    writeSmtpLine(socket, `EHLO ${sanitizeHeaderValue(input.helloHost)}`);
    assertSmtpResponseCode(await responseReader.readResponse(), [250], "EHLO");

    const authToken = Buffer.from(
      `\0${input.username}\0${input.password}`,
      "utf8"
    ).toString("base64");
    writeSmtpLine(socket, `AUTH PLAIN ${authToken}`);
    assertSmtpResponseCode(await responseReader.readResponse(), [235], "AUTH");

    writeSmtpLine(socket, `MAIL FROM:<${sanitizeHeaderValue(input.fromAddress)}>`);
    assertSmtpResponseCode(
      await responseReader.readResponse(),
      [250],
      "MAIL FROM"
    );

    writeSmtpLine(socket, `RCPT TO:<${sanitizeHeaderValue(input.to)}>`);
    assertSmtpResponseCode(
      await responseReader.readResponse(),
      [250, 251],
      "RCPT TO"
    );

    writeSmtpLine(socket, "DATA");
    assertSmtpResponseCode(await responseReader.readResponse(), [354], "DATA");

    socket.write(`${buildSmtpMessage(input)}\r\n.\r\n`);
    assertSmtpResponseCode(
      await responseReader.readResponse(),
      [250],
      "message send"
    );

    writeSmtpLine(socket, "QUIT");
    await responseReader.readResponse().catch(() => null);
  } finally {
    socket.end();
  }
};

let sendMailViaSmtpImpl = sendMailViaSmtp;

const setSmtpTransportForTests = (transport: typeof sendMailViaSmtp) => {
  sendMailViaSmtpImpl = transport;
};

const resetSmtpTransportForTests = () => {
  sendMailViaSmtpImpl = sendMailViaSmtp;
};

const sendEmailVerificationCode = async ({
  email,
  code,
}: SendEmailVerificationInput) => {
  const deliveryMode = getEmailDeliveryMode();

  if (deliveryMode === "console") {
    console.info(`[Auth] Email verification code for ${email}: ${code}`);
    return;
  }

  console.info("[Auth][email_verification] smtp_delivery", {
    mode: deliveryMode,
    to: maskEmailAddress(email),
    fromAddress: maskEmailAddress(
      getEnvValue("AUTH_EMAIL_FROM_ADDRESS") || "missing-from-address"
    ),
    helloHost: getEnvValue("AUTH_EMAIL_HELO_HOST") || os.hostname() || "localhost",
  });

  await sendMailViaSmtpImpl(buildSmtpMailInput({ email, code }));
};

export {
  resetSmtpTransportForTests,
  sendEmailVerificationCode,
  setSmtpTransportForTests,
};
