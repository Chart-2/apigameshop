import pool from "../config/db.js";
import sharp from "sharp";
import cloudinary from "../utils/cloudinary.js";

// ===== GET Users =====
export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT user_id, username, email, profile_image, wallet_balance, role FROM User");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== GET User by ID =====
export const getUserById = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM User WHERE user_id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== REGISTER =====
export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !username || !password)
      return res.status(400).json("email, username, and password are required");

    let profileImage = null;
    if (req.file?.buffer) {
      const processed = await sharp(req.file.buffer)
        .resize(512, 512, { fit: "cover" })
        .toFormat("webp", { quality: 90 })
        .toBuffer();

      const uploaded = await cloudinary.uploader.upload_stream(
        { folder: "profile", resource_type: "image", format: "webp" },
        (err, result) => {
          if (err) throw err;
          profileImage = result.secure_url;
        }
      );
    }

    const [result] = await pool.query(
      "INSERT INTO User (username, email, password, profile_image) VALUES (?, ?, ?, ?)",
      [username, email, password, profileImage]
    );

    res.status(201).json({
      message: "User registered successfully",
      user_id: result.insertId,
      profile_image: profileImage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== LOGIN =====
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      "SELECT user_id, username, email, role, wallet_balance, profile_image FROM User WHERE email = ? AND password = ?",
      [email, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid email or password" });
    const user = rows[0];
    res.json({
      id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      wallet: user.wallet_balance,
      hasImage: !!user.profile_image,
      message: "Login successful",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== UPDATE User (ชื่อ + รูป) =====
export const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { username } = req.body;

    const [users] = await pool.query("SELECT * FROM User WHERE user_id = ?", [userId]);
    if (users.length === 0) return res.status(404).json({ error: "User not found" });

    let profileImageUrl = users[0].profile_image;

    if (req.file && req.file.buffer && req.file.size > 0) {
      const processed = await sharp(req.file.buffer)
        .resize(512, 512, { fit: "cover" })
        .toFormat("webp", { quality: 90 })
        .toBuffer();

      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "profile", resource_type: "image", format: "webp" },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(processed);
      });
      profileImageUrl = uploaded.secure_url;
    }

    await pool.query("UPDATE User SET username = ?, profile_image = ? WHERE user_id = ?", [
      username || users[0].username,
      profileImageUrl,
      userId,
    ]);

    res.json({
      message: "✅ User updated successfully",
      user_id: userId,
      username: username || users[0].username,
      profile_image: profileImageUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
