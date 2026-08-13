import { journalModel, type IJournal } from "../../schema/journal.schema";
import { normalizeJournalEntryKind } from "../../helpers/journalEntryKind.helpers";
import { moodCheckInModel, type IMoodCheckIn } from "../../schema/mood.schema";
import { insightsModel, type IInsights } from "../../schema/insights.schema";
import {
  mindMapEntryScoreModel,
  type IMindMapEntryScore,
} from "../../schema/mindMapEntryScore.schema";
import { entryInsightModel } from "../../schema/entryInsight.schema";
import { userMemoryModel } from "../../schema/userMemory.schema";
import {
  patternNodeModel,
  type IPatternNode,
} from "../../schema/patternNode.schema";
import {
  patternEdgeModel,
  type IPatternEdge,
} from "../../schema/patternEdge.schema";
import {
  jadeSessionModel,
  type IJadeSession,
} from "../../schema/jadeSession.schema";
import {
  jadeMessageModel,
  type IJadeMessage,
} from "../../schema/jadeMessage.schema";
import { reminderModel, type IReminder } from "../../schema/reminder.schema";
import { streaksModel, type IStreak } from "../../schema/streak.schema";
import { statsModel, type IStat } from "../../schema/stat.schema";
import { userModel, type IUser } from "../../schema/user.schema";
import { invalidateRefreshToken } from "../auth/auth.service";
import { revokeAllWidgetSessions } from "../widgets/widgets.service";
import type { MoodValue } from "../../types/mood.types";
import type { GuidedReflectionSessionAnalysisResponse } from "../guided-reflection/guided-reflection.service";

