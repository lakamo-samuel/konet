import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import "./auth.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-layout">
    <section className="auth-brand">
      <Link className="wordmark" href="/">konet<span className="logo-dot" /></Link>
      <div className="auth-brand-copy"><span className="eyebrow">YOUR CAMPUS. YOUR PEOPLE.</span><h1>Your campus has<br /><em>who you need.</em></h1><p>A trusted network built exclusively for university students.</p><div className="auth-brand-note"><Icon name="shield" size={20} /><span>Verified students. Real connections.</span></div></div>
      <span className="auth-brand-footer">Big talent. Right here on campus.</span>
    </section>
    <section className="auth-content"><header className="auth-mobile-header"><Link className="wordmark" href="/">konet<span className="logo-dot" /></Link><Link href="/">Back to home <Icon name="arrow" size={16} /></Link></header>{children}</section>
  </main>;
}
