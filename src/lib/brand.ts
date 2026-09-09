export const brand = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "ooofftherack@gmail.com",
  socials: [
    {
      name: "Instagram",
      url:
        process.env.NEXT_PUBLIC_INSTAGRAM_URL ||
        "https://www.instagram.com/ooofftherack/",
    },
    {
      name: "Facebook",
      url:
        process.env.NEXT_PUBLIC_FACEBOOK_URL ||
        "https://www.facebook.com/profile.php?id=61591496486738",
    },
    { name: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL || "" },
  ].filter((social) => /^https:\/\//.test(social.url)),
};
