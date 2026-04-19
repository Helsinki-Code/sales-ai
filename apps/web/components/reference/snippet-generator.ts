type Language = "curl" | "python" | "typescript" | "javascript" | "go" | "php" | "ruby";

interface EndpointInfo {
  name: string;
  description: string;
  method: string;
  params: { name: string; type: string; required: boolean; description: string }[];
  isAsync: boolean;
}

const ENDPOINT_INFO: Record<string, EndpointInfo> = {
  quick: {
    name: "Quick Scan",
    description: "Fast company overview from URL",
    method: "POST",
    params: [{ name: "url", type: "string", required: true, description: "Company website URL" }],
    isAsync: false,
  },
  research: {
    name: "Company Research",
    description: "Deep research on company background",
    method: "POST",
    params: [{ name: "url", type: "string", required: true, description: "Company website URL" }],
    isAsync: false,
  },
  qualify: {
    name: "Lead Qualification",
    description: "Qualify leads using BANT/MEDDIC",
    method: "POST",
    params: [{ name: "url", type: "string", required: true, description: "Company website URL" }],
    isAsync: false,
  },
  contacts: {
    name: "Find Contacts",
    description: "Discover decision makers",
    method: "POST",
    params: [{ name: "url", type: "string", required: true, description: "Company website URL" }],
    isAsync: false,
  },
  outreach: {
    name: "Generate Outreach",
    description: "Create cold email sequences",
    method: "POST",
    params: [
      { name: "prospect", type: "string", required: true, description: "Prospect name" },
      { name: "url", type: "string", required: false, description: "Company website URL (optional)" },
      { name: "prospectData", type: "object", required: false, description: "Additional prospect data (optional)" },
    ],
    isAsync: false,
  },
  followup: {
    name: "Follow-Up Strategy",
    description: "Plan follow-up sequences",
    method: "POST",
    params: [
      { name: "prospect", type: "string", required: true, description: "Prospect name" },
      { name: "url", type: "string", required: false, description: "Company website URL (optional)" },
      { name: "prospectData", type: "object", required: false, description: "Additional prospect data (optional)" },
    ],
    isAsync: false,
  },
  prep: {
    name: "Meeting Prep",
    description: "Prepare talking points",
    method: "POST",
    params: [{ name: "url", type: "string", required: true, description: "Company website URL" }],
    isAsync: false,
  },
  proposal: {
    name: "Sales Proposal",
    description: "Generate proposal outlines",
    method: "POST",
    params: [{ name: "client", type: "string", required: true, description: "Client name" }],
    isAsync: false,
  },
  objections: {
    name: "Objection Handling",
    description: "Handle common objections",
    method: "POST",
    params: [{ name: "topic", type: "string", required: true, description: "Objection topic (e.g., 'Price')" }],
    isAsync: false,
  },
  icp: {
    name: "ICP Builder",
    description: "Define ideal customer profile",
    method: "POST",
    params: [
      { name: "description", type: "string", required: true, description: "ICP description (min 10 characters)" },
    ],
    isAsync: false,
  },
  competitors: {
    name: "Competitor Analysis",
    description: "Research competitive landscape",
    method: "POST",
    params: [{ name: "url", type: "string", required: true, description: "Company website URL" }],
    isAsync: false,
  },
  prospect: {
    name: "Prospect Deep Dive",
    description: "Comprehensive prospect analysis (async)",
    method: "POST",
    params: [{ name: "url", type: "string", required: true, description: "Company website URL" }],
    isAsync: true,
  },
  leads: {
    name: "Lead Generation",
    description: "Find and qualify multiple leads (async)",
    method: "POST",
    params: [
      { name: "url", type: "string", required: true, description: "Company website URL" },
      { name: "count", type: "number", required: true, description: "Number of leads (5-100)" },
    ],
    isAsync: true,
  },
  report: {
    name: "Generate Report",
    description: "Create analysis reports (async)",
    method: "POST",
    params: [{ name: "jobIds", type: "array", required: true, description: "Array of job UUIDs" }],
    isAsync: true,
  },
  "report-pdf": {
    name: "Report to PDF",
    description: "Export as PDF (async)",
    method: "POST",
    params: [{ name: "jobIds", type: "array", required: false, description: "Array of job UUIDs (optional)" }],
    isAsync: true,
  },
};

