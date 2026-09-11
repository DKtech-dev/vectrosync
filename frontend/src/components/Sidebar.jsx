import React from 'react';
import { Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

/**
 * Floating vertical navigation rail with pill-shaped active icon states.
 * Icon-only to keep the analytics canvas wide; each item carries a title +
 * aria-label, and full vertical tablist semantics for keyboard users.
 */
export function Sidebar({ tabs, activeTab, onSelectTab, onTabKeyDown }) {
  return (
    <aside className="hidden lg:flex w-[84px] shrink-0 flex-col items-center border-r border-hairline py-6 gap-6 bg-surface-1">
      {/* Brand mark -- returns to the landing page */}
      <button
        type="button"
        aria-label="Back to landing page"
        title="Back to landing page"
        onClick={() => { window.location.hash = ''; }}
        className="w-11 h-11 rounded-2xl bg-interactive flex items-center justify-center shadow-[0_8px_20px_-6px_rgb(var(--accent-interactive)/0.6)] border-0 cursor-pointer"
      >
        <Zap className="w-5 h-5 text-white" />
      </button>

      {/* Views */}
      <nav className="flex-1">
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Analysis views"
          className="flex flex-col items-center gap-2"
        >
          {tabs.map((tab, tabIndex) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                aria-label={tab.label}
                title={tab.label}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, tabIndex)}
                className="nav-pill"
              >
                <Icon className="w-[18px] h-[18px]" />
              </button>
            );
          })}
        </div>
      </nav>

      <ThemeToggle />
    </aside>
  );
}

export default Sidebar;
