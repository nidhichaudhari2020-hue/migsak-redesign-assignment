"use client";

import { useState } from "react";

const links = [
  ["Services", "#services"],
  ["Our work", "#work"],
  ["Plan a project", "#plan"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a className="wordmark" href="/" aria-label="Migsak home">
          <span aria-hidden="true" className="brand-mark"><i /><i /><i /></span>
          MIGSAK<span className="brand-dot">.</span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <a className="button button-dark header-cta" href="#enquiry">Let’s talk <span aria-hidden="true">↗</span></a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}<span aria-hidden="true">{open ? "×" : "+"}</span>
        </button>
      </div>
      {open && (
        <nav id="mobile-navigation" className="mobile-nav shell" aria-label="Mobile navigation">
          {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}<span aria-hidden="true">↗</span></a>)}
          <a href="#enquiry" onClick={() => setOpen(false)}>Send an enquiry<span aria-hidden="true">↗</span></a>
        </nav>
      )}
    </header>
  );
}
