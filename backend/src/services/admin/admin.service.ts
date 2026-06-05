import { adminConfigModel } from "../../schema/adminConfig.schema";

type HomeOfferConfig = {
  homeSummerOfferVisible: boolean;
};

const DEFAULT_ADMIN_CONFIG: HomeOfferConfig = {
  homeSummerOfferVisible: true,
};

const getHomeOfferConfig = async (): Promise<HomeOfferConfig> => {
  const config = await adminConfigModel
    .findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global", ...DEFAULT_ADMIN_CONFIG } },
      { new: true, upsert: true }
    )
    .lean()
    .exec();

  return {
    homeSummerOfferVisible:
      config?.homeSummerOfferVisible ??
      DEFAULT_ADMIN_CONFIG.homeSummerOfferVisible,
  };
};

export { DEFAULT_ADMIN_CONFIG, getHomeOfferConfig };
