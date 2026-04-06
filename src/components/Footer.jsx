export default function Footer() {
  return (
    <footer
      data-testid="footer"
      className="border-t border-slate-200 dark:border-slate-800/80 mt-12"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          GitTrack &copy; 2024 &middot; Editorial Developer Experience
        </p>
        <div className="flex items-center gap-6">
          {['Privacy', 'Documentation', 'API'].map((link) => (
            <button
              key={link}
              data-testid={`footer-link-${link.toLowerCase()}`}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white
                uppercase tracking-wider transition-colors"
            >
              {link}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}