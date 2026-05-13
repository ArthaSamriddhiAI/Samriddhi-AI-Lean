"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark, Settings as SettingsIcon } from "./Icons";
import { Avatar } from "./Avatar";

/* Top bar nav: Brand · Cases · Investors · Explorer · Settings · Avatar.
 * Matches the wireframe chrome (52px tall, hairline bottom, paper ground). */

type TabKey = "cases" | "investors" | "explorer" | "settings";

const TABS: Array<{ key: TabKey; label: string; href: string }> = [
  { key: "cases", label: "Cases", href: "/cases" },
  { key: "investors", label: "Investors", href: "/investors" },
  { key: "explorer", label: "Explorer", href: "/explorer" },
];

function activeTabFor(pathname: string): TabKey | null {
  if (pathname === "/" || pathname.startsWith("/cases")) return "cases";
  if (pathname.startsWith("/investors")) return "investors";
  if (pathname.startsWith("/explorer")) return "explorer";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

export function TopBar() {
  const pathname = usePathname();
  const active = activeTabFor(pathname);

  return (
    <header className="h-[52px] border-b border-rule flex items-center px-7 gap-8 bg-paper shrink-0">
      <Link href="/cases" className="flex items-center gap-2.5 no-underline" aria-label="Samriddhi home">
        <BrandMark />
        <span className="font-serif text-[17px] font-medium text-ink-1" style={{ letterSpacing: "-0.01em" }}>
          Samriddhi
        </span>
      </Link>

      <nav className="flex items-center gap-0.5 flex-1">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`text-small px-3 py-1.5 rounded-1 transition-colors no-underline ${
                isActive
                  ? "text-ink-1 font-medium bg-paper-sunken"
                  : "text-ink-3 font-normal hover:text-ink-1 hover:bg-paper-hover"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3.5 ml-auto">
        <Link
          href="/settings"
          aria-label="Settings"
          className={`w-[30px] h-[30px] inline-flex items-center justify-center rounded-1 transition-colors no-underline ${
            active === "settings"
              ? "text-ink-1 bg-paper-sunken"
              : "text-ink-3 hover:text-ink-1 hover:bg-paper-hover"
          }`}
        >
          <SettingsIcon size={15} />
        </Link>
        <Avatar name="Priya Nair" size={28} />
      </div>
    </header>
  );
}
