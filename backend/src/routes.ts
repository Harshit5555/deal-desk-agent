import { Router } from "express";
import {
  approvalQueueHandler,
  approveHandler,
  getDealHandler,
  listDealsHandler,
  needsReviewHandler,
  proposeDiscountHandler,
  rejectHandler,
} from "./controllers/dealController";
import { getPolicyHandler, updatePolicyHandler } from "./controllers/policyController";

export const router = Router();

router.get("/deals", listDealsHandler);
// Must be registered before /deals/:id, which would otherwise match "needs-review" as an id.
router.get("/deals/needs-review", needsReviewHandler);
router.get("/deals/:id", getDealHandler);
router.post("/deals/:id/propose-discount", proposeDiscountHandler);
router.post("/deals/:id/approve", approveHandler);
router.post("/deals/:id/reject", rejectHandler);

router.get("/queue", approvalQueueHandler);

router.get("/policy", getPolicyHandler);
router.put("/policy", updatePolicyHandler);
