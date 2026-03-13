import type { ReactNode } from "react";

type LayoutShellProps = {
  appName: string;
  title: string;
  subtitle: string;
  navItems: Array<{ id: string; label: string }>;
  activeId: string;
  onSelect: (id: string) => void;
  children: ReactNode;
  aside?: ReactNode;
};

export function LayoutShell({
  appName,
  title,
  subtitle,
  navItems,
  activeId,
  onSelect,
  children,
  aside,
}: LayoutShellProps) {
  return (
    <div className="hs-layout">
      <aside className="hs-sidebar">
        <p className="hs-kicker">{appName}</p>
        <h1>{title}</h1>
        <p className="hs-subtitle">{subtitle}</p>
        <nav className="hs-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={
                item.id === activeId ? "hs-nav-item active" : "hs-nav-item"
              }
              onClick={() => onSelect(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="hs-content">{children}</section>
      {aside ? <aside className="hs-aside">{aside}</aside> : null}
    </div>
  );
}
