"use client";

import { useRef, useState, type FormEvent } from "react";

const services = [
  { value: "website", label: "Company website", hint: "Pages, content and enquiries", focus: "Clarify your message and the essential pages visitors need.", tasks: ["Map the pages and their purpose", "Agree on content and an enquiry journey", "Identify any tools the site should connect to"] },
  { value: "web-app", label: "Web app or portal", hint: "Accounts, dashboards and workflows", focus: "Start with the most useful workflow for one group of users.", tasks: ["Identify users and access requirements", "Outline the main workflow", "Map the data and integrations involved"] },
  { value: "mobile-app", label: "Mobile app", hint: "An experience for iOS and Android", focus: "Define the core experience people need on their phone.", tasks: ["Choose the primary user journey", "Sketch the key screens", "Discuss device features and release requirements"] },
  { value: "automation", label: "Automation", hint: "Reduce repetitive manual tasks", focus: "Choose a repeatable task with a clear start and finish.", tasks: ["Document the current manual steps", "Identify triggers and expected outputs", "Agree on exceptions and human review"] },
  { value: "integration", label: "Connect existing tools", hint: "Payments, messaging or business systems", focus: "Decide which information needs to move between your tools.", tasks: ["List the systems already in use", "Define what data should move and when", "Check access, permissions and error handling"] },
  { value: "unsure", label: "Help me decide", hint: "Start with the business problem", focus: "Describe what is difficult today and what a better outcome looks like.", tasks: ["Talk through the current way of working", "Identify the most useful improvement", "Decide what a manageable first phase includes"] },
] as const;

const integrations = [
  { value: "payments", label: "Payments" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "crm", label: "Customer management" },
  { value: "erp", label: "ERP / business systems" },
  { value: "accounting", label: "Accounting" },
] as const;

const startOptions = [
  { value: "asap", label: "As soon as possible" },
  { value: "month", label: "Within a month" },
  { value: "quarter", label: "In 1–3 months" },
  { value: "exploring", label: "Just exploring" },
] as const;

type Service = (typeof services)[number]["value"];
type Integration = (typeof integrations)[number]["value"];
type Start = (typeof startOptions)[number]["value"];
type Status = "idle" | "pending" | "success" | "error";
type FieldErrors = Record<string, string[]>;

