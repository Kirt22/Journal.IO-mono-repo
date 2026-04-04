import { journalModel, type IJournal } from "../../schema/journal.schema";
import { moodCheckInModel, type IMoodCheckIn } from "../../schema/mood.schema";
import { insightsModel, type IInsights } from "../../schema/insights.schema";
import { reminderModel, type IReminder } from "../../schema/reminder.schema";
import { streaksModel, type IStreak } from "../../schema/streak.schema";
import { statsModel, type IStat } from "../../schema/stat.schema";
import { userModel, type IUser } from "../../schema/user.schema";
import { invalidateRefreshToken } from "../auth/auth.service";
import type { MoodValue } from "../../types/mood.types";

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
  mood: MoodValue;
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

type PrivacyExportReminder = {
  _id: string;
  type: string;
  enabled: boolean;
  time: string;
  timezone: string;
  skipIfCompletedToday: boolean;
  includeWeekends: boolean;
  streakWarnings: boolean;
  createdAt: string;
  updatedAt: string;
};

type PrivacyExportPayload = {
  exportedAt: string;
  account: PrivacyExportAccount;
  journalEntries: PrivacyExportJournalEntry[];
  moodCheckIns: PrivacyExportMoodEntry[];
  reminders: PrivacyExportReminder[];
  insights: PrivacyExportInsights | null;
  streak: PrivacyExportStreak | null;
  stats: PrivacyExportStats | null;
};

type DeleteAccountResult = {
  deletedAccount: boolean;
  deletedJournals: number;
  deletedMoodCheckIns: number;
  deletedReminders: number;
  deletedInsights: number;
  deletedStreaks: number;
  deletedStats: number;
};

type UpdateAiOptOutResult = {
  aiOptIn: boolean;
};

const toIso = (value: unknown): string => {
  if (!value) {
    return new Date(0).toISOString();
  }

  const date = new Date(value as string | number | Date);

  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const toIsoOrNull = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  return toIso(value);
};

const toRecord = (value: unknown): Record<string, number> => {
  if (!value) {
    return {};
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, rawValue]) => [key, Number(rawValue) || 0])
    );
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, rawValue]) => [
        key,
        Number(rawValue) || 0,
      ])
    );
  }

  return {};
};

const serializeOnboardingContext = (
  onboardingContext: IUser["onboardingContext"]
): PrivacyExportOnboardingContext | null => {
  if (!onboardingContext) {
    return null;
  }

  return {
    ageRange: onboardingContext.ageRange ?? null,
    journalingExperience: onboardingContext.journalingExperience ?? null,
    goals: Array.isArray(onboardingContext.goals) ? onboardingContext.goals : [],
    supportFocus: Array.isArray(onboardingContext.supportFocus)
      ? onboardingContext.supportFocus
      : [],
    reminderPreference: onboardingContext.reminderPreference ?? null,
    aiOptIn:
      typeof onboardingContext.aiOptIn === "boolean" ? onboardingContext.aiOptIn : null,
    privacyConsentAccepted:
      typeof onboardingContext.privacyConsentAccepted === "boolean"
        ? onboardingContext.privacyConsentAccepted
        : null,
  };
};

const serializeUser = (user: IUser): PrivacyExportAccount => {
  const userObject = user.toObject() as Record<string, any>;

  return {
    userId: userObject._id.toString(),
    name: userObject.name,
    phoneNumber: userObject.phoneNumber ?? null,
    email: userObject.email ?? null,
    emailVerified: Boolean(userObject.emailVerified),
    emailVerifiedAt: toIsoOrNull(userObject.emailVerifiedAt),
    authProviders: Array.isArray(userObject.authProviders) ? userObject.authProviders : [],
    journalingGoals: Array.isArray(userObject.journalingGoals)
      ? userObject.journalingGoals
      : [],
    onboardingContext: serializeOnboardingContext(userObject.onboardingContext),
    avatarColor: userObject.avatarColor ?? null,
    profileSetupCompleted: Boolean(userObject.profileSetupCompleted),
    onboardingCompleted: Boolean(userObject.onboardingCompleted),
    profilePic: userObject.profilePic ?? null,
    lastLoginAt: toIsoOrNull(userObject.lastLoginAt),
    createdAt: toIso(userObject.createdAt),
    updatedAt: toIso(userObject.updatedAt),
  };
};

const serializeJournal = (journal: IJournal): PrivacyExportJournalEntry => {
  const journalObject = journal.toObject() as Record<string, any>;

  return {
    _id: journalObject._id.toString(),
    title: journalObject.title,
    content: journalObject.content,
    type: journalObject.type,
    aiPrompt: typeof journalObject.aiPrompt === "string" ? journalObject.aiPrompt : null,
    tags: Array.isArray(journalObject.tags) ? journalObject.tags : [],
    images: Array.isArray(journalObject.images) ? journalObject.images : [],
    isFavorite: Boolean(journalObject.isFavorite),
    createdAt: toIso(journalObject.createdAt),
    updatedAt: toIso(journalObject.updatedAt),
  };
};

const serializeMood = (moodCheckIn: IMoodCheckIn): PrivacyExportMoodEntry => {
  const moodObject = moodCheckIn.toObject() as Record<string, any>;

  return {
    _id: moodObject._id.toString(),
    mood: moodObject.mood,
    moodDateKey: moodObject.moodDateKey,
    createdAt: toIso(moodObject.createdAt),
    updatedAt: toIso(moodObject.updatedAt),
  };
};

