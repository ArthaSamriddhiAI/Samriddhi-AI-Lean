import Link from "next/link";
import s from "./explorer.module.css";

/* The two explorer surfaces (Package 10): model portfolio and data universe. */
export function ExplorerTabs({ active }: { active: "model" | "universe" }) {
  return (
    <nav className={s.tabs} aria-label="Explorer surfaces">
      <Link href="/explorer" className={active === "model" ? s.tabActive : s.tab}>
        Model portfolio
      </Link>
      <Link href="/explorer/universe" className={active === "universe" ? s.tabActive : s.tab}>
        Data universe
      </Link>
    </nav>
  );
}
