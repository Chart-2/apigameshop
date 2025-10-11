import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import { getAllUsers, getUserById, registerUser, loginUser, updateUser,depositMoney } from "../controllers/userController.js";

const router = express.Router();

router.get("/", getAllUsers);
// router.post("/:id/deposit", depositMoney);
router.get("/:id", getUserById);
router.post("/register", upload.single("profile_image"), registerUser);
router.post("/login", loginUser);
router.put("/:id/update", upload.single("profile_image"), updateUser);

export default router;
