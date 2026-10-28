export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-top">
        <a className="wordmark" href="/" aria-label="Migsak home">MIGSAK<span className="brand-dot">.</span></a>
        <p>Digital products. Connected thinking.</p>
        <a className="text-link" href="mailto:contact@migsak.com">contact@migsak.com <span aria-hidden="true">↗</span></a>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} Migsak · Bengaluru, India</span>
        <div><a href="https://www.migsak.com/privacy">Privacy</a><a href="https://www.migsak.com/terms">Terms</a><a href="/admin">Admin</a></div>
      </div>
    </footer>
  );
}
