export const brand = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  socials: [
    { name: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "" },
    { name: "Facebook", url: process.env.NEXT_PUBLIC_FACEBOOK_URL || "" },
    { name: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL || "" },
  ].filter((social) => /^https:\/\//.test(social.url)),
};
