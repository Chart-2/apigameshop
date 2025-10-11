import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./src/routes/userRoutes.js";
import gameRoutes from "./src/routes/gameRoutes.js";

dotenv.config();

const app = express();

// 🔧 Middleware พื้นฐาน
app.use(cors());
app.use(express.json());

// --- Test route ---
app.get("/", (req, res) => res.send("✅ API is running..."));

// --- Register routes ---
app.use("/users", userRoutes);
app.use("/games", gameRoutes);

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at: http://localhost:${PORT}`));
