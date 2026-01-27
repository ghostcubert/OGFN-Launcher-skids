export type DefaultsType = {
  LAUNCHER_NAME: string;
  BACKEND_URL: string;
  DISCORD_LINK: string;
  LOGO_URL: string;
  BACKGROUND_URL: string;
  PLACEHOLDER_IMAGE: string;
};

const env = import.meta.env;

export const Defaults: DefaultsType = {
  LAUNCHER_NAME: env.VITE_LAUNCHER_NAME || "Project",
  BACKEND_URL: env.VITE_BACKEND_URL || "http://127.0.0.1:3551",
  DISCORD_LINK: env.VITE_DISCORD_LINK || "https://example.com",
  LOGO_URL: env.VITE_LOGO_URL || "https://i.ibb.co/1GVGmGPh/logo.png",
  BACKGROUND_URL: env.VITE_BACKGROUND_URL || "https://i.ibb.co/hx42Ndqt/fn.jpg",
  PLACEHOLDER_IMAGE: env.VITE_PLACEHOLDER_IMAGE || "https://i.imgur.com/CPdmKDe.jpeg"
};

export const LibraryConfig = {
  KEY: "storage:library",
};