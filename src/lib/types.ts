export type ProductStatus = "available" | "sold" | "archived";
export type Category = "Jackets" | "Pants" | "Tops" | "Accessories" | "Custom";
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: Category;
  size: string;
  condition: string;
  material: string;
  color: string;
  status: ProductStatus;
  featured: boolean;
  bestseller: boolean;
  created_at: string;
  updated_at: string;
  images: string[];
  image_alt: string;
  measurements: { label: string; value: string }[];
  care: string;
  drop: string;
}
export type InquiryType = "product" | "custom" | "general";
export type SubmissionResult = { mode: "live" | "preview"; error?: string };
