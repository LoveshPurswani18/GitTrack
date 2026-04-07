import ThemeToggle from "./ThemeToggle";
import { GitBranch } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

export default function Header({ username }) {
  const profileUrl = `https://github.com/${username}`;
  const avatarUrl = `https://github.com/${username}.png`;

  return (
    <header
      data-testid="header"
      className="sticky top-0 z-50 w-full backdrop-blur-xl
      bg-white/70 dark:bg-slate-900/70
      border-b border-slate-200 dark:border-slate-800/80"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
        {/* Logo + Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" stroke="#22C55E" strokeWidth={2.2} />

            <span
              data-testid="logo-text"
              className="font-mono font-bold text-lg tracking-tight
              text-slate-900 dark:text-white"
            >
              GitTrack
            </span>
          </div>

          <span className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">
            Track your GitHub consistency
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1 rounded-lg
                  hover:bg-slate-100 dark:hover:bg-slate-800/60
                  transition-all duration-200 cursor-pointer"
                >
                  <img
                    data-testid="user-avatar"
                    src={avatarUrl}
                    alt={username}
                    className="w-8 h-8 rounded-full object-cover
                    ring-2 ring-slate-200 dark:ring-slate-700"
                  />

                  <span
                    data-testid="username"
                    className="hidden sm:block text-sm font-medium
                    text-slate-700 dark:text-slate-300"
                  >
                    @{username}
                  </span>
                </a>
              </TooltipTrigger>

              <TooltipContent className="bg-slate-900 text-white border-slate-700 text-xs">
                View GitHub profile
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
