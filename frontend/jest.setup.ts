jest.mock("react-native-keychain", () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: "AccessibleWhenPasscodeSetThisDeviceOnly",
  },
  ACCESS_CONTROL: {
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: "BiometryAnyOrDevicePasscode",
  },
  AUTHENTICATION_TYPE: {
    DEVICE_PASSCODE_OR_BIOMETRICS:
      "AuthenticationWithBiometricsDevicePasscode",
  },
  BIOMETRY_TYPE: {
    FACE_ID: "FaceID",
    TOUCH_ID: "TouchID",
  },
  canImplyAuthentication: jest.fn(async () => false),
  getGenericPassword: jest.fn(async () => false),
  getSupportedBiometryType: jest.fn(async () => null),
  hasGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock("@notifee/react-native", () => require("@notifee/react-native/jest-mock"));

jest.mock(
  "@env",
  () => ({
    API_BASE_URL: "",
    FRONTEND_ENV: "",
    GOOGLE_WEB_CLIENT_ID: "",
    GOOGLE_IOS_CLIENT_ID: "",
    REVENUECAT_IOS_API_KEY: "",
    REVENUECAT_ANDROID_API_KEY: "",
    IOS_APP_STORE_ID: "",
    ANDROID_PLAY_STORE_PACKAGE_NAME: "",
  }),
  { virtual: true }
);

jest.mock(
  "react-native-purchases-ui",
  () => {
    const PAYWALL_RESULT = {
      NOT_PRESENTED: "NOT_PRESENTED",
      ERROR: "ERROR",
      CANCELLED: "CANCELLED",
      PURCHASED: "PURCHASED",
      RESTORED: "RESTORED",
    };

    return {
      __esModule: true,
      PAYWALL_RESULT,
      CustomVariableValue: {
        string: (value: string) => ({ type: "string", value }),
        number: (value: number) => ({ type: "number", value }),
        boolean: (value: boolean) => ({ type: "boolean", value }),
      },
      default: {
        Paywall: jest.fn(() => null),
        presentPaywall: jest.fn(async () => PAYWALL_RESULT.CANCELLED),
      },
    };
  },
  { virtual: true }
);

jest.mock("react-native-webview", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("react-native-video", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("react-native-svg", () => {
  const ReactModule = require("react");
  const component = (name: string) =>
    jest.fn(({ children, ...props }: { children?: unknown }) =>
      ReactModule.createElement(name, props, children ?? null),
    );

  return {
    __esModule: true,
    default: component("Svg"),
    Svg: component("Svg"),
    Circle: component("SvgCircle"),
    ClipPath: component("SvgClipPath"),
    Defs: component("SvgDefs"),
    Ellipse: component("SvgEllipse"),
    G: component("SvgG"),
    Line: component("SvgLine"),
    LinearGradient: component("SvgLinearGradient"),
    Mask: component("SvgMask"),
    Path: component("SvgPath"),
    Polygon: component("SvgPolygon"),
    Polyline: component("SvgPolyline"),
    RadialGradient: component("SvgRadialGradient"),
    Rect: component("SvgRect"),
    Stop: component("SvgStop"),
    Symbol: component("SvgSymbol"),
    Use: component("SvgUse"),
  };
});

jest.mock(
  "react-native/Libraries/ReactPrivate/ReactNativePrivateInterface",
  () => {
    const actual = jest.requireActual(
      "react-native/Libraries/ReactPrivate/ReactNativePrivateInterface",
    );

    return {
      ...actual,
      getNativeTagFromPublicInstance: jest.fn(() => 1),
    };
  },
);

jest.mock("react-native-purchases", () => {
  const mockModule = {
    LOG_LEVEL: {
      DEBUG: "DEBUG",
      INFO: "INFO",
    },
    PACKAGE_TYPE: {
      ANNUAL: "ANNUAL",
      WEEKLY: "WEEKLY",
      MONTHLY: "MONTHLY",
      LIFETIME: "LIFETIME",
      CUSTOM: "CUSTOM",
      UNKNOWN: "UNKNOWN",
    },
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: "1",
      NETWORK_ERROR: "10",
      PAYMENT_PENDING_ERROR: "20",
      CONFIGURATION_ERROR: "23",
      OFFLINE_CONNECTION_ERROR: "35",
    },
    isConfigured: jest.fn(async () => false),
    setLogLevel: jest.fn(async () => undefined),
    configure: jest.fn(),
    getAppUserID: jest.fn(async () => "anonymous"),
    logIn: jest.fn(async () => ({
      customerInfo: null,
      created: false,
    })),
    logOut: jest.fn(async () => null),
    getOfferings: jest.fn(async () => ({
      current: null,
      all: {},
    })),
    getCustomerInfo: jest.fn(async () => null),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockModule,
    ...mockModule,
  };
});

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({
      data: {
        idToken: "mock-google-id-token",
      },
    })),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
}));

