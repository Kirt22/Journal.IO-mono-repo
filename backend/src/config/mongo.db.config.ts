import mongoose from "mongoose";

type MongoStage = "local" | "dev" | "prod";

const VALID_MONGO_STAGES: MongoStage[] = ["local", "dev", "prod"];
const MONGO_CONNECTION_STATE_LABELS: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export const getMongoStage = (
  env: NodeJS.ProcessEnv = process.env
): MongoStage => {
  const rawStage = env.MONGO_STAGE?.trim().toLowerCase() || "local";

  if (!VALID_MONGO_STAGES.includes(rawStage as MongoStage)) {
    throw new Error("Invalid MONGO_STAGE value");
  }

  return rawStage as MongoStage;
};

export const resolveMongoUri = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const directMongoUri = env.MONGO_URI?.trim();

  if (directMongoUri) {
    return directMongoUri;
  }

  const mongoStage = getMongoStage(env);
  const stageSpecificUri =
    mongoStage === "local"
      ? env.MONGO_URI_LOCAL?.trim() || "mongodb://localhost:27017/journal_io"
      : mongoStage === "dev"
        ? env.MONGO_URI_DEV?.trim() || ""
        : env.MONGO_URI_PROD?.trim() || "";

  if (!stageSpecificUri) {
    throw new Error(
      "MongoDB connection string is not configured. Set MONGO_URI or the stage-specific MONGO_URI_* variable."
    );
  }

  return stageSpecificUri;
};

export const getMongoUriForLogging = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const mongoUri = resolveMongoUri(env);

  if (env.LOG_FULL_MONGO_URI?.trim().toLowerCase() === "true") {
    return mongoUri;
  }

  try {
    const parsedMongoUri = new URL(mongoUri);

    if (parsedMongoUri.username || parsedMongoUri.password) {
      parsedMongoUri.username = parsedMongoUri.username ? "***" : "";
      parsedMongoUri.password = parsedMongoUri.password ? "***" : "";
    }

    return parsedMongoUri.toString();
  } catch {
    return mongoUri;
  }
};

export const isMongoReady = (): boolean => mongoose.connection.readyState === 1;

export const getMongoConnectionStateLabel = (): string =>
  MONGO_CONNECTION_STATE_LABELS[mongoose.connection.readyState] || "unknown";

const removeLegacyUserIndexes = async (): Promise<void> => {
  const database = mongoose.connection.db;

  if (!database) {
    return;
  }

  const usersCollectionExists = await database
    .listCollections({ name: "users" }, { nameOnly: true })
    .hasNext();

  if (!usersCollectionExists) {
    return;
  }

  const usersCollection = database.collection("users");
  const indexes = await usersCollection.indexes();
  const legacyIndexNames = indexes
    .filter((index) => Object.prototype.hasOwnProperty.call(index.key, "phone_no"))
    .map((index) => index.name)
    .filter((indexName): indexName is string => Boolean(indexName));

  for (const indexName of legacyIndexNames) {
    await usersCollection.dropIndex(indexName);
    console.log(`Removed legacy MongoDB index from users: ${indexName}`);
  }
};

export const init_mongoDB = async (): Promise<void> => {
  try {
    const mongoUri = resolveMongoUri();
    console.log(`MongoDB connection target: ${getMongoUriForLogging()}`);
    await mongoose.connect(mongoUri);
    await removeLegacyUserIndexes();
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    throw err;
  }
};

export { mongoose as connectMongoDB };
