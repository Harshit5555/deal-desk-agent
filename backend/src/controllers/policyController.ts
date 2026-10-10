import type { Request, Response } from "express";
import { getPolicy, updatePolicy } from "../services/policyService";

export function getPolicyHandler(_req: Request, res: Response) {
  res.json(getPolicy());
}

export function updatePolicyHandler(req: Request, res: Response) {
  res.json(updatePolicy(req.body ?? {}));
}
