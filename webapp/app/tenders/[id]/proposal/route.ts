import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { getMembership, getWorkspaceContext } from '@/lib/accounts';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** A scope's proposal brief as a Markdown file download — for members of the scope's workspace only (it maps their team and references). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const t = await getT();
  const scopeId = new URL(req.url).searchParams.get('scope') || '';
  const user = await getCurrentUser();
  if (!/^[0-9a-f]{12,40}$/.test(params.id) || !user || !/^[0-9a-f-]{36}$/.test(scopeId)) return new Response(t('Not found'), { status: 404 });
  const db = getSupabaseServerClient();
  const { data: scope } = await db.from('scopes').select('workspace_id').eq('id', scopeId).maybeSingle();
  const mine = !!scope?.workspace_id && !!(await getMembership(scope.workspace_id));
  if (!mine) return new Response(t('Not found'), { status: 404 });
  const ws = await getWorkspaceContext(scope.workspace_id);
  if (!ws?.plan.evaluation) return new Response(t('The Tender Evaluation Agent is only available on Pro and Teams plans.'), { status: 403 });
  const [{ data: row }, { data: o }] = await Promise.all([
    db.from('scope_evaluations').select('proposal_brief').match({ scope_id: scopeId, opportunity_id: params.id }).maybeSingle(),
    db.from('opportunities').select('title, title_en').eq('opportunity_id', params.id).maybeSingle(),
  ]);
  if (!row?.proposal_brief) return new Response(t('No proposal brief yet.'), { status: 404 });
  const slug = String(o?.title_en || o?.title || 'tender').normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return new Response(row.proposal_brief, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="proposal-brief-${slug || params.id}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
