import { Router } from "express";
import {
  approveHandler,
  getDealHandler,
  listDealsHandler,
  proposeDiscountHandler,
  rejectHandler,
} from "./controllers/dealController";
import { getPolicyHandler, updatePolicyHandler } from "./controllers/policyController";

export const router = Router();

router.get("/deals", listDealsHandler);
router.get("/deals/:id", getDealHandler);
router.post("/deals/:id/propose-discount", proposeDiscountHandler);
router.post("/deals/:id/approve", approveHandler);
router.post("/deals/:id/reject", rejectHandler);

router.get("/policy", getPolicyHandler);
router.put("/policy", updatePolicyHandler);
