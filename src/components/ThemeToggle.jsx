import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      data-testid="theme-toggle-btn"
      onClick={toggleTheme}
      className="relative p-2 rounded-lg transition-all duration-300
        hover:bg-slate-200 dark:hover:bg-slate-700/60
        text-slate-600 dark:text-slate-300
        hover:text-slate-900 dark:hover:text-white
        focus:outline-none focus-visible:ring-2 focus-visible:ring-git-green"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Moon className="w-5 h-5 transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun className="w-5 h-5 transition-transform duration-300 hover:rotate-45" />
      )}
    </button>
  );
}