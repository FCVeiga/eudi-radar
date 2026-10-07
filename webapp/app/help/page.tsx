import Link from 'next/link';
import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Help — EUDI Radar' };

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: 'What is EUDI Radar?', a: 'A radar for public tenders, grants and market news in your field. Agents search TED, national portals, news and the sources you follow every day, sort what matters, and write it up for you.' },
  { q: 'How is the home feed ordered?', a: <><strong>Top</strong> blends each item’s relevance with how recent it is, so important news stays up longer. <strong>Relevance</strong> is the AI score alone; <strong>New</strong> is newest first.</> },
  { q: 'What does the heart do?', a: <>It follows a tender or news story. Everything you follow is under <strong>Following</strong> on your profile, visible only to you.</> },
  { q: 'What are the agents?', a: <>Each step of the radar is an agent — search, triage, documents, analysis, evaluation, proposal brief, news reports, feed writing and translation. Each scope in your <Link href="/workspace">Workspace</Link> has its own; on a paid plan you can switch them on or off and tune them in plain language.</> },
  { q: 'How do I get a fit score for a tender?', a: <>Open the tender and run the <strong>Tender Evaluation Agent</strong>. It checks the requirements against your scope’s instructions and context in Workspace. Then the <strong>Proposal Manager Agent</strong> can write the proposal brief.</> },
  { q: 'What are workspaces and plans?', a: <>A workspace holds your scopes — the configurations of the radar you work with. Free follows the default scope; Starter and Pro let you build your own scopes; Teams adds unlimited workspaces, each with its own team members (admins configure, members see the results). Create workspaces and add members on <Link href="/workspace">Workspace</Link>, change your plan in <Link href="/settings#billing">Settings</Link>, and switch workspaces from your account menu.</> },
  { q: 'I forgot my password.', a: <>Use <Link href="/forgot-password">Reset your password</Link> on the log-in page. (Reset emails need the platform’s email service to be set up; until then, contact us.)</> },
  { q: 'How do I change my profile or delete my account?', a: <>Profile → <strong>Edit profile</strong>. You can change your picture, name, username and description, change your password, or delete your account and all its data.</> },
];

export default function HelpPage() {
  return (
    <LegalPage title="Help">
      <div className="faq">
        {FAQ.map((f) => (
          <details key={f.q} className="faq-item">
            <summary>{f.q}</summary>
            <div>{f.a}</div>
          </details>
        ))}
      </div>
      <h2>Still stuck?</h2>
      <p>Write to us at [support email] and we’ll get back to you.</p>
    </LegalPage>
  );
}
