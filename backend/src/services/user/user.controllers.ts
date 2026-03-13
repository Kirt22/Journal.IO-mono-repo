import { Request, Response } from "express";
import { apiResponse } from "../../helpers/commonHelper.helpers";

const sendOtp = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in send_otp:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const verifyOtp = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const getUserDetailsFromGoogleOAuth = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in getUserDetailsFromGoogleOAuth:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const register = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in register:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const getUserProfile = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const editUserProfile = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in editUserProfile:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

const logout = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.error("Error in logout:", error);
    res.status(500).json(apiResponse(false, "Internal Server Error", {}));
  }
};

export {
  sendOtp,
  verifyOtp,
  getUserDetailsFromGoogleOAuth,
  register,
  getUserProfile,
  editUserProfile,
  logout,
};
