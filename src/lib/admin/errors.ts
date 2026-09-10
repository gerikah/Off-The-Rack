import "server-only";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { logDataError } from "@/lib/data/errors";
import type { ActionState } from "./validation";
export class AdminError extends Error {}
export function databaseError(
  operation: string,
  error: { code?: string },
): never {
  logDataError(operation, error);
  if (error.code === "23505")
    throw new AdminError("This slug or name is already in use.");
  if (error.code === "23503")
    throw new AdminError(
      "This record is in use. Move its related records first, or archive the product.",
    );
  throw new AdminError("Could not save your changes. Please try again.");
}
export function actionError(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof z.ZodError)
    return {
      error: "Check the highlighted fields.",
      fields: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    };
  if (error instanceof AdminError) return { error: error.message };
  logDataError("admin action", {});
  return { error: "Could not complete this action. Please try again." };
}
