import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Privacy Policy — EUDI Radar' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2 October 2026" draft>
      <h2>Who is responsible</h2>
      <p>[WalliD legal entity name], [registered address], is the controller of the personal data described here. Contact: [privacy contact email]{' '}[and Data Protection Officer, if appointed].</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address and password (stored only as a secure hash by our authentication provider), username and sign-up date.</li>
        <li><strong>Profile:</strong> display name, picture and the description you write — shown on your public profile.</li>
        <li><strong>Activity:</strong> the tenders and news you follow (visible only to you), and — when community features launch — your posts and comments.</li>
        <li><strong>Scope context:</strong> files uploaded to a workspace’s scopes (such as presentations, references and team CVs, which can contain other people’s personal data). Upload only what you’re entitled to share.</li>
        <li><strong>Technical:</strong> a session cookie that keeps you signed in. We don’t use advertising or tracking cookies.</li>
      </ul>
      <h2>Why we use it</h2>
      <p>To provide your account and the platform’s features (performance of our contract with you), to keep the service secure, and to improve it (our legitimate interests). We don’t sell your data.</p>
      <h2>Who processes it for us</h2>
      <ul>
        <li><strong>Supabase</strong> — database, file storage and authentication (EU region: Ireland).</li>
        <li><strong>Vercel</strong> — website hosting.</li>
        <li><strong>Anthropic</strong> — AI models behind the agents; tender and company material is sent to them when an agent runs.</li>
        <li><strong>Tavily</strong> — web search and page reading for the search agents (no account data).</li>
      </ul>
      <p>[To be completed: transfers outside the EEA and the safeguards used, e.g. Standard Contractual Clauses.]</p>
      <h2>How long we keep it</h2>
      <p>For as long as your account exists. Deleting your account (Edit profile → Delete account) removes your profile, picture, follows, posts and comments. [Backup retention period to be completed.]</p>
      <h2>Your rights</h2>
      <p>You can access, correct or delete your data, object to or restrict its use, and ask for a copy (portability) — most of it directly in Edit profile, or by writing to [privacy contact email]. You can also complain to your data protection authority.</p>
    </LegalPage>
  );
}
