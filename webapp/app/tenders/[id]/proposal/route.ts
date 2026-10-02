import { getSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** The Proposal Manager Agent's brief as a Markdown file download. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f]{12,40}$/.test(params.id)) return new Response('Not found', { status: 404 });
  const { data } = await getSupabaseServerClient().from('opportunities')
    .select('title, title_en, proposal_brief').eq('opportunity_id', params.id).maybeSingle();
  if (!data?.proposal_brief) return new Response('No proposal brief yet.', { status: 404 });
  const slug = String(data.title_en || data.title || 'tender').normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return new Response(data.proposal_brief, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="proposal-brief-${slug || params.id}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
