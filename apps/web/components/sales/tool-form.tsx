"use client";

import { useState } from "react";

interface ToolFormProps {
  endpoint: string;
  onSubmit: (data: Record<string, any>) => void;
  isLoading: boolean;
}

export function ToolForm({ endpoint, onSubmit, isLoading }: ToolFormProps) {
  const [url, setUrl] = useState("");
  const [prospect, setProspect] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [prospectData, setProspectData] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData: Record<string, any> = {};

    if (["quick", "research", "qualify", "contacts", "prep", "competitor"].includes(endpoint)) {
      formData.url = url;
    }

    if (["outreach", "followup", "proposal"].includes(endpoint)) {
      formData.prospect = prospect;
      if (url) formData.url = url;
      if (prospectData) formData.prospectData = JSON.parse(prospectData);
    }

    if (endpoint === "icp") {
      formData.description = description;
    }

    if (endpoint === "objections") {
      formData.topic = topic;
    }

    if (endpoint === "prospect") {
      formData.url = url;
    }

    if (endpoint === "leads") {
      formData.url = url;
      formData.count = count;
    }

    if (endpoint === "report" || endpoint === "report-pdf") {
      // For report endpoints, typically need jobIds from previous runs
      // This is simplified for the UI
      formData.jobIds = [];
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* URL fields */}
      {["quick", "research", "qualify", "contacts", "prep", "prospect", "leads", "competitors"].includes(endpoint) && (
        <>
          <label htmlFor="url" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
            Company URL
          </label>
          <input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box"
            }}
          />
        </>
      )}

      {/* Prospect fields */}
      {["outreach", "followup"].includes(endpoint) && (
        <>
          <label htmlFor="prospect" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
            Prospect Name
          </label>
          <input
            id="prospect"
            type="text"
            placeholder="John Smith"
            value={prospect}
            onChange={(e) => setProspect(e.target.value)}
            required
            minLength={2}
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box"
            }}
          />
          <label htmlFor="url-prospect" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
            Company URL (optional)
          </label>
          <input
            id="url-prospect"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box"
            }}
          />
        </>
      )}

      {/* Client field */}
      {endpoint === "proposal" && (
        <>
          <label htmlFor="client" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
            Client Name
          </label>
          <input
            id="client"
            type="text"
            placeholder="Acme Corp"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            required
            minLength={2}
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box"
            }}
          />
        </>
      )}

      {/* Description field */}
      {endpoint === "icp" && (
        <>
          <label htmlFor="description" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
            ICP Description
          </label>
          <textarea
            id="description"
            placeholder="Describe your ideal customer profile..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            rows={4}
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box",
              fontFamily: "inherit"
            }}
          />
        </>
      )}

      {/* Topic field */}
      {endpoint === "objections" && (
        <>
          <label htmlFor="topic" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
            Objection Topic
          </label>
          <input
            id="topic"
            type="text"
            placeholder="Price objection"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            minLength={2}
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box"
            }}
          />
        </>
      )}

      {/* Count field */}
      {endpoint === "leads" && (
        <>
          <label htmlFor="count" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
            Number of Leads (5-100)
          </label>
          <input
            id="count"
            type="number"
            min={5}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box"
            }}
          />
        </>
      )}

      <button type="submit" disabled={isLoading} className="cta" style={{ width: "100%", opacity: isLoading ? 0.6 : 1 }}>
        {isLoading ? "Running..." : "Run Tool"}
      </button>
    </form>
  );
}
