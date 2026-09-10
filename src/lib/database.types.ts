// Maintained against the existing public schema; see DEVELOPMENT.md.
import type {
  Category,
  ProductRow,
  ProductImage,
  Inquiry,
  NewsletterSubscriber,
} from "./types";
type Table<
  Row,
  Required extends keyof Row,
  Relationships extends {
    foreignKeyName: string;
    columns: string[];
    isOneToOne: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[] = [],
> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};
export type Database = {
  public: {
    Tables: {
      categories: Table<Category, "name" | "slug">;
      products: Table<
        ProductRow,
        "name" | "slug" | "price",
        [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      product_images: Table<
        ProductImage,
        "product_id" | "image_url",
        [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      inquiries: Table<
        Inquiry,
        "customer_name" | "email" | "inquiry_type" | "message",
        [
          {
            foreignKeyName: "inquiries_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      newsletter_subscribers: Table<NewsletterSubscriber, "email">;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
