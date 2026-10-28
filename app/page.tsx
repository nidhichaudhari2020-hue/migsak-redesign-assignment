import { Footer } from "@/components/footer";
import { ProjectBuilder } from "@/components/project-builder";
import { SiteHeader } from "@/components/site-header";

const services = [
  { number: "01", title: "Websites & web apps", body: "Company sites, customer portals and dashboards that bring your business online.", tags: ["Websites", "Portals", "Dashboards"] },
  { number: "02", title: "Mobile apps", body: "Apps for customers and teams, built for both iOS and Android.", tags: ["iOS", "Android", "Cross-platform"] },
  { number: "03", title: "Automation & integrations", body: "Connect payments, messaging and business systems to reduce repetitive work.", tags: ["Payments", "WhatsApp", "Business tools"] },
];

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main">
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> Your next step, built together</p>
            <h1 id="hero-title">Websites. Apps.<br /><span>Less busywork.</span></h1>
            <p className="hero-description">Migsak builds digital products and connects them with the tools your business uses. Start with one feature, then grow from there.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#enquiry">Tell us what you need <span aria-hidden="true">↗</span></a>
              <a className="text-link" href="#plan">Explore your first phase <span aria-hidden="true">↓</span></a>
            </div>
            <p className="hero-footnote">Web · Mobile · Automation <span aria-hidden="true">/</span> Bengaluru, India</p>
          </div>
          <div className="hero-visual" role="img" aria-label="Illustration of a website or app connected to payments, WhatsApp and business tools">
            <div className="visual-caption"><span>THE CONNECTED PICTURE</span><span aria-hidden="true">↗</span></div>
            <div className="connection-map" aria-hidden="true">
              <div className="map-orbit map-orbit-one" /><div className="map-orbit map-orbit-two" />
              <div className="map-center"><span className="map-center-icon">m.</span><strong>Your business</strong><small>Website + app</small></div>
              <div className="map-node map-node-payments"><span className="node-icon">↗</span><span>Payments</span></div>
              <div className="map-node map-node-messaging"><span className="node-icon">↔</span><span>WhatsApp</span></div>
              <div className="map-node map-node-tools"><span className="node-icon">⌘</span><span>Business tools</span></div>
              <span className="map-spark map-spark-one" /><span className="map-spark map-spark-two" />
            </div>
            <div className="visual-footer"><span>Make the pieces work together.</span><span className="illustration-note">Concept illustration</span></div>
          </div>
        </section>

        <div className="project-strip">
          <div className="shell project-strip-inner"><span>Selected projects</span><a href="#recurva">Recurva</a><a href="#prathik">Prathik Softnet</a><a href="#quietpass">QuietPass</a></div>
        </div>

        <section id="services" className="section shell" aria-labelledby="services-title">
          <div className="section-heading">
            <div><p className="eyebrow">01 / What we do</p><h2 id="services-title">A clearer path from<br />idea to useful.</h2></div>
            <p>Choose the starting point that matches your needs. You don’t need a technical brief to begin.</p>
          </div>
          <div className="services-grid">
            {services.map((service) => (
              <article className="service-card" key={service.number}>
                <div className="service-top"><span>{service.number}</span><span aria-hidden="true">↗</span></div>
                <h3>{service.title}</h3><p>{service.body}</p>
                <div className="tag-list">{service.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </article>
            ))}
          </div>
        </section>

        <section id="work" className="section section-work" aria-labelledby="work-title">
          <div className="shell">
            <div className="section-heading"><div><p className="eyebrow">02 / Selected work</p><h2 id="work-title">Real projects.<br />Different challenges.</h2></div><a className="text-link" href="https://www.migsak.com/work">Explore the portfolio <span aria-hidden="true">↗</span></a></div>
            <div className="work-grid">
              <article id="recurva" className="work-card">
                <div className="project-art art-recurva" aria-hidden="true"><span className="project-art-label">APP + PLATFORM</span><span className="recurva-glyph">r<span>↗</span></span><div className="portal-labels"><span>Owner</span><span>Staff</span><span>Member</span></div></div>
                <div className="work-details"><h3>Recurva</h3><p>A retention platform with separate owner, staff and member experiences, plus WhatsApp follow-ups.</p><a className="text-link" href="https://recurva.in/">Visit Recurva <span aria-hidden="true">↗</span></a></div>
              </article>
              <article id="prathik" className="work-card">
                <div className="project-art art-prathik" aria-hidden="true"><span className="project-art-label">COMPANY WEBSITE</span><div className="prathik-word">Prathik<br /><span>Softnet.</span></div><div className="prathik-lines"><i /><i /><i /></div></div>
                <div className="work-details"><h3>Prathik Softnet</h3><p>A company website that explains an IT infrastructure business and creates a route to enquiries.</p><a className="text-link" href="https://www.prathiksoftnet.com/">Visit the website <span aria-hidden="true">↗</span></a></div>
              </article>
              <article id="quietpass" className="work-card">
                <div className="project-art art-quietpass" aria-hidden="true"><span className="project-art-label">MOBILE APP</span><span className="quietpass-glyph">q.</span><span className="in-progress">In progress</span></div>
                <div className="work-details"><h3>QuietPass</h3><p>A household coordination app for presence, room reservations and quiet nudges. In client testing.</p><a className="text-link" href="https://www.migsak.com/work#quietpass">View project details <span aria-hidden="true">↗</span></a></div>
              </article>
            </div>
            <p className="work-caption">Project graphics are editorial illustrations, not product screenshots.</p>
          </div>
        </section>

        <ProjectBuilder />

        <section className="section shell process-section" aria-labelledby="process-title">
          <div className="section-heading"><div><p className="eyebrow">05 / How we work</p><h2 id="process-title">Small phases.<br />A clear direction.</h2></div><p>From understanding the problem to handing over a working product.</p></div>
          <ol className="process-grid">
            <li><span>01</span><h3>Define</h3><p>Agree on scope and a fixed quote.</p></li>
            <li><span>02</span><h3>Build</h3><p>Review the work in short cycles.</p></li>
            <li><span>03</span><h3>Launch</h3><p>Deploy and hand over the product.</p></li>
            <li><span>04</span><h3>Support</h3><p>Choose ongoing support if needed.</p></li>
          </ol>
        </section>
      </main>
      <Footer />
    </>
  );
}
