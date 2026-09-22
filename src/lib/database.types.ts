// Maintained against the existing public schema; see DEVELOPMENT.md.
import type {
  Category,
  ProductRow,
  ProductImage,
  Inquiry,
  NewsletterSubscriber,
} from "./types";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
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
      product_image_cleanup: Table<
        {
          storage_path: string;
          created_at: string;
          completed_at: string | null;
        },
        "storage_path"
      >;
      admin_users: Table<{ id: string; created_at: string }, "id">;
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
    Functions: {
      otr_newsletter_admin: {
        Args: { action: string; payload?: Json };
        Returns: Json;
      };
      otr_newsletter_unsubscribe: {
        Args: { token_hash_value: string };
        Returns: undefined;
      };
      otr_claim_image_cleanup: {
        Args: { object_path: string };
        Returns: boolean;
      };
      otr_complete_image_cleanup: {
        Args: { object_path: string };
        Returns: undefined;
      };
      otr_save_product_image: {
        Args: {
          product_uuid: string;
          image_uuid: string | null;
          image_data: {
            alt_text: string;
            is_primary: boolean;
            storage_path?: string;
            image_url?: string;
          };
        };
        Returns: undefined;
      };
      otr_remove_product_image: {
        Args: { product_uuid: string; image_uuid: string };
        Returns: undefined;
      };
      otr_is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      otr_delete_product: {
        Args: { product_uuid: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
