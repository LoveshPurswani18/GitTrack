import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-[1024px] px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <h1 className="text-title">Profile</h1>
    </main>
  );
}
