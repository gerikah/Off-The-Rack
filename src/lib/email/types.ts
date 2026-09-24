export type EmailResult = "accepted" | "unavailable" | "not_configured";
export type SubscriptionStatus =
  "subscribed" | "already_subscribed" | "reactivated";
export type InquiryEmail = {
  email: string;
  customerName: string;
  inquiryType: "product" | "custom" | "general";
  message: string;
  product?: { name: string; price: number; slug: string };
};
