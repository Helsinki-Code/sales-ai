export const toolDefinitions = [
  {
    name: "web_fetch",
    description: "Fetch page content from a URL and extract readable text",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Fully qualified URL" }
      },
      required: ["url"]
    }
  },
  {
    name: "web_search",
    description: "Search the public web for recent company intelligence",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    }
  }
] as const;

export type ToolName = (typeof toolDefinitions)[number]["name"];