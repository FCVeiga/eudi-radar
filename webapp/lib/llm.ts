import OpenAI from 'openai';

/** Quality model for the on-click agents and the Config Agent. */
export const WRITER_MODEL = 'gpt-6-astra';

export function requireOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');
  return new OpenAI({ apiKey });
}

export type Completion = { text: string; model: string; truncated: boolean };

/** One response. `stream` keeps a long generation from sitting on a single non-streaming request. */
export async function complete(opts: {
  system: string;
  user: string;
  maxTokens: number;
  model?: string;
  effort?: 'low' | 'medium' | 'high';
  stream?: boolean;
}): Promise<Completion> {
  const client = requireOpenAI();
  const body = {
    model: opts.model ?? WRITER_MODEL,
    instructions: opts.system,
    input: opts.user,
    max_output_tokens: opts.maxTokens,
    reasoning: { effort: opts.effort ?? 'medium' as const },
  };
  const response = opts.stream
    ? await (await client.responses.stream(body)).finalResponse()
    : await client.responses.create(body);
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type === 'refusal') throw new Error('The model declined this request.');
    }
  }
  return {
    text: response.output_text ?? '',
    model: response.model,
    truncated: response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens',
  };
}
