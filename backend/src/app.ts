import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { router } from "./routes";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", router);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ConflictError) return res.status(409).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
