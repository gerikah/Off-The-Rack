export type ProductStatus = "available" | "sold" | "archived";
export type InquiryType = "product" | "custom" | "general";
export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};
export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  price: number;
  category_id: string | null;
  size: string | null;
  condition: string | null;
  material: string | null;
  color: string | null;
  measurements: string | null;
  care_instructions: string | null;
  status: ProductStatus;
  featured: boolean;
  bestseller: boolean;
  created_at: string;
  updated_at: string;
};
export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  storage_path: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};
export type Product = ProductRow & {
  category: Category | null;
  images: ProductImage[];
};
export type Inquiry = {
  id: string;
  customer_name: string;
  email: string;
  mobile: string | null;
  inquiry_type: InquiryType;
  product_id: string | null;
  garment_type: string | null;
  preferred_size: string | null;
  design_idea: string | null;
  reference_url: string | null;
  message: string;
  status: "new" | "read" | "replied" | "resolved";
  created_at: string;
  updated_at: string;
};
export type NewsletterSubscriber = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
};
export type SubmissionResult = {
  mode: "live";
  alreadySubscribed?: boolean;
  error?: string;
};
