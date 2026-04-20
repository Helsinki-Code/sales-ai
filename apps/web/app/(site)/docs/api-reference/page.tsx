import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Base URL https://api.sales-ai.app/api/v1 with Bearer auth, sync and async endpoint schemas, jobs lifecycle, and webhook payload contracts.",
};

type EndpointSchema = {
  name: string;
  path: string;
  request: string;
  response: string;
  note?: string;
};

const syncEndpoints: EndpointSchema[] = [
  {
    name: "POST /sales/quick",
    path: "Fast sales query. No queue.",
    request: `{
  "query": "string",
  "context": "string",
  "model": "string"
}`,
    response: `{
  "answer": "string",
  "confidence": "high" | "medium" | "low"
}`,
  },
  {
    name: "POST /sales/research",
    path: "Deep prospect and company research.",
    request: `{
  "company": "string",
  "contact": "string",
  "context": "string"
}`,
    response: `{
  "company_summary": "string",
  "recent_news": ["string"],
  "tech_stack_signals": ["string"],
  "pain_point_hypotheses": ["string"],
  "conversation_hooks": ["string"]
}`,
  },
  {
    name: "POST /sales/qualify",
    path: "Lead scoring with reasoning.",
    request: `{
  "lead": "string",
  "icp": "string"
}`,
    response: `{
  "score": 0-100,
  "tier": "A" | "B" | "C" | "D",
  "reasoning": "string",
  "recommended_next_action": "string",
  "disqualifiers": ["string"]
}`,
  },
  {
    name: "POST /sales/outreach",
    path: "Personalized first-touch copy.",
    request: `{
  "prospect": "string",
  "context": "string",
  "channel": "email" | "linkedin" | "sms"
}`,
    response: `{
  "subject": "string",
  "body": "string",
  "follow_up_hook": "string"
}`,
  },
  {
    name: "POST /sales/followup",
    path: "Multi-step follow-up generation.",
    request: `{
  "prospect": "string",
  "original_outreach": "string",
  "steps": 2-5
}`,
    response: `{
  "sequence": [
    {
      "step": 1,
      "delay_days": 3,
      "subject": "string",
      "body": "string"
    }
  ]
}`,
  },
  {
    name: "POST /sales/prep",
    path: "Pre-call briefing and talk track.",
    request: `{
  "company": "string",
  "contact": "string",
  "meeting_type": "discovery" | "demo" | "negotiation" | "renewal",
  "context": "string"
}`,
    response: `{
  "briefing": "string",
  "key_questions": ["string"],
  "talk_track": "string",
  "watch_outs": ["string"]
}`,
  },
  {
    name: "POST /sales/proposal",
    path: "Full proposal generation.",
    request: `{
  "company": "string",
  "problem": "string",
  "solution": "string",
  "pricing": "string",
  "context": "string"
}`,
    response: `{
  "executive_summary": "string",
  "problem_statement": "string",
  "proposed_solution": "string",
  "investment": "string",
  "next_steps": "string"
}`,
  },
  {
    name: "POST /sales/objections",
    path: "Deal-specific objection handling.",
    request: `{
  "objection": "string",
  "context": "string"
}`,
    response: `{
  "reframe": "string",
  "response": "string",
  "proof_points": ["string"],
  "follow_up_question": "string"
}`,
  },
  {
    name: "POST /sales/icp",
    path: "ICP fit analysis.",
    request: `{
  "lead": "string",
  "icp_definition": "string"
}`,
    response: `{
  "fit_score": 0-100,
  "matching_criteria": ["string"],
  "gaps": ["string"],
  "recommendation": "string"
}`,
  },
  {
    name: "POST /sales/competitors",
    path: "Competitive positioning and battlecards.",
    request: `{
  "competitor": "string",
  "context": "string"
}`,
    response: `{
  "competitor_summary": "string",
  "their_strengths": ["string"],
  "their_weaknesses": ["string"],
  "your_differentiators": ["string"],
  "battle_card": "string"
}`,
  },
  {
    name: "POST /sales/contacts",
    path: "Contact enrichment.",
    request: `{
  "contact": "string",
  "company": "string"
}`,
    response: `{
  "profile_summary": "string",
  "role_context": "string",
  "likely_priorities": ["string"],
  "engagement_tips": ["string"]
}`,
  },
  {
    name: "POST /sales/report",
    path: "Sales analysis and reporting.",
    request: `{
  "data": "string | object",
  "period": "string",
  "format": "narrative" | "structured"
}`,
    response: `{
  "summary": "string",
  "highlights": ["string"],
  "concerns": ["string"],
  "recommendations": ["string"]
}`,
  },
  {
    name: "POST /sales/report-pdf",
    path: "PDF report export.",
    request: "Same schema as /sales/report.",
    response: `{
  "pdf_base64": "string",
  "filename": "string"
}`,
  },
];

