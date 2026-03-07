export interface LLMProvider {
  generate(prompt: string): Promise<string>;
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
}
