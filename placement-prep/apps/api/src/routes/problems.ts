import { Hono } from "hono"
import { authMiddleware } from "../middleware/auth.js"
import {
  getProblems,
  getProblemById,
  getProblemCode,
  getProblemExplanation,
  getProblemHints,
  getProblemComplexity,
  getSimilarProblems,
} from "../controllers/problems.controller.js"

export const problemsRouter = new Hono()

// Unprotected routes
problemsRouter.get("/page/:page", getProblems)         // paginated list
problemsRouter.get("/:id", getProblemById)              // single problem detail

// AI-powered routes — all require authenticated user
problemsRouter.post("/:id/code", authMiddleware, getProblemCode)
problemsRouter.post("/:id/explain", authMiddleware, getProblemExplanation)
problemsRouter.post("/:id/hints", authMiddleware, getProblemHints)
problemsRouter.post("/:id/complexity", authMiddleware, getProblemComplexity)
problemsRouter.post("/:id/similar", authMiddleware, getSimilarProblems)