import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import {
//   searchGames,
  getAllGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  searchGames,

} from "../controllers/gameController.js";

const router = express.Router();

// /api/games/...
// router.get("/search", searchGames);
router.get("/", getAllGames);
router.get("/search", searchGames);    
router.get("/:id", getGameById);

router.post("/", upload.single("image"), createGame);
router.put("/:id/update", upload.single("image"), updateGame);
router.delete("/:id", deleteGame);
            // ?q=

export default router;