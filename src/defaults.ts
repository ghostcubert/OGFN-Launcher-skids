export type DefaultsType = {
  LAUNCHER_NAME: string;
  BACKEND_URL: string;
  DISCORD_LINK: string;
  LOGO_URL: string;
  MAIN_BACKGROUND_URL: string;
  PLACEHOLDER_IMAGE: string;
  LAUNCHER_VERSION: string;
  PAKS_AND_SIGS_LINKS: string;
  ONLY_JOINABLE: boolean;
  JOINABLE_VERSION: string;
  ENABLE_LOGIN_API: boolean;
  ENABLE_LEADERBOARD_API: boolean;
  ENABLE_SHOP_API: boolean;
  LOGIN_BACKGROUND_URL: string;
  ENABLE_SHOP_TAB: boolean;
  ENABLE_LEADERBOARD_TAB: boolean;
};

const env = import.meta.env;

export const Defaults: DefaultsType = {
  LAUNCHER_NAME: env.VITE_LAUNCHER_NAME || "Project",
  BACKEND_URL: env.VITE_BACKEND_URL || "http://127.0.0.1:3551",
  DISCORD_LINK: env.VITE_DISCORD_LINK || "https://example.com",
  LOGO_URL: env.VITE_LOGO_URL || "https://i.ibb.co/1GVGmGPh/logo.png",
  MAIN_BACKGROUND_URL: env.VITE_MAIN_BACKGROUND_URL || "https://i.ibb.co/hx42Ndqt/fn.jpg",
  PLACEHOLDER_IMAGE: env.VITE_PLACEHOLDER_IMAGE || "https://i.imgur.com/CPdmKDe.jpeg",
  LAUNCHER_VERSION: env.VITE_LAUNCHER_VERSION || "1.0.0",
  PAKS_AND_SIGS_LINKS: env.VITE_PAKS_AND_SIGS_LINKS || "",
  ONLY_JOINABLE: env.VITE_ONLY_JOINABLE === "true",
  JOINABLE_VERSION: env.VITE_ONLY_JOINABLE_VERSION || "0.0",
  ENABLE_LOGIN_API: env.VITE_ENABLE_LOGIN_API === "true",
  ENABLE_LEADERBOARD_API: env.VITE_ENABLE_LEADERBOARD_API === "true",
  ENABLE_SHOP_API: env.VITE_ENABLE_SHOP_API === "true",
  LOGIN_BACKGROUND_URL: env.VITE_LOGIN_BACKGROUND_URL || "https://i.ibb.co/hx42Ndqt/fn.jpg",
  ENABLE_SHOP_TAB: env.VITE_ENABLE_SHOP_TAB === "true",
  ENABLE_LEADERBOARD_TAB: env.VITE_LEADERBOARD_TAB === "true",
};

export const LibraryConfig = {
  KEY: "storage:library",
};