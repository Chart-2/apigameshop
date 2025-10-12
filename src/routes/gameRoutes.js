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
updateAndGetGameRanking,
getMyGames,getGameRankingDetail
} from "../controllers/gameController.js";

const router = express.Router();

// /api/games/...
// router.get("/search", searchGames);

router.get("/search", searchGames);    
router.get("/ranking", updateAndGetGameRanking);

router.get("/detailranking/:gameid", getGameRankingDetail);
router.get("/library/:id", getMyGames);

router.get("/", getAllGames);
router.get("/:id", getGameById);

router.post("/", upload.single("image"), createGame);
router.put("/:id/update", upload.single("image"), updateGame);
router.delete("/:id", deleteGame);


export default router;