import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export interface IAdminConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: "global";
  homeSummerOfferVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const adminConfigSchema = new mongoose.Schema<IAdminConfig>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ["global"],
      default: "global",
    },
    homeSummerOfferVisible: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true }
);

export const adminConfigModel: Model<IAdminConfig> =
  connectMongoDB.model<IAdminConfig>("admin_configs", adminConfigSchema);
