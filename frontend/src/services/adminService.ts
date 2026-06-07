import { request } from "../utils/apiClient";

type HomeOfferConfig = {
  homeSummerOfferVisible: boolean;
};

const getHomeOfferConfig = async () => {
  const response = await request<HomeOfferConfig>("/admin/home-offer", {
    method: "GET",
  });

  return response.data;
};

export { getHomeOfferConfig, type HomeOfferConfig };
