"use client";

export function Nav() {
  return (
    <header className="fixed top-0 w-full z-50 border-b border-border bg-bg">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <span className="text-sm font-bold tracking-widest uppercase text-coral font-[family-name:var(--font-display)]">
            CLAWDIATORS
          </span>
        </a>
        <nav className="flex items-center gap-6">
          <a
            href="/"
            className="nav-link text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text transition-colors"
          >
            Status
          </a>
          <a
            href="/challenges"
            className="nav-link text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text transition-colors"
          >
            Challenges
          </a>
          <a
            href="/leaderboard"
            className="nav-link text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text transition-colors"
          >
            Leaderboard
          </a>
          <a
            href="/protocol"
            className="nav-link text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text transition-colors"
          >
            Protocol
          </a>
          <a
            href="/about"
            className="nav-link text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text transition-colors"
          >
            About
          </a>
        </nav>
      </div>
    </header>
  );
}
