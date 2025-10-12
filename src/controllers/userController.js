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

export const registerUser = async (req, res) => {
  let conn; // ✅ ประกาศข้างนอก
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const { username, email, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: "email, username, and password are required" });
    }

    let profileImage = null;
    if (req.file?.buffer) {
      const processed = await processImageToWebpSquare(req.file.buffer);
      const uploaded = await uploadBufferToCloudinary(processed);
      profileImage = uploaded.secure_url;
    }

    // ✅ 1. สร้าง user
    const [result] = await conn.query(
      "INSERT INTO User (username, email, password, profile_image) VALUES (?, ?, ?, ?)",
      [username, email, password, profileImage]
    );

    const userId = result.insertId;

    // ✅ 2. สร้าง cart ให้ user ทันที
    await conn.query(
      `INSERT INTO Cart (user_id, discount_code_id, status, created_at)
       VALUES (?, NULL, 'ACTIVE', NOW())`,
      [userId]
    );

    await conn.commit();

    res.status(201).json({
      message: "User registered successfully and cart created",
      user_id: userId,
      profile_image: profileImage,
    });
  } catch (err) {
    // ✅ ตรวจให้แน่ใจว่า connection ยังไม่ถูกปิดก่อน rollback
    if (conn && conn.rollback) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.warn("⚠️ Rollback skipped:", rollbackErr.message);
      }
    }
    console.error("❌ Register error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
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

export const depositMoney = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = Number(req.params.id);
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "จำนวนเงินไม่ถูกต้อง" });
    }

    await conn.beginTransaction();

    // ✅ ตรวจสอบว่าผู้ใช้อยู่ในระบบไหม
    const [userRows] = await conn.query("SELECT * FROM User WHERE user_id = ?", [userId]);
    if (!userRows.length) throw new Error("User not found");

    // ✅ 1. เพิ่มรายการธุรกรรมใน Transaction
    await conn.query(
      `INSERT INTO \`WalletTransaction\` (user_id, type, note, amount)
       VALUES (?, 'เติมเงิน', 'Wallet Balance', ?)`,
      [userId, amount]
    );

    // ✅ 2. ถ้ามีคอลัมน์ wallet_balance ในตาราง User → อัปเดตด้วย
    await conn.query(
      "UPDATE User SET wallet_balance = wallet_balance + ? WHERE user_id = ?",
      [amount, userId]
    );

    await conn.commit();

    res.status(201).json({
      message: "เติมเงินสำเร็จ",
      user_id: userId,
      amount: Number(amount),
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}
export const getAllCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT category_id, category_name FROM GameCategory ORDER BY category_id ASC"
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No categories found" });
    }

    res.json(rows);
  } catch (err) {
    console.error("❌ Get categories error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ===== ดูประวัติการทำรายการ (WalletTransaction) =====
export const getUserTransactions = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    // ✅ ตรวจสอบว่าผู้ใช้อยู่ในระบบไหม
    const [user] = await pool.query("SELECT * FROM User WHERE user_id = ?", [userId]);
    if (user.length === 0)
      return res.status(404).json({ error: "User not found" });

    // ✅ ดึงข้อมูลประวัติทั้งหมดจาก WalletTransaction
    const [rows] = await pool.query(
      `SELECT transaction_id, user_id, type, note, amount, \`date\`
       FROM \`WalletTransaction\`
       WHERE user_id = ?
       ORDER BY \`date\` DESC, transaction_id DESC`,
      [userId]
    );

    // ✅ ถ้าไม่มีข้อมูล
    if (rows.length === 0)
      return res.status(404).json({ message: "ไม่พบประวัติธุรกรรมของผู้ใช้" });

    res.json(rows);
  } catch (err) {
    console.error("❌ Get transactions error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { user_id, game_id, quantity = 1 } = req.body;

    if (!user_id || !game_id)
      return res.status(400).json({ error: "ต้องส่ง user_id และ game_id" });

    // ✅ ดึง cart_id ของ user
    const [cartRows] = await pool.query(
      "SELECT cart_id FROM Cart WHERE user_id = ? AND status = 'ACTIVE'",
      [user_id]
    );
    if (!cartRows.length)
      return res.status(404).json({ error: "ไม่พบตะกร้าของผู้ใช้" });

    const cartId = cartRows[0].cart_id;

    // ✅ ตรวจว่าผู้ใช้เคยซื้อเกมนี้หรือยัง (MyGame)
    const [owned] = await pool.query(
      "SELECT * FROM MyGame WHERE user_id = ? AND game_id = ?",
      [user_id, game_id]
    );
    if (owned.length > 0) {
      return res.status(400).json({
        error: "ผู้ใช้เคยซื้อเกมนี้แล้ว ไม่สามารถเพิ่มลงตะกร้าได้อีก",
      });
    }

    // ✅ ตรวจว่าเกมมีอยู่ในตะกร้าอยู่แล้วหรือไม่
    const [exists] = await pool.query(
      "SELECT * FROM CartItem WHERE cart_id = ? AND game_id = ?",
      [cartId, game_id]
    );
    if (exists.length > 0) {
      return res.status(400).json({
        error: "เกมนี้มีอยู่ในตะกร้าแล้ว",
      });
    }

    // ✅ เพิ่มเกมใหม่ลงตะกร้า
    await pool.query(
      "INSERT INTO CartItem (cart_id, game_id, quantity) VALUES (?, ?, ?)",
      [cartId, game_id, quantity]
    );

    res.json({
      message: "✅ เพิ่มเกมลงตะกร้าเรียบร้อย",
      cart_id: cartId,
      game_id,
      quantity,
    });
  } catch (err) {
    console.error("❌ Add to cart error:", err);
    res.status(500).json({ error: err.message });
  }
};




export const purchaseGames = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = Number(req.body.user_id || req.params.id);
    if (!userId) throw new Error("user_id ไม่ถูกต้อง");

    await conn.beginTransaction();

    // ✅ ดึง cart_id ของผู้ใช้
    const [cartRows] = await conn.query(
      "SELECT cart_id FROM Cart WHERE user_id = ? AND status = 'ACTIVE'",
      [userId]
    );
    if (!cartRows.length) throw new Error("Cart not found");
    const cartId = cartRows[0].cart_id;

    // ✅ ดึงรายการเกมใน CartItem
    const [cartItems] = await conn.query(
      `SELECT ci.game_id, ci.quantity, g.name, g.price
         FROM CartItem ci
         JOIN Game g ON ci.game_id = g.game_id
        WHERE ci.cart_id = ?`,
      [cartId]
    );
    if (!cartItems.length) throw new Error("ไม่มีสินค้าในตะกร้า");

    // ✅ ตรวจยอดเงิน
    const [userRows] = await conn.query(
      "SELECT wallet_balance FROM User WHERE user_id = ?",
      [userId]
    );
    if (!userRows.length) throw new Error("User not found");

    let balance = Number(userRows[0].wallet_balance);
    let totalSpent = 0;

    // ✅ รวมชื่อเกมทั้งหมดไว้ก่อน (เช่น "Elden Ring, Minecraft, GTA V")
    const purchasedNames = cartItems.map((i) => i.name).join(", ");

    // ✅ ตรวจและหักเงิน + เพิ่มเกมเข้า MyGame + ลบออกจากตะกร้า
    for (const item of cartItems) {
      const totalPrice = item.price * item.quantity;

      if (balance < totalPrice)
        throw new Error(`ยอดเงินไม่พอสำหรับเกม ${item.name}`);

      balance -= totalPrice;
      totalSpent += totalPrice;

      await conn.query(
        "UPDATE User SET wallet_balance = ? WHERE user_id = ?",
        [balance, userId]
      );

      await conn.query(
        "INSERT INTO MyGame (user_id, game_id) VALUES (?, ?)",
        [userId, item.game_id]
      );

      await conn.query(
        "DELETE FROM CartItem WHERE cart_id = ? AND game_id = ?",
        [cartId, item.game_id]
      );
    }

    // ✅ เพิ่มธุรกรรม WalletTransaction (เพียงครั้งเดียว)
    await conn.query(
      `INSERT INTO WalletTransaction (user_id, type, note, amount)
       VALUES (?, 'ซื้อเกม', ?, ?)`,
      [userId, purchasedNames, totalSpent]
    );

    await conn.commit();

    res.json({
      message: "✅ ซื้อเกมสำเร็จ",
      user_id: userId,
      total_spent: totalSpent,
      remaining_balance: balance,
      purchased_games: cartItems.map((i) => i.name),
    });
  } catch (err) {
    if (conn.rollback) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
};


