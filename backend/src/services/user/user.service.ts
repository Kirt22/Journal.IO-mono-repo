import { IUser, userModel } from "../../schema/user.schema";

type UserProfilePayload = {
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  isPremium: boolean;
  premiumPlanKey: "weekly" | "monthly" | "yearly" | "lifetime" | null;
  premiumActivatedAt: string | null;
  avatarColor: string | null;
  journalingGoals: string[];
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  profilePic: string | null;
  aiOptIn: boolean | null;
};

type UpdateProfileInput = {
  name: string;
  avatarColor?: string | null;
  goals?: string[];
};

type UpdatePremiumStatusInput = {
  isPremium: boolean;
};

const buildUserProfilePayload = (user: IUser): UserProfilePayload => {
  return {
    userId: user._id.toString(),
    name: user.name,
    phoneNumber: user.phoneNumber || null,
    email: user.email || null,
    isPremium: Boolean(user.isPremium),
    premiumPlanKey: user.premiumPlanKey || null,
    premiumActivatedAt: user.premiumActivatedAt?.toISOString() || null,
    avatarColor: user.avatarColor || null,
    journalingGoals: user.journalingGoals || [],
    profileSetupCompleted: Boolean(user.profileSetupCompleted),
    onboardingCompleted: Boolean(user.onboardingCompleted),
    profilePic: user.profilePic || null,
    aiOptIn:
      typeof user.onboardingContext?.aiOptIn === "boolean"
        ? user.onboardingContext.aiOptIn
        : null,
  };
};

const getProfile = async (userId: string): Promise<UserProfilePayload | null> => {
  const user = await userModel.findById(userId);

  if (!user) {
    return null;
  }

  return buildUserProfilePayload(user);
};

const updateProfile = async (
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfilePayload | null> => {
  const user = await userModel.findById(userId);

  if (!user) {
    return null;
  }

  user.name = input.name.trim();
  user.avatarColor = input.avatarColor?.trim() || null;
  if (input.goals) {
    user.journalingGoals = Array.from(
      new Set(input.goals.map(goal => goal.trim()).filter(Boolean))
    );
  }
  user.profileSetupCompleted = true;
  user.onboardingCompleted = true;

  await user.save();

  return buildUserProfilePayload(user);
};

const updatePremiumStatus = async (
  userId: string,
  input: UpdatePremiumStatusInput
): Promise<UserProfilePayload | null> => {
  const user = await userModel.findById(userId);

  if (!user) {
    return null;
  }

  user.isPremium = input.isPremium;
  user.premiumPlanKey = input.isPremium ? user.premiumPlanKey || null : null;
  user.premiumActivatedAt = input.isPremium ? user.premiumActivatedAt || new Date() : null;
  user.premiumSource = input.isPremium ? user.premiumSource || null : null;
  await user.save();

  return buildUserProfilePayload(user);
};

export { getProfile, updatePremiumStatus, updateProfile, buildUserProfilePayload };
export type { UpdatePremiumStatusInput, UpdateProfileInput, UserProfilePayload };
