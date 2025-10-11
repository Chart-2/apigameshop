import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import { getAllUsers, getUserById, registerUser, loginUser, updateUser,depositMoney,
        getAllCategories,getUserTransactions,getCartItems,removeCartItem ,purchaseGames,
        addToCart
} from "../controllers/userController.js";

const router = express.Router();
router.get("/catagory", getAllCategories);
router.get("/transaction/:id",getUserTransactions);
router.get("/", getAllUsers);
 router.post("/deposit/:id", depositMoney);
router.get("/:id", getUserById);
router.post("/register", upload.single("profile_image"), registerUser);
router.post("/login", loginUser);
router.put("/:id/update", upload.single("profile_image"), updateUser);
router.get("/cartitemall/:id", getCartItems);
router.delete("/cartitem/remove", removeCartItem);
router.post("/cartitem/buy",purchaseGames);
router.post("/cartitem/add",addToCart);
export default router;
