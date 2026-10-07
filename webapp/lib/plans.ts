/**
 * Account plans. Keep RUNS_PER_DAY in sync with services/agent_settings.py.
 * `null` = unlimited.
 */
export type PlanKey = 'free' | 'starter' | 'pro' | 'teams';

export type Plan = {
  key: PlanKey; name: string; priceEur: number; kind: 'personal' | 'team';
  workspaces: number | null; scopes: number; members: number | null; runsPerDay: number;
  customize: boolean; evaluation: boolean; requirementViewsPerMonth: number | null;
  blurb: string; features: string[];
};

export const PLANS: Plan[] = [
  {
    key: 'free', name: 'Free', priceEur: 0, kind: 'personal', workspaces: 1, scopes: 0, members: 1, runsPerDay: 1, customize: false,
    evaluation: false, requirementViewsPerMonth: 2,
    blurb: 'Follow the radar’s default scope.',
    features: ['One workspace', 'The default scope (EUDI Wallet & digital identity)', 'Requirements on 2 tender pages a month', 'Tender Evaluation Agent on Pro and Teams', 'Agents update tenders and news once a day', 'Community, chat and notifications'],
  },
  {
    key: 'starter', name: 'Starter', priceEur: 49, kind: 'personal', workspaces: 1, scopes: 1, members: 1, runsPerDay: 2, customize: true,
    evaluation: false, requirementViewsPerMonth: 10,
    blurb: 'Your own radar, tuned to your business.',
    features: ['One workspace', 'One customizable scope — your instructions, context and agents', 'Requirements on 10 tender pages a month', 'Tender Evaluation Agent on Pro and Teams', 'Agents update twice a day'],
  },
  {
    key: 'pro', name: 'Pro', priceEur: 69, kind: 'personal', workspaces: 1, scopes: 5, members: 1, runsPerDay: 3, customize: true,
    evaluation: true, requirementViewsPerMonth: null,
    blurb: 'Several markets or projects at once.',
    features: ['One workspace', 'Up to 5 customizable scopes', 'Tender evaluations and proposal briefs', 'Requirements on every tender', 'Agents update three times a day'],
  },
  {
    key: 'teams', name: 'Teams', priceEur: 99, kind: 'team', workspaces: null, scopes: 1000, members: null, runsPerDay: 6, customize: true,
    evaluation: true, requirementViewsPerMonth: null,
    blurb: 'For firms with departments and projects.',
    features: ['Unlimited workspaces', 'Unlimited team members (admins configure, members see results)', 'Unlimited scopes', 'Tender evaluations and proposal briefs', 'Requirements on every tender', 'Agents update six times a day'],
  },
];

export const planOf = (key: string | null | undefined) => PLANS.find((p) => p.key === key) ?? PLANS[0];
