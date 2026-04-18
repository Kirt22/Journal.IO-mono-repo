import { request } from "../utils/apiClient";

type PrivacyExportOnboardingContext = {
  ageRange: string | null;
  journalingExperience: string | null;
  goals: string[];
  supportFocus: string[];
  reminderPreference: string | null;
  aiOptIn: boolean | null;
  privacyConsentAccepted: boolean | null;
};

type PrivacyExportAccount = {
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  authProviders: string[];
  journalingGoals: string[];
  onboardingContext: PrivacyExportOnboardingContext | null;
  avatarColor: string | null;
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  profilePic: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PrivacyExportJournalEntry = {
  _id: string;
  title: string;
  content: string;
  type: string;
  aiPrompt: string | null;
  tags: string[];
  images: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

type PrivacyExportMoodEntry = {
  _id: string;
  mood: "amazing" | "good" | "okay" | "bad" | "terrible";
  moodDateKey: string;
  createdAt: string;
  updatedAt: string;
};

type PrivacyExportInsights = {
  totalEntries: number;
  totalWords: number;
  totalFavorites: number;
  dailyJournalCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  moodCounts: Record<string, number>;
  lastJournalDateKey: string | null;
  lastCalculatedAt: string | null;
  aiAnalysis: unknown;
  aiAnalysisStale: boolean;
  aiAnalysisComputedAt: string | null;
  aiAnalysisWindowEndDateKey: string | null;
  createdAt: string;
  updatedAt: string;
};

type PrivacyExportStreak = {
  streak: number;
  streakStartDate: string;
  streakEndDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type PrivacyExportStats = {
  journalsWritten: number;
  totalWordsWritten: number;
  createdAt: string;
  updatedAt: string;
};

type PrivacyExportResponse = {
  exportedAt: string;
  account: PrivacyExportAccount;
  journalEntries: PrivacyExportJournalEntry[];
  moodCheckIns: PrivacyExportMoodEntry[];
  insights: PrivacyExportInsights | null;
  streak: PrivacyExportStreak | null;
  stats: PrivacyExportStats | null;
};

type DeleteAccountResponse = {
  deletedAccount: boolean;
  deletedJournals: number;
  deletedMoodCheckIns: number;
  deletedInsights: number;
  deletedStreaks: number;
  deletedStats: number;
};

type UpdateAiOptOutResponse = {
  aiOptIn: boolean;
};

const exportAllEntries = async () => {
  const response = await request<PrivacyExportResponse>("/privacy/export", {
    method: "POST",
  });

  return response.data;
};

const deleteAccount = async () => {
  const response = await request<DeleteAccountResponse>(
    "/privacy/delete-request",
    {
      method: "POST",
    }
  );

  return response.data;
};

const updateAiOptOutPreference = async (aiOptOut: boolean) => {
  const response = await request<UpdateAiOptOutResponse>(
    "/privacy/ai-opt-out",
    {
      method: "PATCH",
      body: JSON.stringify({ aiOptOut }),
    }
  );

  return response.data;
};

export {
  deleteAccount,
  exportAllEntries,
  updateAiOptOutPreference,
};
export type {
  DeleteAccountResponse,
  PrivacyExportAccount,
  PrivacyExportInsights,
  PrivacyExportJournalEntry,
  PrivacyExportMoodEntry,
  PrivacyExportOnboardingContext,
  PrivacyExportResponse,
  PrivacyExportStats,
  PrivacyExportStreak,
  UpdateAiOptOutResponse,
};
