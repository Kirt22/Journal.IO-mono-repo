import mongoose from "mongoose";

const MONGO_STAGE = process.env.MONGO_STAGE || "local";

let MONGO_URI: string;

if (MONGO_STAGE === "local") {
  MONGO_URI = process.env.MONGO_URI_LOCAL || "mongodb://localhost:27017";
} else if (MONGO_STAGE === "prod") {
  MONGO_URI = process.env.MONGO_URI_PROD || "";
} else if (MONGO_STAGE === "dev") {
  MONGO_URI = process.env.MONGO_URI_DEV || "";
} else {
  throw new Error("Invalid MONGO_STAGE value");
}

if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables");
}

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
    await mongoose.connect(MONGO_URI);
    await removeLegacyUserIndexes();
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

export { mongoose as connectMongoDB };
