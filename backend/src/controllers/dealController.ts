import type { Request, Response } from "express";
import { approve, getDeal, listDeals, proposeDiscount, reject } from "../services/dealService";
import type { DealStatus } from "../types";

export function listDealsHandler(req: Request, res: Response) {
  const status = req.query.status as DealStatus | undefined;
  res.json(listDeals({ status }));
}

export function getDealHandler(req: Request, res: Response) {
  res.json(getDeal(req.params.id));
}

export function proposeDiscountHandler(req: Request, res: Response) {
  res.json(proposeDiscount(req.params.id, req.body?.discountPct));
}

export function approveHandler(req: Request, res: Response) {
  res.json(approve(req.params.id, req.body?.approver, req.body?.comment));
}

export function rejectHandler(req: Request, res: Response) {
  res.json(reject(req.params.id, req.body?.approver, req.body?.comment));
}
