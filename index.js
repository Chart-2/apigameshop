// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
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
//---Test----
app.get('/', (req, res) => {
  res.send('✅ API is running...');
});
// ===== GET users ทั้งหมด =====
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, username, email, profile_image, wallet_balance, role FROM User"
    );

    const result = rows.map(user => ({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      hasImage: !!user.profile_image,  // true ถ้ามีรูป
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



// ===== Start Server =====

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
