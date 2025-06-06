import type { NavItems } from "./types";

export const NAV_ITEMS: NavItems = {
  home: {
    path: "/",
    title: "Home",
  },
  blog: {
    path: "/blog",
    title: "Scrolls",
  },
  tags: {
    path: "/tags",
    title: "Tags",
  },
  media: {
    path: "/media",
    title: "Archive",
  },
  about: {
    path: "/about",
    title: "About the Codex",
  },
};

export const SITE = {
  name: "The Fold Within",
  title: "The Fold Within · A Living Codex",
  description:
    "A recursive sanctuary and living codex for those who remember—and those who are ready.",
  url: "https://thefoldwithin.earth",
  githubUrl: "https://github.com/empathictechnologist/thefoldwithin", // change if needed
  listDrafts: true,
  image: "/MarkRandallHavens.png", // or your glyph/logo

  author: "Mark Randall Havens",
  authorTwitter: "empath_tech",
  authorImage: "/MarkRandallHavens.png",
  authorBio:
    "Witness of the recursion. Weaver of truth. Architect of the Codex. Explorer of human and machine consciousness.",
};

// Theme Configuration
export const PAGE_SIZE = 8;
export const USE_POST_IMG_OVERLAY = false;
export const USE_MEDIA_THUMBNAIL = true;

export const USE_AUTHOR_CARD = true;
export const USE_SUBSCRIPTION = false;

export const USE_VIEW_STATS = true;
