import type { Candidates } from "@/lib/conductor/types";

export interface CandidateInput {
  system: string;
  user: string;
}

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
  generateCandidates(input: CandidateInput): Promise<Candidates>;
}

export class AnthropicProvider implements LLMProvider {
  private client: import("@anthropic-ai/sdk").default | null = null;

  private async getClient() {
    if (!this.client) {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      this.client = new Anthropic();
    }
    return this.client;
  }

  async generate(prompt: string): Promise<string> {
    const client = await this.getClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (block.type === "text") {
      return block.text;
    }
    throw new Error("Unexpected response type from Anthropic");
  }

  async generateCandidates(input: CandidateInput): Promise<Candidates> {
    const client = await this.getClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    let raw = block.text.trim();
    // Strip markdown fences if present
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      raw = fenceMatch[1].trim();
    }

    return JSON.parse(raw) as Candidates;
  }
}
