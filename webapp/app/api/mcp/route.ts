import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { siteOrigin } from '@/lib/auth';
import { runAs } from '@/lib/actor';
import { createMcpServer } from '@/lib/mcp/server';
import { userForToken } from '@/lib/mcpTokens';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

async function handle(req: Request) {
  const user = await userForToken(req.headers.get('authorization'));
  if (!user) {
    return new Response(JSON.stringify({ error: 'A bearer token for a Tender Town account is required.' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' },
    });
  }
  const server = createMcpServer(siteOrigin());
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return runAs({ user, workspaceId: null }, () => transport.handleRequest(req));
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
