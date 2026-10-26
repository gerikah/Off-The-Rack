export type EmailResult = "accepted" | "unavailable" | "not_configured";
export type InquiryEmail = {
  email: string;
  customerName: string;
  inquiryType: "product" | "custom" | "general";
  message: string;
  product?: { name: string; price: number; slug: string };
};
