import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AvatarPlaceholder, HeaderAvatar } from "@/components/layout/HeaderAvatar";
import { BackForwardGuard } from "@/components/layout/BackForwardGuard";

/** The signed-in pages: Dashboard, Profile and the error page. The unlock screen has its own layout. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <BackForwardGuard />
      <AppHeader
        avatar={
          <Suspense fallback={<AvatarPlaceholder />}>
            <HeaderAvatar />
          </Suspense>
        }
      />
      {children}
    </>
  );
}
