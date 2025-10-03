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
// --- User ---
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT user_id, username, email, profile_image,wallet_balance,role  FROM User");

    const result = rows.map(user => ({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      hasImage: !!user.profile_image,   // true ถ้ามีรูป
      wallet:user.wallet_balance,
      role :user.role
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('register/user', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const [result] = await pool.query(
      "INSERT INTO User (username, email, password) VALUES (?, ?, ?)",
      [username, email, password]
    );
    res.json({ id: result.insertId, username, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GameCategory ---
app.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM GameCategory");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// --- Game ---
app.get('/games', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM Game");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('add/game', async (req, res) => {
  try {
    const { name, price, category_id } = req.body;
    const [result] = await pool.query(
      "INSERT INTO Game (name, price, category_id) VALUES (?, ?, ?)",
      [name, price, category_id]
    );
    res.json({ id: result.insertId, name, price, category_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Start Server =====

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