const serializeInsights = (insights: IInsights): PrivacyExportInsights => {
  const insightsObject = insights.toObject() as Record<string, any>;

  return {
    totalEntries: Number(insightsObject.totalEntries) || 0,
    totalWords: Number(insightsObject.totalWords) || 0,
    totalFavorites: Number(insightsObject.totalFavorites) || 0,
    dailyJournalCounts: toRecord(insightsObject.dailyJournalCounts),
    tagCounts: toRecord(insightsObject.tagCounts),
    moodCounts: toRecord(insightsObject.moodCounts),
    lastJournalDateKey: insightsObject.lastJournalDateKey ?? null,
    lastCalculatedAt: toIsoOrNull(insightsObject.lastCalculatedAt),
    aiAnalysis: insightsObject.aiAnalysis ?? null,
    aiAnalysisStale: Boolean(insightsObject.aiAnalysisStale),
    aiAnalysisComputedAt: toIsoOrNull(insightsObject.aiAnalysisComputedAt),
    aiAnalysisWindowEndDateKey: insightsObject.aiAnalysisWindowEndDateKey ?? null,
    createdAt: toIso(insightsObject.createdAt),
    updatedAt: toIso(insightsObject.updatedAt),
  };
};

const serializeStreak = (streak: IStreak): PrivacyExportStreak => {
  const streakObject = streak.toObject() as Record<string, any>;

  return {
    streak: Number(streakObject.streak) || 0,
    streakStartDate: toIso(streakObject.streakStartDate),
    streakEndDate: toIsoOrNull(streakObject.streakEndDate),
    createdAt: toIso(streakObject.createdAt),
    updatedAt: toIso(streakObject.updatedAt),
  };
};

const serializeStats = (stats: IStat): PrivacyExportStats => {
  const statsObject = stats.toObject() as Record<string, any>;

  return {
    journalsWritten: Number(statsObject.journalsWritten) || 0,
    totalWordsWritten: Number(statsObject.totalWordsWritten) || 0,
    createdAt: toIso(statsObject.createdAt),
    updatedAt: toIso(statsObject.updatedAt),
  };
};

const serializeReminder = (reminder: IReminder): PrivacyExportReminder => {
  const reminderObject = reminder.toObject() as Record<string, any>;

  return {
    _id: reminderObject._id.toString(),
    type: reminderObject.type,
    enabled: Boolean(reminderObject.enabled),
    time: reminderObject.time,
    timezone: reminderObject.timezone,
    skipIfCompletedToday: Boolean(reminderObject.skipIfCompletedToday),
    includeWeekends: Boolean(reminderObject.includeWeekends),
    streakWarnings: Boolean(reminderObject.streakWarnings),
    createdAt: toIso(reminderObject.createdAt),
    updatedAt: toIso(reminderObject.updatedAt),
  };
};

const exportPrivacyData = async (
  userId: string
): Promise<PrivacyExportPayload | null> => {
  const [user, journalEntries, moodCheckIns, reminders, insights, streak, stats] = await Promise.all([
    userModel.findById(userId).exec(),
    journalModel.find({ userId }).sort({ createdAt: -1 }).exec(),
    moodCheckInModel.find({ userId }).sort({ createdAt: -1 }).exec(),
    reminderModel.find({ userId }).sort({ createdAt: -1 }).exec(),
    insightsModel.findOne({ userId }).exec(),
    streaksModel.findOne({ userId }).exec(),
    statsModel.findOne({ userId }).exec(),
  ]);

  if (!user) {
    return null;
  }

  return {
    exportedAt: new Date().toISOString(),
    account: serializeUser(user),
    journalEntries: journalEntries.map(serializeJournal),
    moodCheckIns: moodCheckIns.map(serializeMood),
    reminders: reminders.map(serializeReminder),
    insights: insights ? serializeInsights(insights) : null,
    streak: streak ? serializeStreak(streak) : null,
    stats: stats ? serializeStats(stats) : null,
  };
};

const deletePrivacyAccount = async (userId: string): Promise<DeleteAccountResult> => {
  await invalidateRefreshToken(userId);

  const [journalsResult, moodResult, remindersResult, insightsResult, streakResult, statsResult, userResult] =
    await Promise.all([
      journalModel.deleteMany({ userId }).exec(),
      moodCheckInModel.deleteMany({ userId }).exec(),
      reminderModel.deleteMany({ userId }).exec(),
      insightsModel.deleteMany({ userId }).exec(),
      streaksModel.deleteMany({ userId }).exec(),
      statsModel.deleteMany({ userId }).exec(),
      userModel.deleteOne({ _id: userId }).exec(),
    ]);

  return {
    deletedAccount: Boolean(userResult.deletedCount),
    deletedJournals: journalsResult.deletedCount || 0,
    deletedMoodCheckIns: moodResult.deletedCount || 0,
    deletedReminders: remindersResult.deletedCount || 0,
    deletedInsights: insightsResult.deletedCount || 0,
    deletedStreaks: streakResult.deletedCount || 0,
    deletedStats: statsResult.deletedCount || 0,
  };
};

const updatePrivacyAiOptOut = async (
  userId: string,
  aiOptOut: boolean
): Promise<UpdateAiOptOutResult | null> => {
  const result = await userModel.updateOne(
    { _id: userId },
    {
      $set: {
        "onboardingContext.aiOptIn": !aiOptOut,
      },
    }
  );

  if (!result.matchedCount) {
    return null;
  }

  return {
    aiOptIn: !aiOptOut,
  };
};

export { deletePrivacyAccount, exportPrivacyData, updatePrivacyAiOptOut };
export type {
  DeleteAccountResult,
  PrivacyExportAccount,
  PrivacyExportInsights,
  PrivacyExportJournalEntry,
  PrivacyExportMoodEntry,
  PrivacyExportPayload,
  PrivacyExportStats,
  PrivacyExportStreak,
  UpdateAiOptOutResult,
};
