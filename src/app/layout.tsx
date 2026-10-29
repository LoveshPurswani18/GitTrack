import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "GitTrack", template: "%s · GitTrack" },
  description: "Personal dashboard for GitHub commits and pull requests.",
  robots: { index: false, follow: false },
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text-primary">
        <a
          href="#main"
          className="text-label sr-only rounded-sm border border-control-border bg-bg px-3 py-1.5 text-text-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-60"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