export function ProjectBuilder() {
  const [service, setService] = useState<Service>("unsure");
  const [connections, setConnections] = useState<Integration[]>([]);
  const [start, setStart] = useState<Start>("exploring");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Retries of the same payload reuse an id, including after an ambiguous network failure.
  const submission = useRef<{ id: string; payload: string } | null>(null);
  const plan = services.find((option) => option.value === service)!;
  const chosenStart = startOptions.find((option) => option.value === start)!;
  const connectionLabels = integrations.filter((option) => connections.includes(option.value)).map((option) => option.label);

  function toggleConnection(value: Integration) {
    setConnections((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    if (status === "success") setStatus("idle");
  }

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "pending") return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const values = {
      name: String(fields.get("name") ?? "").trim(),
      email: String(fields.get("email") ?? "").trim(),
      projectDetails: String(fields.get("projectDetails") ?? "").trim(),
      website: String(fields.get("website") ?? ""),
      plannerChoices: { service, integrations: connections, start },
    };
    const errors: FieldErrors = {};
    if (values.name.length < 2 || values.name.length > 100) errors.name = ["Enter a name between 2 and 100 characters."];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 254) errors.email = ["Enter a valid email address."];
    if (values.projectDetails.length < 20 || values.projectDetails.length > 5000) errors.projectDetails = ["Use 20–5,000 characters to describe your project."];
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length > 0) {
      setStatus("error");
      const firstInvalid = form.elements.namedItem(Object.keys(errors)[0]);
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      return;
    }

    const payload = JSON.stringify(values);
    if (!submission.current || submission.current.payload !== payload) {
      submission.current = { id: crypto.randomUUID(), payload };
    }
    setStatus("pending");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, submissionId: submission.current.id }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; fieldErrors?: FieldErrors } | null;
      if (!response.ok || result?.ok !== true) {
        setFieldErrors(result?.fieldErrors ?? {});
        throw new Error(result?.error ?? "We couldn’t save your enquiry. Please try again.");
      }
      setStatus("success");
      submission.current = null;
      form.reset();
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "The connection took too long. Please try again; repeated requests won’t create duplicate enquiries.");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <>
      <section id="plan" className="section shell" aria-labelledby="planner-title">
        <div className="section-heading">
          <div><p className="eyebrow">03 / Plan your first phase</p><h2 id="planner-title">Big idea?<br />Find a starting point.</h2></div>
          <p>Choose a direction and see what to discuss first. Your choices are included when you send the enquiry below.</p>
        </div>
        <div className="planner-layout">
          <div className="planner-controls">
            <fieldset className="planner-step" disabled={status === "pending"}>
              <legend><span>01</span> What do you need?</legend>
              <div className="service-options">
                {services.map((option) => (
                  <label className={`choice-card ${service === option.value ? "is-selected" : ""}`} key={option.value}>
                    <input type="radio" name="service" value={option.value} checked={service === option.value} onChange={() => { setService(option.value); if (status === "success") setStatus("idle"); }} />
                    <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="planner-step" disabled={status === "pending"}>
              <legend><span>02</span> What should it connect to?</legend>
              <p className="field-help">Optional. Leave these blank if you’re unsure.</p>
              <div className="connection-options">
                {integrations.map((option) => (
                  <label className={`chip-choice ${connections.includes(option.value) ? "is-selected" : ""}`} key={option.value}>
                    <input type="checkbox" value={option.value} checked={connections.includes(option.value)} onChange={() => toggleConnection(option.value)} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="planner-step" disabled={status === "pending"}>
              <legend><span>03</span> When would you like to start?</legend>
              <div className="start-options">
                {startOptions.map((option) => (
                  <label className={`start-choice ${start === option.value ? "is-selected" : ""}`} key={option.value}>
                    <input type="radio" name="start" value={option.value} checked={start === option.value} onChange={() => { setStart(option.value); if (status === "success") setStatus("idle"); }} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <aside className="plan-summary" aria-labelledby="plan-summary-title">
            <div className="summary-top"><span className="eyebrow">A conversation starter</span><span aria-hidden="true">↗</span></div>
            <div aria-live="polite" aria-atomic="true">
              <h3 id="plan-summary-title">{plan.label}</h3>
              <p className="summary-intro">{plan.focus}</p>
              <ul className="plan-tasks">{plan.tasks.map((task) => <li key={task}><span aria-hidden="true">✓</span>{task}</li>)}</ul>
              <dl className="plan-details"><div><dt>Connections to discuss</dt><dd>{connectionLabels.length ? connectionLabels.join(", ") : "We’ll work this out together"}</dd></div><div><dt>Your preferred start</dt><dd>{chosenStart.label}</dd></div></dl>
            </div>
            <div className="summary-bottom"><p>This is an indicative discussion guide, not a quote. Timing and pricing are confirmed after scoping.</p><a className="button button-light" href="#enquiry">Continue to enquiry <span aria-hidden="true">↓</span></a><small>Nothing is sent until you submit the form.</small></div>
          </aside>
        </div>
      </section>

      <section id="enquiry" className="enquiry-section" aria-labelledby="enquiry-title">
        <div className="shell enquiry-layout">
          <div className="enquiry-copy"><p className="eyebrow">04 / Start a conversation</p><h2 id="enquiry-title">Let’s make <br />your next <br /><span>move.</span></h2><p>Tell us what you’re trying to build or what you’d like to make easier. A few useful details are a great place to start.</p><a href="mailto:contact@migsak.com" className="enquiry-email">contact@migsak.com <span aria-hidden="true">↗</span></a><div className="enquiry-decoration" aria-hidden="true">↗</div></div>
          <form className="enquiry-form" onSubmit={submitEnquiry} noValidate aria-busy={status === "pending"} onChange={() => { if (status === "success") setStatus("idle"); }}>
            <h3>Your project, in a few words.</h3><p className="form-intro">All three fields are required.</p>
            <div className="form-row">
              <div className="form-field"><label htmlFor="enquiry-name">Your name</label><input className="field" id="enquiry-name" name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="e.g. Alex Patel" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} disabled={status === "pending"} />{fieldErrors.name && <p className="field-error" id="name-error">{fieldErrors.name[0]}</p>}</div>
              <div className="form-field"><label htmlFor="enquiry-email">Email address</label><input className="field" id="enquiry-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} disabled={status === "pending"} />{fieldErrors.email && <p className="field-error" id="email-error">{fieldErrors.email[0]}</p>}</div>
            </div>
            <div className="form-field"><label htmlFor="enquiry-details">What would you like to build or improve?</label><textarea className="field" id="enquiry-details" name="projectDetails" rows={5} required minLength={20} maxLength={5000} placeholder="Tell us a little about your business, the problem and what a useful outcome would look like." aria-invalid={Boolean(fieldErrors.projectDetails)} aria-describedby={`details-help${fieldErrors.projectDetails ? " details-error" : ""}`} disabled={status === "pending"} /><p className="field-help" id="details-help">20–5,000 characters. Please leave out passwords and sensitive account information.</p>{fieldErrors.projectDetails && <p className="field-error" id="details-error">{fieldErrors.projectDetails[0]}</p>}</div>
            <div className="honeypot" aria-hidden="true"><label htmlFor="enquiry-website">Leave this field empty</label><input id="enquiry-website" name="website" type="text" tabIndex={-1} autoComplete="off" /></div>
            <div className="attached-plan"><div><span aria-hidden="true">↳</span><strong>Your planner choices are included</strong><a href="#plan">Edit</a></div><p>{plan.label} <span aria-hidden="true">·</span> {chosenStart.label}</p><p>{connectionLabels.length ? connectionLabels.join(", ") : "No integrations selected"}</p></div>
            {status === "success" && <div className="form-feedback feedback-success" role="status"><strong>Enquiry received.</strong><p>Your project details and planner choices have been saved.</p></div>}
            {status === "error" && error && <div className="form-feedback feedback-error" role="alert">{error}</div>}
            <button className="button button-dark submit-button" type="submit" disabled={status === "pending"}>{status === "pending" ? "Sending your enquiry…" : "Send enquiry"}<span aria-hidden="true">↗</span></button>
            <p className="form-privacy">We’ll use these details to respond to your project enquiry. <a href="https://www.migsak.com/privacy">Privacy policy</a></p>
          </form>
        </div>
      </section>
    </>
  );
}
