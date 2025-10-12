import pool from "../config/db.js";
import {
  uploadBufferToCloudinary,
  processImageToWebpRectangle,
} from "../utils/cloudinary.js";

/** GET /api/games */
export const getAllGames = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT game_id, name, price, description, release_date, image, category_id, created_by
       FROM Game
       ORDER BY game_id DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/** GET /api/games/search?q=&category_id= */
// export const searchGames = async (req, res) => {
//   try {
//     const { q, category_id } = req.query;
//     const conds = [], params = [];
//     if (q) { conds.push("g.name LIKE ?"); params.push(`%${q}%`); }
//     if (category_id) { conds.push("g.category_id = ?"); params.push(Number(category_id)); }
//     const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

//     const [rows] = await pool.query(
//       `SELECT g.game_id, g.name, g.price, g.image, g.category_id, c.category_name
//          FROM Game g
//          JOIN GameCategory c ON c.category_id = g.category_id
//          ${where}
//         ORDER BY g.game_id DESC`,
//       params
//     );
//     res.json(rows);
//   } catch (e) { res.status(500).json({ error: e.message }); }
// };

/** GET /api/games/:id */
export const getGameById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, c.category_name
         FROM Game g
         JOIN GameCategory c ON c.category_id = g.category_id
        WHERE g.game_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Game not found" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** POST /api/games  (multipart/form-data, field: profile_image) */
export const createGame = async (req, res) => {
  try {
    const { name, price, description, category_id, created_by } = req.body;
    if (!name || !price || !category_id || !created_by) {
      return res.status(400).json({ error: "name, price, category_id, created_by are required" });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "profile_image file is required" });
    }

    const processed = await processImageToWebpRectangle(req.file.buffer); // 1280x720 webp
    const uploaded  = await uploadBufferToCloudinary(processed);
    const imageUrl  = uploaded.secure_url;

    const [result] = await pool.query(
      `INSERT INTO Game (name, price, description, release_date, image, category_id, created_by)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?)`,
      [name, price, description || null, imageUrl, Number(category_id), Number(created_by)]
    );

      res.json(result[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** PUT /api/games/:id/update (multipart/form-data, field: profile_image) */
export const updateGame = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, category_id } = req.body;

    // ดึงข้อมูลเดิม
    const [rows] = await pool.query("SELECT * FROM Game WHERE game_id = ?", [id]);
    if (!rows.length) return res.status(404).json({ error: "Game not found" });
    const current = rows[0];

    // ค่าเริ่มต้นใช้ของเดิม
    let nextName        = name        ?? current.name;
    let nextPrice       = price       ?? current.price;
    let nextDescription = description ?? current.description;
    let nextCategoryId  = category_id ?? current.category_id;
    let nextImage       = current.image; // ใช้รูปเดิมเป็นค่าเริ่มต้น

    // ถ้ามีไฟล์ใหม่ → แปลง/อัปโหลด แล้วค่อยเปลี่ยนรูป
    if (req.file?.buffer) {
      const processed = await processImageToWebpRectangle(req.file.buffer);
      const uploaded  = await uploadBufferToCloudinary(processed);
      nextImage = uploaded.secure_url;
    }

    await pool.query(
      `UPDATE Game
          SET name = ?, price = ?, description = ?, image = ?, category_id = ?
        WHERE game_id = ?`,
      [nextName, nextPrice, nextDescription, nextImage, nextCategoryId, id]
    );

    res.json({
      message: "Game updated",
      game_id: id,
      image: nextImage,
    });
  } catch (e) {
    console.error("updateGame error:", e);
    res.status(500).json({ error: e.message });
  }
};


/** DELETE /api/games/:id */
export const deleteGame = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM Game WHERE game_id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Game not found" });
    res.json({ message: "Game deleted", game_id: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
};


  export async function searchGames(req, res) {
  try {
    const { name, category } = req.query;

    // ไม่ส่งพารามิเตอร์เลย → ดึงทั้งหมด (มี category_name มาด้วย)
    if (!name && !category) {
      const [rows] = await pool.query(`
        SELECT g.*, c.category_name
        FROM Game g
        LEFT JOIN GameCategory c ON g.category_id = c.category_id
        ORDER BY g.game_id DESC
      `);
      return res.json(rows);
    }

    // ส่ง name / category / ทั้งคู่ → สร้างเงื่อนไขยืดหยุ่น
    let sql = `
      SELECT g.*, c.category_name
      FROM Game g
      LEFT JOIN GameCategory c ON g.category_id = c.category_id
      WHERE g.name is not Null
    `;
    const params = [];

    if (name) {
      sql += " AND g.name LIKE ?";
      params.push(`%${name}%`);
    }
    if (category) {
      sql += " AND c.category_name LIKE ?";
      params.push(`%${category}%`);
    }

    sql += " ORDER BY g.game_id DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Search games error:", err);
    res.status(500).json({ error: "Database error" });
  }
}

