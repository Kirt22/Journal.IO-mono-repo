import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export interface IUser extends Document {
  toObject(): Record<string, unknown>;
  _id: mongoose.Types.ObjectId;
  name: string;
  phoneNumber?: string | null;
  email?: string | null;
  googleUserId?: string | null;
  authProviders: string[];
  journalingGoals: string[];
  avatarColor?: string | null;
  profileSetupCompleted: boolean;
  profilePic?: string | null;
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    googleUserId: { type: String, default: null },
    authProviders: {
      type: [String],
      enum: ["phone", "google"],
      default: [],
      required: true,
    },
    journalingGoals: {
      type: [String],
      default: [],
      required: true,
    },
    avatarColor: { type: String, default: null },
    profileSetupCompleted: { type: Boolean, default: false, required: true },
    profilePic: { type: String, default: null },
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNumber: { $type: "string" } },
  }
);
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);
userSchema.index(
  { googleUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleUserId: { $type: "string" } },
  }
);
userSchema.index({ createdAt: -1 });

export const userModel: Model<IUser> = connectMongoDB.model<IUser>(
  "users",
  userSchema
);