function escapeJson(value: any): string {
  return JSON.stringify(value).replace(/"/g, '\\"');
}

export function getEndpointInfo(endpoint: string): EndpointInfo | null {
  return ENDPOINT_INFO[endpoint] || null;
}

export function generateSnippet(
  lang: Language,
  endpoint: string,
  params: Record<string, any>,
  apiKey: string,
  baseUrl: string
): string {
  const safeBaseUrl = baseUrl.replace(/\/+$/, "");
  const url = `${safeBaseUrl}/api/sales/${endpoint}`;
  const jsonBody = JSON.stringify(params);

  switch (lang) {
    case "curl":
      return `curl -X POST '${url}' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '${jsonBody}'`;

    case "python":
      return `import requests

response = requests.post(
    "${url}",
    headers={
        "Authorization": "Bearer ${apiKey}",
        "Content-Type": "application/json",
    },
    json=${JSON.stringify(params, null, 4).split("\n").join("\n    ")},
)
print(response.json())`;

    case "typescript":
      return `const response = await fetch("${url}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${JSON.stringify(params, null, 2).split("\n").join("\n  ")}),
});
const data = await response.json();
console.log(data);`;

    case "javascript":
      return `const response = await fetch("${url}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${JSON.stringify(params, null, 2).split("\n").join("\n  ")}),
});
const data = await response.json();
console.log(data);`;

    case "go":
      return `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    payload := map[string]interface{}{
${Object.entries(params)
  .map(([k, v]) => `        "${k}": ${JSON.stringify(v)},`)
  .join("\n")}
    }
    body, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", "${url}", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer ${apiKey}")
    req.Header.Set("Content-Type", "application/json")
    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println(result)
}`;

    case "php":
      return `<?php
$ch = curl_init('${url}');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ${apiKey}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(${JSON.stringify(params).split("\n").join("\n    ")}),
    CURLOPT_RETURNTRANSFER => true,
]);
$response = json_decode(curl_exec($ch), true);
print_r($response);`;

    case "ruby":
      return `require 'net/http'
require 'json'

uri = URI('${url}')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

request = Net::HTTP::Post.new(uri)
request['Authorization'] = 'Bearer ${apiKey}'
request['Content-Type'] = 'application/json'
request.body = ${JSON.stringify(params)}.to_json

response = http.request(request)
puts JSON.parse(response.body)`;

    default:
      return "";
  }
}

export function generatePollingSnippet(lang: Language, baseUrl: string, apiKey: string, jobId: string): string {
  const safeBaseUrl = baseUrl.replace(/\/+$/, "");
  const url = `${safeBaseUrl}/api/jobs/${jobId}`;

  switch (lang) {
    case "curl":
      return `# Poll every 2-3 seconds until status is 'complete' or 'failed'
curl '${url}' \\
  -H 'Authorization: Bearer ${apiKey}'`;

    case "python":
      return `import time
import requests

while True:
    response = requests.get(
        "${url}",
        headers={"Authorization": "Bearer ${apiKey}"},
    )
    data = response.json()["data"]
    if data["status"] in ["complete", "failed"]:
        print(data)
        break
    print(f"Status: {data['status']}, Progress: {data.get('progress', 0)}%")
    time.sleep(2)`;

    case "typescript":
      return `async function pollJob() {
  while (true) {
    const response = await fetch("${url}", {
      headers: { "Authorization": "Bearer ${apiKey}" },
    });
    const data = await response.json();
    if (data.data.status === "complete" || data.data.status === "failed") {
      console.log(data.data);
      break;
    }
    console.log(\`Status: \${data.data.status}, Progress: \${data.data.progress || 0}%\`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
pollJob();`;

    case "javascript":
      return `async function pollJob() {
  while (true) {
    const response = await fetch("${url}", {
      headers: { "Authorization": "Bearer ${apiKey}" },
    });
    const data = await response.json();
    if (data.data.status === "complete" || data.data.status === "failed") {
      console.log(data.data);
      break;
    }
    console.log(\`Status: \${data.data.status}, Progress: \${data.data.progress || 0}%\`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
pollJob();`;

    case "go":
      return `package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

func pollJob() {
    for {
        req, _ := http.NewRequest("GET", "${url}", nil)
        req.Header.Set("Authorization", "Bearer ${apiKey}")
        resp, _ := http.DefaultClient.Do(req)
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        data := result["data"].(map[string]interface{})
        status := data["status"].(string)
        if status == "complete" || status == "failed" {
            fmt.Println(data)
            break
        }
        fmt.Printf("Status: %s\\n", status)
        time.Sleep(2 * time.Second)
    }
}`;

    case "php":
      return `<?php
while (true) {
    $ch = curl_init('${url}');
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ${apiKey}'],
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $response = json_decode(curl_exec($ch), true);
    $status = $response['data']['status'];
    if (in_array($status, ['complete', 'failed'])) {
        print_r($response['data']);
        break;
    }
    echo "Status: $status\\n";
    sleep(2);
}`;

    case "ruby":
      return `require 'net/http'
require 'json'

uri = URI('${url}')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

loop do
  request = Net::HTTP::Get.new(uri)
  request['Authorization'] = 'Bearer ${apiKey}'
  response = http.request(request)
  data = JSON.parse(response.body)['data']
  if ['complete', 'failed'].include?(data['status'])
    puts JSON.pretty_generate(data)
    break
  end
  puts "Status: #{data['status']}"
  sleep(2)
end`;

    default:
      return "";
  }
}
