// ====================== IMPORTS ======================
import pool from "../config/db.js";
import sharp from "sharp";
import  {
  uploadBufferToCloudinary,
  processImageToWebpSquare,
} from "../utils/cloudinary.js";

// ===== GET Users =====
export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, username, email, profile_image, wallet_balance, role FROM User"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== GET User by ID =====
export const getUserById = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM User WHERE user_id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== REGISTER =====
export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: "email, username, and password are required" });
    }

    let profileImage = null;

    if (req.file?.buffer) {
      // ✅ log ให้เห็นว่า multer ส่งไฟล์มาแล้ว
      console.log("📸 file:", {
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
      });

      // ✅ แปลง/อัปโหลด
      const processed = await processImageToWebpSquare(req.file.buffer);
      const uploaded  = await uploadBufferToCloudinary(processed);
      console.log("✅ Uploaded:", uploaded.secure_url);

      profileImage = uploaded.secure_url;
    } else {
      console.log("⚠️ No req.file — ตรวจชื่อฟิลด์ใน FormData ให้ตรงกับ upload.single('profile_image')");
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
    console.error("❌ Register error:", err);
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
    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });
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

    const [users] = await pool.query("SELECT * FROM User WHERE user_id = ?", [
      userId,
    ]);
    if (users.length === 0)
      return res.status(404).json({ error: "User not found" });

    let profileImageUrl = users[0].profile_image;

    if (req.file && req.file.buffer && req.file.size > 0) {
      const processed = await processImageToWebpSquare(req.file.buffer);
      const uploaded = await uploadBufferToCloudinary(processed);
      profileImageUrl = uploaded.secure_url;
    }

    await pool.query(
      "UPDATE User SET username = ?, profile_image = ? WHERE user_id = ?",
      [username || users[0].username, profileImageUrl, userId]
    );

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

// export const depositMoney = async (req, res) => {
//   const conn = await pool.getConnection();
//   try {
//     const userId = Number(req.params.id);
//     const { amount } = req.body;

//     if (!amount || isNaN(amount) || amount <= 0) {
//       return res.status(400).json({ error: "จำนวนเงินไม่ถูกต้อง" });
//     }

//     await conn.beginTransaction();

//     // ✅ ตรวจสอบว่าผู้ใช้อยู่ในระบบไหม
//     const [userRows] = await conn.query("SELECT * FROM User WHERE user_id = ?", [userId]);
//     if (!userRows.length) throw new Error("User not found");

//     // ✅ 1. เพิ่มรายการธุรกรรมใน Transaction
//     await conn.query(
//       `INSERT INTO \`Transaction\` (user_id, type, note, amount)
//        VALUES (?, 'เติมเงิน', 'Wallet Balance', ?)`,
//       [userId, amount]
//     );

//     // ✅ 2. ถ้ามีคอลัมน์ wallet_balance ในตาราง User → อัปเดตด้วย
//     await conn.query(
//       "UPDATE User SET wallet_balance = wallet_balance + ? WHERE user_id = ?",
//       [amount, userId]
//     );

//     await conn.commit();

//     res.status(201).json({
//       message: "เติมเงินสำเร็จ",
//       user_id: userId,
//       amount: Number(amount),
//     });
//   } catch (err) {
//     await conn.rollback();
//     res.status(500).json({ error: err.message });
//   } finally {
//     conn.release();
//   }
// }