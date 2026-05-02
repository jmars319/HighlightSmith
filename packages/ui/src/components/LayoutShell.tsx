import type { ReactNode } from "react";

type LayoutShellProps = {
  appName: string;
  brandMark?: ReactNode;
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
  brandMark,
  title,
  subtitle,
  navItems,
  activeId,
  onSelect,
  children,
  aside,
}: LayoutShellProps) {
  return (
    <div className="vcp-layout">
      <aside className="vcp-sidebar">
        <div className="vcp-brand">
          {brandMark ? <div className="vcp-brand-mark">{brandMark}</div> : null}
          <p className="vcp-kicker">{appName}</p>
        </div>
        <h1>{title}</h1>
        <p className="vcp-subtitle">{subtitle}</p>
        <nav className="vcp-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={
                item.id === activeId ? "vcp-nav-item active" : "vcp-nav-item"
              }
              onClick={() => onSelect(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="vcp-content">{children}</section>
      {aside ? <aside className="vcp-aside">{aside}</aside> : null}
    </div>
  );
}
