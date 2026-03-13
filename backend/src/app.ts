import express, { Request, Response } from "express";
import { initializeRoutes } from "./routes";
import { init_mongoDB } from "./config/mongo.db.config";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB and start the server
(async () => {
  await init_mongoDB();

  initializeRoutes(app);

  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
})();
