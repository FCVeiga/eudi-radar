import { siteOrigin } from '@/lib/auth';
import { mcpGuideMarkdown } from '@/lib/mcp/guide';

export const dynamic = 'force-dynamic';

/** Plain markdown so an external agent can fetch the guide from the connect prompt. */
export function GET() {
  return new Response(mcpGuideMarkdown(siteOrigin()), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=300',
    },
  });
}
