import { z } from "zod";
export type ActionState = {
  error?: string;
  fields?: Record<string, string>;
  message?: string;
  success?: boolean;
};
export const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const slug = z
  .string()
  .trim()
  .min(1, "Enter a slug.")
  .max(160)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens.",
  );
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .default("")
    .transform((value) => value || null);
export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(160),
  slug,
  category_id: z.uuid("Choose a category."),
  price: z
    .string()
    .trim()
    .min(1, "Enter a price.")
    .regex(
      /^\d+(?:\.\d{1,2})?$/,
      "Enter a price of zero or more, with up to two decimal places.",
    )
    .transform(Number)
    .refine(Number.isFinite, "Enter a valid price."),
  short_description: text(500),
  description: text(10000),
  size: text(80),
  condition: text(160),
  material: text(160),
  color: text(160),
  measurements: text(4000),
  care_instructions: text(4000),
  status: z.enum(["available", "sold", "archived"]),
  featured: z.boolean().default(false),
  bestseller: z.boolean().default(false),
});
export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(120),
  slug,
  description: text(2000),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  password: z.string().min(1, "Enter your password.").max(256),
});
export const idSchema = z.uuid("Invalid record.");
export const productStatusSchema = z.enum(["available", "sold", "archived"]);
export const inquiryStatusSchema = z.enum([
  "new",
  "read",
  "replied",
  "resolved",
]);
export const productTransitions = {
  available: ["sold", "archived"],
  sold: ["available", "archived"],
  archived: ["available"],
} as const;
