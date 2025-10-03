// server.js
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

import multer from "multer";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== เชื่อมต่อฐานข้อมูล =====
const pool = mysql.createPool({
  host: process.env.DB_HOST ,
  user: process.env.DB_USER ,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME ,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


// ---------- Cloudinary Config ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Multer (in-memory, 10MB) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // <= 10MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    if (!ok) return cb(new Error("Only JPEG/PNG/WEBP allowed"));
    cb(null, true);
  },
});

// ---------- Helpers ----------
async function uploadBufferToCloudinary(buffer, folder = "profile") {
  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", format: "webp" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function processImageToWebpSquare(inputBuffer) {
  return await sharp(inputBuffer)
    .resize(512, 512, { fit: "cover" })
    .toFormat("webp", { quality: 90 })
    .toBuffer();
}

// ===== Routes =====
//---Test----
app.get('/', (req, res) => {
  res.send('✅ API is running...');
});

// ===== GET users ทั้งหมด =====
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, username, email, password, profile_image, wallet_balance, role FROM User"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET user ตาม id =====
app.get('/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, username, email, profile_image, wallet_balance, role FROM User WHERE user_id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST register user (พร้อมรูป) =====
app.post('/users/register', upload.single('profile_image'), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json("email, username, and password are required");
    }

    if (req.file && req.file.size > 10 * 1024 * 1024) {
      return res.status(413).json("ไฟล์รูปใหญ่เกิน 10MB");
    }
  let profileimage = null;
    if (req.file?.buffer) {
      const processed = await processImageToWebpSquare(req.file.buffer);
      const uploaded = await uploadBufferToCloudinary(processed, "profile");
      profileimage = uploaded.secure_url;
    }
    const [result] = await pool.query(
      "INSERT INTO User (username, email, password, profile_image) VALUES (?, ?, ?, ?)",
      [username, email, password, profileimage]
    );

    res.status(201).json({
      message: "User registered successfully",
      user_id: result.insertId,
      avatar_url: profileimage,
    });
  } catch (err) {
    if (err && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json("ไฟล์รูปใหญ่เกิน 10MB");
    }
    console.error("Register error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json("Email already exists");
    }
    res.status(500).json(err.message || "Database error");
  }
});


// ===== GET IMAGE (ดึงรูปจาก DB) =====
app.get('/users/:id/profile_image', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT profile_image FROM User WHERE user_id = ?",
      [req.params.id]
    );

    if (rows.length === 0 || !rows[0].profile_image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.setHeader('Content-Type', 'image/png'); // หรือ image/jpeg
    res.send(rows[0].profile_image); // ส่ง binary กลับ
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST Login =====
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      "SELECT user_id, username, email, role, wallet_balance, profile_image FROM User WHERE email = ? AND password = ?",
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = rows[0];
    res.json({
      id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      wallet: user.wallet_balance,
      hasImage: !!user.profile_image,
      message: "Login successful"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ===== Start Server =====

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
