import mongoose, { Model, Document } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export interface IUser extends Document {
  toObject(): any;
  _id: mongoose.Types.ObjectId;
  name: string;
  phone_no: string;
  email?: string | null;
  user_type: number;
  profile_pic?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true },
    phone_no: { type: String, required: true },
    user_type: { type: Number, default: 1, required: true },
    profile_pic: { type: String, default: null },
    email: { type: String, default: null },
  },
  { timestamps: true }
);

// ✅ Indexes
userSchema.index({ phone_no: 1 }, { unique: true });
userSchema.index({ user_type: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ _id: 1, name: 1, profile_pic: 1 });

export const userModel: Model<IUser> = connectMongoDB.model<IUser>(
  "users",
  userSchema
);
