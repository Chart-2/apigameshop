// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer'); // ✅ เพิ่ม multer
require('dotenv').config();

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

// ===== Routes =====
// ===== Multer Config =====
const storage = multer.memoryStorage(); // เก็บไฟล์ใน memory เป็น Buffer
const upload = multer({ storage });

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

    const result = rows.map(user => ({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      password:user.password,
      hasImage: !!user.profile_image, // true ถ้ามีรูป
      wallet: user.wallet_balance,
      role: user.role
    }));

    res.json(result);
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

    const user = rows[0];
    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      hasImage: !!user.profile_image,
      wallet: user.wallet_balance,
      role: user.role
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST register user (พร้อมรูป) =====
app.post('/users/register', upload.single('profile_image'), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const profileImage = req.file ? req.file.buffer : null; // binary จากไฟล์

    const [result] = await pool.query(
      "INSERT INTO User (username, email, password, profile_image) VALUES (?, ?, ?, ?)",
      [username, email, password, profileImage]
    );

    res.json({
      id: result.insertId,
      username,
      email,
      message: "User registered successfully with image"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