const asyncEndpoints: EndpointSchema[] = [
  {
    name: "POST /sales/prospect",
    path: "Async prospect discovery.",
    request: `{
  "criteria": "string",
  "limit": 10-100,
  "context": "string"
}`,
    response: `{
  "job_id": "job_01abc...",
  "status": "queued",
  "poll_url": "/api/v1/jobs/job_01abc..."
}`,
  },
  {
    name: "POST /sales/leads",
    path: "Async lead discovery.",
    request: `{
  "criteria": "string",
  "signals": ["string"],
  "limit": 10-100
}`,
    response: "Same immediate envelope as /sales/prospect.",
  },
];

function EndpointSection({ item }: { item: EndpointSchema }) {
  return (
    <article className="card">
      <h3>{item.name}</h3>
      <p className="muted">{item.path}</p>
      <div className="grid grid-2">
        <div>
          <h4>Request</h4>
          <pre className="code-block">{item.request}</pre>
        </div>
        <div>
          <h4>Response data</h4>
          <pre className="code-block">{item.response}</pre>
        </div>
      </div>
      {item.note ? <p className="muted small">{item.note}</p> : null}
    </article>
  );
}

export default function ApiReferencePage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">API Reference</h1>
      <p className="muted">
        Base URL: <code>https://api.sales-ai.app/api/v1</code> | Auth: <code>Authorization: Bearer {'<workspace_key>'}</code> |
        OpenAPI: <code>/api/v1/openapi.json</code>
      </p>

      <section className="card">
        <h2>Authentication</h2>
        <p>All requests require a workspace API key in the Bearer header.</p>
        <pre className="code-block">Authorization: Bearer YOUR_WORKSPACE_KEY</pre>
        <ul>
          <li><code>401</code> Unauthorized: missing or invalid token</li>
          <li><code>403</code> Forbidden: token is valid but lacks scope</li>
          <li><code>429</code> Too Many Requests: check rate limit headers</li>
        </ul>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Response envelope</h2>
        <pre className="code-block">
{`{
  "status": "success" | "error",
  "data": { ... },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 312,
    "duration_ms": 1840,
    "request_id": "req_01abc..."
  },
  "error": null
}`}
        </pre>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2 className="section-title">Synchronous endpoints</h2>
        <p className="muted">Typical response time: 1-8 seconds.</p>
        <div className="grid" style={{ marginTop: "0.8rem" }}>
          {syncEndpoints.map((endpoint) => (
            <EndpointSection key={endpoint.name} item={endpoint} />
          ))}
        </div>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2 className="section-title">Asynchronous endpoints</h2>
        <p className="muted">
          These endpoints queue jobs and return immediately with <code>job_id</code>.
        </p>
        <div className="grid" style={{ marginTop: "0.8rem" }}>
          {asyncEndpoints.map((endpoint) => (
            <EndpointSection key={endpoint.name} item={endpoint} />
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Jobs API</h2>
        <h3>GET /jobs/{'{job_id}'}</h3>
        <pre className="code-block">
{`{
  "job_id": "string",
  "status": "queued" | "running" | "completed" | "failed" | "cancelled",
  "created_at": "ISO8601",
  "completed_at": "ISO8601 | null",
  "result": { ... },
  "error": "string | null"
}`}
        </pre>

        <h3>DELETE /jobs/{'{job_id}'}</h3>
        <pre className="code-block">
{`{
  "job_id": "string",
  "status": "cancelled"
}`}
        </pre>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Webhooks</h2>
        <p>
          Configure webhooks in Settings -&gt; Webhooks to receive completion events instead of polling.
        </p>
        <pre className="code-block">
{`{
  "event": "job.completed" | "job.failed",
  "job_id": "string",
  "result": { ... },
  "timestamp": "ISO8601"
}`}
        </pre>
        <p className="muted small">
          Verify deliveries using the <code>X-Sales-AI-Signature</code> header.
        </p>
      </section>
    </main>
  );
}

