/** Plain text of an uploaded company file: PDF, Word, PowerPoint, Excel, text. */
import JSZip from 'jszip';

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export async function fileText(name: string, data: Buffer): Promise<string> {
  const low = name.toLowerCase();
  if (data.subarray(0, 4).toString() === '%PDF' || low.endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text);
  }
  if (low.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    return (await mammoth.extractRawText({ buffer: data })).value;
  }
  if (low.endsWith('.pptx') || low.endsWith('.xlsx')) {
    const zip = await JSZip.loadAsync(data);
    if (low.endsWith('.pptx')) {
      // Slides in order, each slide's text runs joined.
      const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
      const out: string[] = [];
      for (const [i, f] of slides.entries()) {
        const xml = await zip.file(f)!.async('string');
        const runs = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => decode(m[1]));
        if (runs.length) out.push(`[Slide ${i + 1}] ${runs.join(' ')}`);
      }
      return out.join('\n');
    }
    const shared = await zip.file('xl/sharedStrings.xml')?.async('string');
    return Array.from((shared || '').matchAll(/<t[^>]*>([^<]*)<\/t>/g)).map((m) => decode(m[1])).join(' | ');
  }
  if (/\.(txt|md|csv)$/.test(low)) return data.toString('utf8');
  return '';
}
