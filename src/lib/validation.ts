import { z } from "zod";
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().default("");
export const inquirySchema = z
  .object({
    customer_name: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z
      .email("Enter a valid email address.")
      .trim()
      .toLowerCase()
      .max(254),
    mobile: optionalText(40),
    type: z.enum(["product", "custom", "general"]),
    product_id: z.uuid().nullable(),
    message: z
      .string()
      .trim()
      .min(10, "Please include at least 10 characters.")
      .max(4000),
    garment_type: optionalText(80),
    preferred_size: optionalText(40),
    design_idea: optionalText(2000),
    reference_url: z
      .union([
        z.literal(""),
        z
          .url()
          .max(1000)
          .refine((v) => /^https?:\/\//i.test(v), "Use an http or https URL."),
      ])
      .optional()
      .default(""),
    consent: z.literal(true, { error: "Please agree to be contacted." }),
    website: optionalText(200),
  })
  .superRefine((value, ctx) => {
    if (value.type === "custom" && value.design_idea.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["design_idea"],
        message: "Tell us a little more about your design.",
      });
    }
  });
export const newsletterSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254),
  website: optionalText(200),
});
