import type { DashboardError } from "./dashboard";

export type Profile = {
  avatarUrl: string;
  name: string | null;
  login: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string; // ISO UTC
  url: string; // html_url
  fetchedAt: string; // ISO UTC, shown as "Updated 3 min ago"
};

export type ProfileResult =
  | { status: "ok"; profile: Profile }
  | { status: "error"; error: DashboardError };
