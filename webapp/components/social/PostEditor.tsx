'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Markdown } from 'tiptap-markdown';
import { FormState, createPost, createPostMediaUpload } from '@/app/social/actions';

type Media = { type: 'image' | 'video'; url: string; path: string };
const MAX_TAGS = 10;

const I = {
  link: <><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" /><path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" /></>,
  image: <><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><circle cx="6" cy="6.5" r="1.2" /><path d="m3 12 3.5-3.5 2.5 2.5 1.5-1.5L13 12" /></>,
  video: <><rect x="2" y="4" width="8.5" height="8" rx="1.5" /><path d="m10.5 7 3.5-2v6l-3.5-2" /></>,
  bold: <path d="M5 3h3.8a2.4 2.4 0 0 1 0 4.8H5zM5 7.8h4.4a2.6 2.6 0 0 1 0 5.2H5z" />,
  italic: <path d="M9.5 3H7M9 13H6.5M8.6 3 7.4 13" />,
  size: <><path d="M2.5 4.5V3.5h6v1M5.5 3.5V13M4 13h3" /><path d="M9.5 8V7.2h4V8M11.5 7.2V13M10.5 13h2" /></>,
  bullet: <><circle cx="3.5" cy="4.5" r=".8" /><circle cx="3.5" cy="8" r=".8" /><circle cx="3.5" cy="11.5" r=".8" /><path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" /></>,
  ordered: <><path d="M2.7 3.5h1v3M2.5 6.5h1.5M2.5 9.3c.3-.5 1.6-.6 1.6.3 0 .7-1.6 1.4-1.6 1.9h1.7" /><path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" /></>,
  quote: <><path d="M3 4.5v7M6 5.5h7M6 8h7M6 10.5h5" /></>,
  code: <><path d="m5.5 5-3 3 3 3M10.5 5l3 3-3 3M9 3.5 7 12.5" /></>,
  table: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 6.5h11M2.5 9.8h11M6.2 3v10M9.8 3v10" /></>,
  more: <><circle cx="3.5" cy="8" r="1.1" /><circle cx="8" cy="8" r="1.1" /><circle cx="12.5" cy="8" r="1.1" /></>,
  tag: <><path d="M2.5 8.2V3.2a.7.7 0 0 1 .7-.7h5l5.3 5.3a.9.9 0 0 1 0 1.3l-4 4a.9.9 0 0 1-1.3 0z" /><circle cx="5.5" cy="5.5" r="1" /></>,
};