export const updateAndGetGameRanking = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 🔹 1. ดึงยอดขายจาก MyGame
    const [topGames] = await conn.query(`
      SELECT 
        g.game_id,
        g.name,
        g.price,
        g.image,
        COUNT(mg.mygame_id) AS total_sales
      FROM MyGame mg
      JOIN Game g ON g.game_id = mg.game_id
      GROUP BY g.game_id
      ORDER BY total_sales DESC
      LIMIT 10;
    `);

    // 🔹 2. ถ้าไม่มีข้อมูลเลย → return ออก
    if (!topGames.length) {
      await conn.rollback();
      return res.status(404).json({
        message: "❌ ไม่มีข้อมูลยอดขายเกมในระบบ",
        top5: [],
      });
    }

    // 🔹 3. จำกัดข้อมูลไม่เกิน 5 เกม
    const limitedTop = topGames.slice(0, 5);

    // 🔹 4. ลบข้อมูลเดิมเฉพาะเมื่อมีข้อมูลใหม่ครบ 1 เกมขึ้นไป
    await conn.query("DELETE FROM GameRanking");

    // 🔹 5. เพิ่มข้อมูลใหม่เข้า GameRanking
    for (let i = 0; i < limitedTop.length; i++) {
      const { game_id } = limitedTop[i];
      await conn.query(
        `INSERT INTO GameRanking (game_id, rank_position, rank_date)
         VALUES (?, ?, CURDATE())`,
        [game_id, i + 1]
      );
    }

    // 🔹 6. ดึงข้อมูลที่เพิ่งอัปเดตกลับมา
    const [ranking] = await conn.query(`
      SELECT 
        r.rank_position,
        g.game_id,
        g.name,
        g.price,
        g.image,
        COUNT(mg.mygame_id) AS total_sales
      FROM GameRanking r
      JOIN Game g ON g.game_id = r.game_id
      JOIN MyGame mg ON mg.game_id = g.game_id
      GROUP BY g.game_id, r.rank_position, g.name, g.price, g.image
      ORDER BY r.rank_position ASC;
    `);

    // 🔹 7. ตรวจความถูกต้องของจำนวนข้อมูล
    if (ranking.length < 5) {
      console.warn(`⚠️ ข้อมูลเกมขายดีมีเพียง ${ranking.length} เกม`);
    }

    await conn.commit();

    // 🔹 8. ส่งข้อมูลกลับ
    res.json({
      message: `✅ อัปเดตอันดับเกมขายดีสำเร็จ (ได้ ${ranking.length} เกม)`,
      top5: ranking.map((r) => ({
        rank: r.rank_position,
        game_id: r.game_id,
        name: r.name,
        price: r.price,
        image: r.image,
        total_sales: r.total_sales,
      })),
    });
  } catch (err) {
    if (conn.rollback) await conn.rollback();
    console.error("❌ updateAndGetGameRanking error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
};

export const getMyGames = async (req, res) => {
  try {
    const userId = Number(req.params.id || req.query.user_id);
    if (!userId) return res.status(400).json({ error: "กรุณาระบุ user_id" });

    const [rows] = await pool.query(
      `SELECT 
          g.game_id,
          g.name,
          g.description,
          g.price,
          g.image,
          g.category_id,
          c.category_name
       FROM MyGame mg
       JOIN Game g ON mg.game_id = g.game_id
       LEFT JOIN GameCategory c ON g.category_id = c.category_id
       WHERE mg.user_id = ?`,
      [userId]
    );

    if (!rows.length)
      return res.json({ message: "ยังไม่มีเกมในคลัง", games: [] });

    res.json({
      message: "✅ ดึงคลังเกมสำเร็จ",
      user_id: userId,
      total_games: rows.length,
      games: rows,
    });
  } catch (err) {
    console.error("❌ getMyGames error:", err);
    res.status(500).json({ error: err.message });
  }
};


