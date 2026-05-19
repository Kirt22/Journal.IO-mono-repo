import { Linking, NativeModules, Platform } from "react-native";
import { env } from "../config/env";

export type AppRatingRequestResult =
  | { status: "requested" }
  | { status: "opened" }
  | { status: "unavailable" }
  | { status: "failed"; error: unknown };

type NativeAppRatingModule = {
  requestReview?: () => Promise<boolean | void>;
};

const nativeAppRatingModule = NativeModules.AppRatingModule as
  | NativeAppRatingModule
  | undefined;

const openUrl = async (url: string): Promise<AppRatingRequestResult> => {
  try {
    await Linking.openURL(url);
    return { status: "opened" };
  } catch (error) {
    return { status: "failed", error };
  }
};

export const requestAppRating = async (): Promise<AppRatingRequestResult> => {
  if (nativeAppRatingModule?.requestReview) {
    try {
      await nativeAppRatingModule.requestReview();
      return { status: "requested" };
    } catch (error) {
      return { status: "failed", error };
    }
  }

  if (Platform.OS === "ios" && env.iosAppStoreId) {
    return openUrl(
      `itms-apps://itunes.apple.com/app/id${env.iosAppStoreId}?action=write-review`
    );
  }

  if (Platform.OS === "android" && env.androidPlayStorePackageName) {
    const packageName = encodeURIComponent(env.androidPlayStorePackageName);
    const marketResult = await openUrl(`market://details?id=${packageName}`);

    if (marketResult.status === "opened") {
      return marketResult;
    }

    return openUrl(
      `https://play.google.com/store/apps/details?id=${packageName}`
    );
  }

  return { status: "unavailable" };
};
