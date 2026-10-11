import type { Request, Response } from "express";
import {
  approve,
  getApprovalQueue,
  getDeal,
  listAutoApprovalsNeedingReview,
  listDeals,
  proposeDiscount,
  reject,
} from "../services/dealService";
import type { DealStatus, Region } from "../types";

/** A single non-empty query string value, or undefined. */
const queryValue = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

export function listDealsHandler(req: Request, res: Response) {
  res.json(
    listDeals({
      status: queryValue(req.query.status) as DealStatus | undefined,
      region: queryValue(req.query.region) as Region | undefined,
      team: queryValue(req.query.team),
    }),
  );
}

export function approvalQueueHandler(req: Request, res: Response) {
  res.json(
    getApprovalQueue({
      region: queryValue(req.query.region) as Region | undefined,
      team: queryValue(req.query.team),
    }),
  );
}

export function needsReviewHandler(_req: Request, res: Response) {
  res.json(listAutoApprovalsNeedingReview());
}

export function getDealHandler(req: Request, res: Response) {
  res.json(getDeal(req.params.id));
}

export function proposeDiscountHandler(req: Request, res: Response) {
  res.json(proposeDiscount(req.params.id, req.body?.discountPct));
}

export function approveHandler(req: Request, res: Response) {
  res.json(approve(req.params.id, req.body?.approver, req.body?.approverLevel, req.body?.comment));
}

export function rejectHandler(req: Request, res: Response) {
  res.json(reject(req.params.id, req.body?.approver, req.body?.approverLevel, req.body?.comment));
}
