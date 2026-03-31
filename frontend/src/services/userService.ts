import { request } from "../utils/apiClient";
import type { AuthUser } from "./authService";

type UpdateProfilePayload = {
  name: string;
  avatarColor?: string | null;
  goals?: string[];
};

type ProfileResponse = AuthUser;

const getProfile = async () => {
  const response = await request<ProfileResponse>("/users/profile", {
    method: "GET",
  });

  return response.data;
};

const updateProfile = async (payload: UpdateProfilePayload) => {
  const response = await request<ProfileResponse>("/users/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return response.data;
};

export { getProfile, updateProfile };
export type { UpdateProfilePayload, ProfileResponse };
