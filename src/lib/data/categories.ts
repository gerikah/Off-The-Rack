import "server-only";
import { cache } from "react";
import { getSupabase } from "../supabase";
import type { Category } from "../types";
import { logDataError } from "./errors";
export const getCategories = cache(async (): Promise<Category[]> => {
  const { data, error } = await getSupabase()
    .from("categories")
    .select("id,name,slug,description,created_at,updated_at")
    .order("name");
  if (error) {
    logDataError("read categories", error);
    throw new Error("The collection is temporarily unavailable.");
  }
  return data ?? [];
});
