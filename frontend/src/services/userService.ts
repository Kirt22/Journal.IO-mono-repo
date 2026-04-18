import { request } from "../utils/apiClient";
import { applyDevPremiumDefault, type AuthUser } from "./authService";

type UpdateProfilePayload = {
  name: string;
  avatarColor?: string | null;
  goals?: string[];
};

type UpdatePremiumStatusPayload = {
  isPremium: boolean;
};

type ProfileResponse = AuthUser;

const getProfile = async () => {
  const response = await request<ProfileResponse>("/users/profile", {
    method: "GET",
  });

  return applyDevPremiumDefault(response.data);
};

const updateProfile = async (payload: UpdateProfilePayload) => {
  const response = await request<ProfileResponse>("/users/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return applyDevPremiumDefault(response.data);
};

const updatePremiumStatus = async (payload: UpdatePremiumStatusPayload) => {
  const response = await request<ProfileResponse>("/users/premium-status", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return applyDevPremiumDefault(response.data);
};

export { getProfile, updatePremiumStatus, updateProfile };
export type { ProfileResponse, UpdatePremiumStatusPayload, UpdateProfilePayload };