function Tool({ icon, label, active, onClick, disabled }: { icon: keyof typeof I; label: string; active?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`pe-tool ${active ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      aria-label={label} title={label} aria-pressed={active} disabled={disabled}>
      <svg viewBox="0 0 16 16" aria-hidden="true">{I[icon]}</svg>
    </button>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary pe-post" disabled={pending || disabled}>{pending ? 'Posting…' : 'Post'}</button>;
}

/** Reddit-style post editor: title, tags, rich text (or Markdown) body with media. Saves Markdown. */
export default function PostEditor({ suggestions }: { suggestions: string[] }) {
  const [state, action] = useFormState<FormState, FormData>(createPost, null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich');
  const [markdown, setMarkdown] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const tagsDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mdArea = useRef<HTMLTextAreaElement>(null);
  const pickKind = useRef<'image' | 'video'>('image');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
      Placeholder.configure({ placeholder: 'Body Text (Optional)' }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
    ],
    editorProps: { attributes: { class: 'pe-rich', 'aria-label': 'Body text' } },
    onUpdate: ({ editor: e }) => setMarkdown(getMd(e)),
  });

  const getMd = (e: Editor) => ((e.storage as any).markdown?.getMarkdown?.() as string) ?? '';

  function switchMode() {
    if (!editor) return;
    if (mode === 'rich') { setMarkdown(getMd(editor)); setMode('markdown'); setTimeout(() => mdArea.current?.focus(), 0); }
    else { editor.commands.setContent(markdown); setMode('rich'); setTimeout(() => editor.commands.focus('end'), 0); }
    setSizeOpen(false); setLinkOpen(false);
  }

  function applyLink() {
    const url = linkUrl.trim();
    setLinkOpen(false); setLinkUrl('');
    if (!url) return;
    const href = (/^https?:\/\//i.test(url) ? url : `https://${url}`).replace(/[\s()]/g, encodeURIComponent);
    if (mode === 'markdown') {
      const el = mdArea.current; if (!el) return;
      const [a, b] = [el.selectionStart, el.selectionEnd];
      const text = markdown.slice(a, b) || 'link';
      const next = `${markdown.slice(0, a)}[${text}](${href})${markdown.slice(b)}`;
      setMarkdown(next);
      return;
    }
    if (!editor) return;
    const safe = href.replace(/[\s()]/g, encodeURIComponent);
    if (editor.state.selection.empty) editor.chain().focus().insertContent(`[${safe}](${safe}) `).run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  async function uploadFiles(files: FileList) {
    setUploadError(null);
    for (const file of Array.from(files)) {
      if (media.length >= 10) { setUploadError('Up to 10 images or videos per post.'); break; }
      setUploading(file.name);
      const target = await createPostMediaUpload(file.name, file.size);
      if ('error' in target) { setUploadError(`${file.name}: ${target.error}`); continue; }
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', file);
      const res = await fetch(target.url!, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
      if (!res.ok) { setUploadError(`${file.name}: upload failed (${res.status})`); continue; }
      setMedia((m) => [...m, { type: target.type!, url: target.publicUrl!, path: target.path! }]);
    }
    setUploading(null);
  }

  function pick(kind: 'image' | 'video') {
    pickKind.current = kind;
    if (fileInput.current) {
      fileInput.current.accept = kind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'video/mp4,video/webm,video/quicktime';
      fileInput.current.click();
    }
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().slice(0, 50);
    if (!t || tags.includes(t) || tags.length >= MAX_TAGS) return;
    setTags([...tags, t]);
  }

  const e = editor;
  const sizeLabel = e?.isActive('heading', { level: 2 }) ? 'Large' : e?.isActive('heading', { level: 3 }) ? 'Medium' : 'Normal';

  return (
    <form action={action} className="post-editor">
      <input type="hidden" name="body" value={markdown} />
      <input type="hidden" name="tags" value={JSON.stringify(tags)} />
      <input type="hidden" name="media" value={JSON.stringify(media)} />

      <label className="pe-title">
        <input name="title" value={title} onChange={(ev) => setTitle(ev.target.value)} required minLength={3} maxLength={300}
          placeholder=" " autoFocus aria-label="Title (required)" />
        <span className="pe-title-label" aria-hidden="true">Title<span className="pe-req">*</span></span>
        <span className="pe-count">{title.length}/300</span>
      </label>

      <div className="pe-tags">
        <button type="button" className="pe-add-tags" onClick={() => tagsDialog.current?.showModal()}>
          <svg viewBox="0 0 16 16" aria-hidden="true">{I.tag}</svg>Add tags
        </button>
        {tags.map((t) => (
          <span key={t} className="pe-chip">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>×</button></span>
        ))}
      </div>

      <div className={`pe-body ${mode}`}>
        {mode === 'rich' ? <EditorContent editor={editor} />
          : <textarea ref={mdArea} className="pe-md" value={markdown} onChange={(ev) => setMarkdown(ev.target.value)} placeholder="Body Text (Optional) — Markdown" aria-label="Body text (Markdown)" />}

        {(media.length > 0 || uploading) && (
          <div className="pe-media">
            {media.map((m) => (
              <div key={m.path} className="pe-media-item">
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/media-has-caption */}
                {m.type === 'image' ? <img src={m.url} alt="" /> : <video src={m.url} muted playsInline />}
                <button type="button" aria-label="Remove" onClick={() => setMedia(media.filter((x) => x.path !== m.path))}>×</button>
              </div>
            ))}
            {uploading && <div className="pe-media-item uploading"><span className="dots" /></div>}
          </div>
        )}

        <div className="pe-toolbar" role="toolbar" aria-label="Formatting">
          <div className="pe-tools">
            <span className="pe-pop-anchor">
              <Tool icon="link" label="Link" active={mode === 'rich' && !!e?.isActive('link')} onClick={() => { setLinkUrl((e?.getAttributes('link').href as string) || ''); setLinkOpen(!linkOpen); setSizeOpen(false); }} />
              {linkOpen && (
                <span className="pe-pop pe-link-pop">
                  <input autoFocus value={linkUrl} onChange={(ev) => setLinkUrl(ev.target.value)} placeholder="https://"
                    onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); applyLink(); } if (ev.key === 'Escape') setLinkOpen(false); }} aria-label="Link URL" />
                  <button type="button" className="btn primary" onClick={applyLink}>Add</button>
                  {mode === 'rich' && e?.isActive('link') && <button type="button" className="btn" onClick={() => { e.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Remove</button>}
                </span>
              )}
            </span>
            <Tool icon="image" label="Add images" onClick={() => pick('image')} disabled={!!uploading} />
            <Tool icon="video" label="Add a video" onClick={() => pick('video')} disabled={!!uploading} />
            {mode === 'rich' && e && (
              <>
                <span className="pe-sep" />
                <Tool icon="bold" label="Bold" active={e.isActive('bold')} onClick={() => e.chain().focus().toggleBold().run()} />
                <Tool icon="italic" label="Italic" active={e.isActive('italic')} onClick={() => e.chain().focus().toggleItalic().run()} />
                <span className="pe-pop-anchor">
                  <Tool icon="size" label={`Text size: ${sizeLabel}`} active={sizeLabel !== 'Normal'} onClick={() => { setSizeOpen(!sizeOpen); setLinkOpen(false); }} />
                  {sizeOpen && (
                    <span className="pe-pop pe-size-pop" role="menu">
                      {([['Large', 2], ['Medium', 3], ['Normal', 0]] as const).map(([label, level]) => (
                        <button key={label} type="button" role="menuitem" className={`pe-size-${label.toLowerCase()} ${sizeLabel === label ? 'on' : ''}`}
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => { level ? e.chain().focus().setHeading({ level }).run() : e.chain().focus().setParagraph().run(); setSizeOpen(false); }}>
                          {label}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
                <Tool icon="bullet" label="Bulleted list" active={e.isActive('bulletList')} onClick={() => e.chain().focus().toggleBulletList().run()} />
                <Tool icon="ordered" label="Numbered list" active={e.isActive('orderedList')} onClick={() => e.chain().focus().toggleOrderedList().run()} />
                <Tool icon="quote" label="Quote" active={e.isActive('blockquote')} onClick={() => e.chain().focus().toggleBlockquote().run()} />
                <Tool icon="code" label="Code block" active={e.isActive('codeBlock')} onClick={() => e.chain().focus().toggleCodeBlock().run()} />
                <Tool icon="table" label="Table" active={e.isActive('table')} onClick={() => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
              </>
            )}
          </div>
          <Tool icon="more" label={mode === 'rich' ? 'Switch to Markdown' : 'Switch to rich text editor'} active={mode === 'markdown'} onClick={switchMode} />
        </div>
      </div>
      <input ref={fileInput} type="file" multiple hidden onChange={(ev) => { if (ev.target.files?.length) uploadFiles(ev.target.files); ev.target.value = ''; }} />

      {uploadError && <p className="form-msg err">{uploadError}</p>}
      {state && !state.ok && <p className="form-msg err" role="status">{state.message}</p>}
      <div className="pe-actions"><Submit disabled={!!uploading || title.trim().length < 3} /></div>

      <dialog ref={tagsDialog} className="modal" onClick={(ev) => { if (ev.target === tagsDialog.current) tagsDialog.current?.close(); }}>
        <TagsModal tags={tags} suggestions={suggestions} onAdd={addTag} onRemove={(t) => setTags(tags.filter((x) => x !== t))}
          onDone={() => tagsDialog.current?.close()} />
      </dialog>
    </form>
  );
}

function TagsModal({ tags, suggestions, onAdd, onRemove, onDone }: {
  tags: string[]; suggestions: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; onDone: () => void;
}) {
  const [draft, setDraft] = useState('');
  useEffect(() => { if (tags.length >= MAX_TAGS) setDraft(''); }, [tags.length]);
  return (
    <div className="modal-body">
      <div className="modal-head">
        <h2>Add tags</h2>
        <button type="button" className="modal-close" aria-label="Close" onClick={onDone}>×</button>
      </div>
      <p className="field-hint">Tags help the right people find your post in the Community Feed. Up to {MAX_TAGS}.</p>
      <div className="pe-tag-input">
        <input value={draft} maxLength={50} placeholder="Type a tag and press Enter" disabled={tags.length >= MAX_TAGS}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); onAdd(draft); setDraft(''); } }} aria-label="New tag" />
        <span className="pe-count">{draft.length}/50</span>
        <button type="button" className="btn" disabled={!draft.trim() || tags.length >= MAX_TAGS} onClick={() => { onAdd(draft); setDraft(''); }}>Add</button>
      </div>
      {tags.length > 0 && (
        <div className="pe-tag-list">{tags.map((t) => <span key={t} className="pe-chip on">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onRemove(t)}>×</button></span>)}</div>
      )}
      <h3 className="pe-sugg-title">Suggestions</h3>
      <div className="pe-tag-list">
        {suggestions.filter((s) => !tags.includes(s)).map((s) => (
          <button key={s} type="button" className="pe-chip pe-sugg" onClick={() => onAdd(s)} disabled={tags.length >= MAX_TAGS}>+ {s}</button>
        ))}
      </div>
      <div className="modal-actions"><button type="button" className="btn primary" onClick={onDone}>Done</button></div>
    </div>
  );
}