jest.mock("@invertase/react-native-apple-authentication", () => {
  const appleAuth = {
    Error: {
      CANCELED: "1001",
    },
    Operation: {
      LOGIN: "LOGIN",
    },
    Scope: {
      EMAIL: "EMAIL",
      FULL_NAME: "FULL_NAME",
    },
    isSupported: true,
    performRequest: jest.fn(async () => ({
      identityToken: "mock-apple-identity-token",
      email: "alex@example.com",
      fullName: {
        givenName: "Alex",
        familyName: "Appleseed",
        nickname: null,
      },
    })),
  };

  const AppleButton = Object.assign(jest.fn(() => null), {
    Style: {
      BLACK: "BLACK",
    },
    Type: {
      CONTINUE: "CONTINUE",
    },
  });

  return {
    __esModule: true,
    default: appleAuth,
    AppleButton,
  };
});

// Skia needs a native binding, so the whole module is stubbed. The canvas tree
// renders as plain views; what the Orb tests actually assert is the SkSL source
// text, the accessibility props, and the scroll interpolation.
jest.mock("@shopify/react-native-skia", () => {
  const ReactModule = require("react");

  const passthrough = (name: string) =>
    jest.fn(({ children }: { children?: unknown }) =>
      ReactModule.createElement(name, null, children ?? null),
    );

  return {
    __esModule: true,
    Canvas: passthrough("SkiaCanvas"),
    Fill: passthrough("SkiaFill"),
    Shader: passthrough("SkiaShader"),
    Group: passthrough("SkiaGroup"),
    Circle: passthrough("SkiaCircle"),
    Blur: passthrough("SkiaBlur"),
    Paint: passthrough("SkiaPaint"),
    Skia: {
      RuntimeEffect: {
        Make: jest.fn(() => ({ __mockRuntimeEffect: true })),
      },
    },
  };
});

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  useSharedValue: jest.fn((initial: unknown) => ({ value: initial })),
  useDerivedValue: jest.fn((factory: () => unknown) => ({ value: factory() })),
  useFrameCallback: jest.fn(() => ({
    setActive: jest.fn(),
    isActive: false,
  })),
  withTiming: jest.fn((value: unknown) => value),
  // Resolves to the FIRST step so a test can observe the peak of a sequence —
  // the settle back to rest is the part that needs a real clock, and asserting
  // on the resting value would prove nothing.
  withSequence: jest.fn((...steps: unknown[]) => steps[0]),
  cancelAnimation: jest.fn(),
  runOnJS: jest.fn((fn: unknown) => fn),
  Easing: {
    ease: (value: number) => value,
    quad: (value: number) => value,
    cubic: (value: number) => value,
    out: jest.fn((easing: unknown) => easing),
    in: jest.fn((easing: unknown) => easing),
    inOut: jest.fn((easing: unknown) => easing),
  },
}));
