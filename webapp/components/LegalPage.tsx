/** Layout for Help, Terms and Privacy: title, optional draft notice, readable prose. */
export default function LegalPage({ title, updated, draft, children }: { title: string; updated?: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <article className="legal">
      <h1 className="opps-h1">{title}</h1>
      {updated && <p className="legal-updated">Last updated {updated}</p>}
      {draft && (
        <p className="callout legal-draft">
          <strong>Draft for legal review.</strong> Items in [brackets] are to be completed by WalliD before this is relied on.
        </p>
      )}
      <div className="legal-body">{children}</div>
    </article>
  );
}