type PrivacyExportOnboardingContext = {
  ageRange: string | null;
  journalingExperience: string | null;
  goals: string[];
  supportFocus: string[];
  reminderPreference: string | null;
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
  entryKind: "journal" | "quick_thought";
  aiPrompt: string | null;
  tags: string[];
  detectedTopics: string[];
  detectedMood: string | null;
  sessionAnalysisSnapshot: {
    analysis: GuidedReflectionSessionAnalysisResponse;
    source: string;
    version: number;
    generatedAt: string;
  } | null;
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
  mindMapLatestWeek: unknown;
  mindMapLatestWeekStale: boolean;
  mindMapLatestWeekComputedAt: string | null;
  mindMapLatestWeekCacheKey: string | null;
  mindMapAllTime: unknown;
  mindMapAllTimeStale: boolean;
  mindMapAllTimeComputedAt: string | null;
  mindMapAllTimeCacheKey: string | null;
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

type PrivacyExportMindMapEntryScore = {
  journalId: string;
  entryType: string;
  regionScores: { id: string; score: number; confidence: number }[];
  dominantRegionId: string;
  source: string;
  scorerVersion: string;
  entryCreatedAt: string;
  computedAt: string;
};

/**
 * The user's pattern graph: the behaviours their entries kept showing and how
 * those behaviours appear to connect. Exported in full, because it is derived
 * conclusions about the person and they are entitled to see them.
 */
type PrivacyExportPatternNode = {
  key: string;
  kind: string;
  label: string;
  rationale: string;
  evidenceQuote: string;
  occurrences: number;
  confidence: number;
  sourceKinds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

type PrivacyExportPatternEdge = {
  fromKey: string;
  toKey: string;
  type: string;
  source: string;
  rationale: string;
  observations: number;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

type PrivacyExportPatternGraph = {
  nodes: PrivacyExportPatternNode[];
  edges: PrivacyExportPatternEdge[];
};

/**
 * Ask Jade conversations, exported in full. These are the user's own words and
 * the replies they were given, so an export that omitted them would be
 * incomplete.
 */
type PrivacyExportJadeMessage = {
  seq: number;
  role: string;
  text: string;
  status: string;
  createdAt: string;
};

type PrivacyExportJadeConversation = {
  title: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  messages: PrivacyExportJadeMessage[];
};

type PrivacyExportPayload = {
  exportedAt: string;
  account: PrivacyExportAccount;
  journalEntries: PrivacyExportJournalEntry[];
  moodCheckIns: PrivacyExportMoodEntry[];
  reminders: PrivacyExportReminder[];
  insights: PrivacyExportInsights | null;
  mindMapEntryScores: PrivacyExportMindMapEntryScore[];
  patternGraph: PrivacyExportPatternGraph;
  jadeConversations: PrivacyExportJadeConversation[];
  streak: PrivacyExportStreak | null;
  stats: PrivacyExportStats | null;
};

type DeleteAccountResult = {
  deletedAccount: boolean;
  deletedJournals: number;
  deletedMoodCheckIns: number;
  deletedReminders: number;
  deletedInsights: number;
  deletedMindMapEntryScores: number;
  deletedEntryInsights: number;
  deletedUserMemories: number;
  deletedPatternNodes: number;
  deletedPatternEdges: number;
  deletedJadeSessions: number;
  deletedJadeMessages: number;
  deletedStreaks: number;
  deletedStats: number;
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
    privacyConsentAccepted:
      typeof onboardingContext.privacyConsentAccepted === "boolean"
        ? onboardingContext.privacyConsentAccepted
        : null,
  };
};

const serializeUser = (user: IUser): PrivacyExportAccount => {
  const userObject = (user as any).toObject({ getters: true }) as Record<
    string,
    any
  >;

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
  const journalObject = (journal as any).toObject({ getters: true }) as Record<
    string,
    any
  >;

  return {
    _id: journalObject._id.toString(),
    title: journalObject.title,
    content: journalObject.content,
    type: journalObject.type,
    entryKind: normalizeJournalEntryKind(
      journalObject.entryKind,
      journalObject.title
    ),
    aiPrompt: typeof journalObject.aiPrompt === "string" ? journalObject.aiPrompt : null,
    tags: Array.isArray(journalObject.tags) ? journalObject.tags : [],
    detectedTopics: Array.isArray(journalObject.detectedTopics)
      ? journalObject.detectedTopics
      : [],
    detectedMood:
      typeof journalObject.detectedMood === "string" ? journalObject.detectedMood : null,
    sessionAnalysisSnapshot: journalObject.sessionAnalysisSnapshot?.analysis
      ? {
          analysis: journalObject.sessionAnalysisSnapshot.analysis,
          source: journalObject.sessionAnalysisSnapshot.source,
          version: journalObject.sessionAnalysisSnapshot.version,
          generatedAt: toIso(journalObject.sessionAnalysisSnapshot.generatedAt),
        }
      : null,
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
  const insightsObject = (insights as any).toObject({ getters: true }) as Record<
    string,
    any
  >;

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
    mindMapLatestWeek: insightsObject.mindMapLatestWeek ?? null,
    mindMapLatestWeekStale: Boolean(insightsObject.mindMapLatestWeekStale),
    mindMapLatestWeekComputedAt: toIsoOrNull(insightsObject.mindMapLatestWeekComputedAt),
    mindMapLatestWeekCacheKey: insightsObject.mindMapLatestWeekCacheKey ?? null,
    mindMapAllTime: insightsObject.mindMapAllTime ?? null,
    mindMapAllTimeStale: Boolean(insightsObject.mindMapAllTimeStale),
    mindMapAllTimeComputedAt: toIsoOrNull(insightsObject.mindMapAllTimeComputedAt),
    mindMapAllTimeCacheKey: insightsObject.mindMapAllTimeCacheKey ?? null,
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

const serializeMindMapEntryScore = (
  score: IMindMapEntryScore
): PrivacyExportMindMapEntryScore => {
  const object = score.toObject();

  return {
    journalId: String(object.journalId),
    entryType: object.entryType,
    regionScores: (object.regionScores || []).map((region: any) => ({
      id: region.id,
      score: region.score,
      confidence: region.confidence,
    })),
    dominantRegionId: object.dominantRegionId,
    source: object.source,
    scorerVersion: object.scorerVersion,
    entryCreatedAt: toIsoOrNull(object.entryCreatedAt) || "",
    computedAt: toIsoOrNull(object.computedAt) || "",
  };
};

const serializePatternNode = (node: IPatternNode): PrivacyExportPatternNode => {
  const object = (node as any).toObject({ getters: true });

  return {
    key: object.key,
    kind: object.kind,
    label: object.label,
    rationale: object.rationale || "",
    evidenceQuote: object.evidenceQuote || "",
    occurrences: object.occurrences || 0,
    confidence: object.confidence || 0,
    sourceKinds: object.sourceKinds || [],
    firstSeenAt: toIsoOrNull(object.firstSeenAt) || "",
    lastSeenAt: toIsoOrNull(object.lastSeenAt) || "",
  };
};

const serializePatternEdge = (edge: IPatternEdge): PrivacyExportPatternEdge => {
  const object = (edge as any).toObject({ getters: true });

  return {
    fromKey: object.fromKey,
    toKey: object.toKey,
    type: object.type,
    source: object.source,
    rationale: object.rationale || "",
    observations: object.observations || 0,
    confidence: object.confidence || 0,
    firstSeenAt: toIsoOrNull(object.firstSeenAt) || "",
    lastSeenAt: toIsoOrNull(object.lastSeenAt) || "",
  };
};

/**
 * Group Jade messages under their conversation so an export reads as the
 * transcripts the user actually had, not a flat message dump.
 */
const buildJadeConversations = (
  sessions: IJadeSession[],
  messages: IJadeMessage[]
): PrivacyExportJadeConversation[] => {
  const bySession = new Map<string, PrivacyExportJadeMessage[]>();

  for (const message of messages) {
    const key = String(message.sessionId);
    const bucket = bySession.get(key) || [];
    bucket.push({
      seq: message.seq,
      role: message.role,
      text: message.text,
      status: message.status,
      createdAt: toIsoOrNull(message.createdAt) || "",
    });
    bySession.set(key, bucket);
  }

  return sessions.map(session => ({
    title: session.title || "",
    messageCount: session.messageCount || 0,
    lastMessageAt: toIsoOrNull(session.lastMessageAt) || "",
    createdAt: toIsoOrNull(session.createdAt) || "",
    messages: (bySession.get(session._id.toString()) || []).sort(
      (left, right) => left.seq - right.seq
    ),
  }));
};

const exportPrivacyData = async (
  userId: string
): Promise<PrivacyExportPayload | null> => {
  const [
    user,
    journalEntries,
    moodCheckIns,
    reminders,
    insights,
    mindMapEntryScores,
    patternNodes,
    patternEdges,
    jadeSessions,
    jadeMessages,
    streak,
    stats,
  ] = await Promise.all([
    userModel.findById(userId).exec(),
    journalModel.find({ userId }).sort({ createdAt: -1 }).exec(),
    moodCheckInModel.find({ userId }).sort({ createdAt: -1 }).exec(),
    reminderModel.find({ userId }).sort({ createdAt: -1 }).exec(),
    insightsModel.findOne({ userId }).exec(),
    mindMapEntryScoreModel.find({ userId }).sort({ entryCreatedAt: -1 }).exec(),
    patternNodeModel.find({ userId }).sort({ strength: -1 }).exec(),
    patternEdgeModel.find({ userId }).sort({ strength: -1 }).exec(),
    jadeSessionModel.find({ userId }).sort({ lastMessageAt: -1 }).exec(),
    jadeMessageModel.find({ userId }).sort({ createdAt: 1 }).exec(),
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
    mindMapEntryScores: mindMapEntryScores.map(serializeMindMapEntryScore),
    patternGraph: {
      nodes: patternNodes.map(serializePatternNode),
      edges: patternEdges.map(serializePatternEdge),
    },
    jadeConversations: buildJadeConversations(jadeSessions, jadeMessages),
    streak: streak ? serializeStreak(streak) : null,
    stats: stats ? serializeStats(stats) : null,
  };
};

const deletePrivacyAccount = async (userId: string): Promise<DeleteAccountResult> => {
  await Promise.all([
    invalidateRefreshToken(userId),
    revokeAllWidgetSessions(userId),
  ]);

  const [
    journalsResult,
    moodResult,
    remindersResult,
    insightsResult,
    mindMapScoresResult,
    entryInsightsResult,
    userMemoryResult,
    patternNodesResult,
    patternEdgesResult,
    jadeSessionsResult,
    jadeMessagesResult,
    streakResult,
    statsResult,
    userResult,
  ] = await Promise.all([
    journalModel.deleteMany({ userId }).exec(),
    moodCheckInModel.deleteMany({ userId }).exec(),
    reminderModel.deleteMany({ userId }).exec(),
    insightsModel.deleteMany({ userId }).exec(),
    mindMapEntryScoreModel.deleteMany({ userId }).exec(),
    entryInsightModel.deleteMany({ userId }).exec(),
    userMemoryModel.deleteMany({ userId }).exec(),
    patternNodeModel.deleteMany({ userId }).exec(),
    patternEdgeModel.deleteMany({ userId }).exec(),
    jadeSessionModel.deleteMany({ userId }).exec(),
    jadeMessageModel.deleteMany({ userId }).exec(),
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
    deletedMindMapEntryScores: mindMapScoresResult.deletedCount || 0,
    deletedEntryInsights: entryInsightsResult.deletedCount || 0,
    deletedUserMemories: userMemoryResult.deletedCount || 0,
    deletedPatternNodes: patternNodesResult.deletedCount || 0,
    deletedPatternEdges: patternEdgesResult.deletedCount || 0,
    deletedJadeSessions: jadeSessionsResult.deletedCount || 0,
    deletedJadeMessages: jadeMessagesResult.deletedCount || 0,
    deletedStreaks: streakResult.deletedCount || 0,
    deletedStats: statsResult.deletedCount || 0,
  };
};

export {
  deletePrivacyAccount,
  exportPrivacyData,
};
export type {
  DeleteAccountResult,
  PrivacyExportAccount,
  PrivacyExportInsights,
  PrivacyExportJournalEntry,
  PrivacyExportMoodEntry,
  PrivacyExportPayload,
  PrivacyExportStats,
  PrivacyExportStreak,
};
