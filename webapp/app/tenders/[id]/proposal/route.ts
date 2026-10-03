import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { getOwnScope } from '@/lib/scopes';

export const dynamic = 'force-dynamic';

/** A scope's proposal brief as a Markdown file download — for the scope's owner only (it maps their team and references). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const scopeId = new URL(req.url).searchParams.get('scope') || '';
  const user = await getCurrentUser();
  if (!/^[0-9a-f]{12,40}$/.test(params.id) || !user || !(await getOwnScope(scopeId, user.id))) return new Response('Not found', { status: 404 });
  const db = getSupabaseServerClient();
  const [{ data: row }, { data: o }] = await Promise.all([
    db.from('scope_evaluations').select('proposal_brief').match({ scope_id: scopeId, opportunity_id: params.id }).maybeSingle(),
    db.from('opportunities').select('title, title_en').eq('opportunity_id', params.id).maybeSingle(),
  ]);
  if (!row?.proposal_brief) return new Response('No proposal brief yet.', { status: 404 });
  const slug = String(o?.title_en || o?.title || 'tender').normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return new Response(row.proposal_brief, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="proposal-brief-${slug || params.id}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
