import React from 'react';
import { Home } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

/**
 * Vertical navigation rail (desktop). Icon-only to keep the analysis canvas
 * wide; every item carries a title + aria-label and full vertical tablist
 * semantics with roving tabindex.
 *
 * a11y: `aria-controls` is only set on the *selected* tab, because exactly one
 * `panel-${activeTab}` element exists in the document at a time. Pointing the
 * other five tabs at IDs that are not rendered is an invalid reference.
 */
export function Sidebar({ tabs = [], activeTab, onSelectTab, onTabKeyDown }) {
  return (
    <aside className="hidden lg:flex w-[76px] shrink-0 flex-col items-center border-r border-hairline bg-surface-1 py-4 gap-4">
      {/* Brand mark — returns to the landing page */}
      <button
        type="button"
        aria-label="Catenary — back to landing page"
        title="Catenary — back to landing page"
        onClick={() => {
          window.location.hash = '';
        }}
        className="btn-icon w-9 h-9 bg-interactive border-interactive text-canvas hover:bg-interactive-soft hover:border-interactive-soft"
      >
        <Home className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="w-8 border-t border-hairline" aria-hidden="true" />

      {/* Views */}
      <nav className="flex-1 w-full flex justify-center">
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Analysis views"
          className="flex flex-col items-center gap-1.5"
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
                aria-controls={isActive ? `panel-${tab.id}` : undefined}
                aria-label={tab.label}
                title={tab.label}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => onSelectTab?.(tab.id)}
                onKeyDown={(event) => onTabKeyDown?.(event, tabIndex)}
                className="nav-pill"
              >
                {Icon ? <Icon className="w-[18px] h-[18px]" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="w-8 border-t border-hairline" aria-hidden="true" />

      <ThemeToggle />

      {/* Rail footer stamp — reads as an instrument nameplate. */}
      <span className="eyebrow [writing-mode:vertical-rl] rotate-180 tracking-[0.28em] select-none" aria-hidden="true">
        CATENARY
      </span>
    </aside>
  );
}

export default Sidebar;
