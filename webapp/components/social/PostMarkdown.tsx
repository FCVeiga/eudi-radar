import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** A post's body. Markdown only — raw HTML is never rendered, and unsafe link schemes are dropped. */
export default function PostMarkdown({ children }: { children: string }) {
  return (
    <div className="post-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}
        components={{ a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" /> }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