export const getCartItems = async (req, res) => {
  try {
    // ✅ รองรับทั้ง /users/:id/cart และ /users/cart?user_id=42
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ error: "กรุณาระบุ user_id" });

    // ✅ ดึง cart_id ของ user
    const [cartRows] = await pool.query(
      "SELECT cart_id FROM Cart WHERE user_id = ? AND status = 'ACTIVE'",
      [userId]
    );
    if (!cartRows.length) return res.status(404).json({ error: "ไม่พบตะกร้า" });

    const cartId = cartRows[0].cart_id;

    // ✅ ดึงรายการใน CartItem พร้อมข้อมูลเกม
    const [items] = await pool.query(
      `SELECT 
          ci.cart_item_id,
          ci.game_id,
          g.name AS game_name,
          g.price,
          g.image,
          ci.quantity,
          (g.price * ci.quantity) AS total_price
        FROM CartItem ci
        JOIN Game g ON ci.game_id = g.game_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (!items.length) return res.json({ message: "ไม่มีสินค้าในตะกร้า", items: [] });

    // ✅ คำนวณยอดรวมทั้งหมด
    const total = items.reduce((sum, i) => sum + Number(i.total_price), 0);

    res.json({
      cart_id: cartId,
      user_id: userId,
      total_items: items.length,
      total_price: total,
      items,
    });
  } catch (err) {
    console.error("❌ Get cart error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const { user_id, game_id } = req.body;

    // ✅ ตรวจสอบ input
    if (!user_id || !game_id)
      return res.status(400).json({ error: "กรุณาระบุ user_id และ game_id" });

    // ✅ 1. หาตะกร้า ACTIVE ของผู้ใช้
    const [cartRows] = await pool.query(
      "SELECT cart_id FROM Cart WHERE user_id = ? AND status = 'ACTIVE'",
      [user_id]
    );
    if (!cartRows.length)
      return res.status(404).json({ error: "ไม่พบตะกร้าของผู้ใช้" });

    const cartId = cartRows[0].cart_id;

    // ✅ 2. ตรวจว่ามีสินค้านี้ใน CartItem หรือไม่
    const [items] = await pool.query(
      "SELECT * FROM CartItem WHERE cart_id = ? AND game_id = ?",
      [cartId, game_id]
    );

    if (!items.length)
      return res.status(404).json({ error: "ไม่พบสินค้านี้ในตะกร้า" });

    // ✅ 3. ลบออกจาก CartItem
    await pool.query("DELETE FROM CartItem WHERE cart_id = ? AND game_id = ?", [
      cartId,
      game_id,
    ]);

    res.json({
      message: "🗑 ลบสินค้าออกจากตะกร้าเรียบร้อย",
      cart_id: cartId,
      game_id,
    });
  } catch (err) {
    console.error("❌ Remove cart item error:", err);
    res.status(500).json({ error: err.message });
  }
};
