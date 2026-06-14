import { diffChars, diffLines } from 'diff';
import * as Prism from 'prismjs';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-toml.js';
import 'prismjs/components/prism-swift.js';
import 'prismjs/components/prism-objectivec.js';
import { useEffect, useState } from 'react';

// diffLines produces line-level parts (equal/added/removed) that define the
// diff structure. diffChars is applied to paired removed/added lines to find
// character-level changes for inline diff highlights on the Prism token trees.

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  // Position in old text (removed/context) or new text (added).
  start: number;
  // Character length of content (excluding trailing newline).
  length: number;
  // Non-equal character ranges that overlap this line (for inline diff highlighting).
  highlightRanges: Array<{ start: number; length: number; }>;
}

const extMap: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  rs: 'rust',
  py: 'python',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  toml: 'toml',
  swift: 'swift',
  m: 'objective-c',
  mm: 'objective-c', // imperfect fallback — no dedicated ObjC++ Prism component; covers @ directives but not C++ syntax
};

function detectLanguage(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  const lang = extMap[ext];
  if (!lang) return undefined;
  return lang;
}

const MAX_HIGHLIGHTED_LINES = 500;

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
    }
    return true;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setDark((e as MediaQueryListEvent)?.matches ?? (e as MediaQueryList).matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return dark;
}

const darkTokenStyles: Record<string, React.CSSProperties> = {
  comment: { color: '#6a737d', fontStyle: 'italic' },
  punctuation: { color: '#d4d4d4' },
  property: { color: '#ce9178' },
  number: { color: '#b5cea8' },
  string: { color: '#ce9178' },
  keyword: { color: '#569cd6' },
  boolean: { color: '#569cd6' },
  function: { color: '#dcdcaa' },
  'class-name': { color: '#4ec9b0' },
  constant: { color: '#4fc1ff' },
};

const lightTokenStyles: Record<string, React.CSSProperties> = {
  comment: { color: '#008000', fontStyle: 'italic' },
  punctuation: { color: '#000000' },
  property: { color: '#a31515' },
  number: { color: '#098658' },
  string: { color: '#a31515' },
  keyword: { color: '#af00db' },
  boolean: { color: '#0000ff' },
  function: { color: '#795e26' },
  'class-name': { color: '#267f99' },
  constant: { color: '#0000ff' },
};

/**
 * Flatten the Prism token tree into an array of { start, length, color } entries,
 * referencing positions in the original text. Only stores entries for token types
 * we actually color — untokenized text is rendered as plain text.
 */
function collectStyledSegments(
  tokens: Prism.TokenStream,
  start: number,
  style: React.CSSProperties | undefined,
  result: Array<{ start: number; length: number; style: React.CSSProperties }>,
  colors: Record<string, React.CSSProperties>,
): number {
  if (typeof tokens === 'string') {
    if (style && Object.keys(style).length > 0) {
      result.push({ start: start, length: tokens.length, style });
    }
    return start + tokens.length;
  }
  if (Array.isArray(tokens)) {
    for (const t of tokens) {
      start = collectStyledSegments(t, start, style, result, colors);
    }
    return start;
  }
  if (!tokens || tokens.type === 'no newline') return start;
  return collectStyledSegments(tokens.content, start, colors[tokens.type], result, colors);
}

/**
 * Render a line of the diff, applying syntax highlighting and inline diff highlights.
 * Both styleSegments and highlightRanges are converted to line-relative coords,
 * then merged into a single sorted walk — every boundary of either kind splits the text.
 */
function renderLineWithSyntax(
  line: DiffLine,
  source: string,
  styleSegments: Array<{ start: number; length: number; style: React.CSSProperties }>,
  highlightColor: string | undefined,
  ctx: { key: number },
): React.ReactNode {
  if (line.length === 0) return null;

  const lineContent = source.slice(line.start, line.start + line.length);

  // Clip styleSegments to line-relative coords.
  const lineSegments: Array<{ start: number; length: number; style: React.CSSProperties }> = [];
  for (const seg of styleSegments) {
    const segEnd = seg.start + seg.length;
    if (segEnd <= line.start || seg.start >= line.start + line.length) continue;
    lineSegments.push({
      start: Math.max(seg.start, line.start) - line.start,
      length: Math.min(segEnd, line.start + line.length) - Math.max(seg.start, line.start),
      style: seg.style,
    });
  }

  // Collect all boundary points (start/end of a style range or highlight range).
  const points = new Set<number>();
  points.add(0);
  points.add(line.length);
  for (const seg of lineSegments) {
    points.add(seg.start);
    points.add(seg.start + seg.length);
  }
  if (highlightColor) {
    for (const hr of line.highlightRanges) {
      const clippedStart = Math.max(hr.start, 0);
      const clippedEnd = Math.min(hr.start + hr.length, line.length);
      if (clippedStart < clippedEnd) {
        points.add(clippedStart);
        points.add(clippedEnd);
      }
    }
  }
  const sorted = Array.from(points).sort((a, b) => a - b);

  // Walk each slice, determining which style and highlight (if any) apply.
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i];
    const e = sorted[i + 1];
    if (s >= e) continue;
    const slice = lineContent.slice(s, e);
    if (!slice.length) continue;

    // Find matching style segment.
    let style: React.CSSProperties | undefined;
    for (const seg of lineSegments) {
      if (seg.start <= s && seg.start + seg.length >= e) {
        style = seg.style;
        break;
      }
    }

    // Add highlight background if this slice overlaps any highlight range.
    if (highlightColor) {
      for (const hr of line.highlightRanges) {
        const hrEnd = hr.start + hr.length;
        if (hr.start < e && hrEnd > s) {
          style = { ...style, background: highlightColor };
          break;
        }
      }
    }

    if (style && Object.keys(style).length > 0) {
      parts.push(<span key={ctx.key++} style={style}>{slice}</span>);
    } else {
      parts.push(<span key={ctx.key++}>{slice}</span>);
    }
  }

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return <>{parts}</>;
}

interface DiffLineWithSyntaxProps {
  line: DiffLine;
  source: string;
  segments: Array<{ start: number; length: number; style: React.CSSProperties }>;
  language?: string;
  index: number;
  dark: boolean;
}

function DiffLineWithSyntax({
  line,
  source,
  segments,
  language,
  index,
  dark,
}: DiffLineWithSyntaxProps) {
  const bg = line.type === 'added'
    ? (dark ? 'rgba(0,255,0,0.1)' : 'rgba(0,255,0,0.1)')
    : line.type === 'removed'
      ? (dark ? 'rgba(255,0,0,0.1)' : 'rgba(255,0,0,0.1)')
      : 'transparent';
  const textColor = dark ? '#c9d1d9' : '#1e1e1e';
  const prefixColor = line.type === 'added'
    ? (dark ? '#bbf7d0' : '#15803d')
    : line.type === 'removed'
      ? (dark ? '#fecaca' : '#b91c1c')
      : textColor;
  const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';

  // Syntax highlighting + inline diff in one pass
  if (language && index < MAX_HIGHLIGHTED_LINES && source) {
    const highlightColor = line.type === 'removed'
      ? 'rgba(255,0,0,0.2)'
      : line.type === 'added'
        ? 'rgba(0,255,0,0.2)'
        : undefined;

    return (
      <div
        style={{
          display: 'flex',
          background: bg,
          color: textColor,
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '18px',
          whiteSpace: 'pre',
          padding: '0 8px',
        }}
      >
        <span style={{ color: prefixColor }}>{prefix}</span>
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {renderLineWithSyntax(
             line,
             source,
             segments,
             highlightColor,
             { key: 0 }
           )}
        </span>
      </div>
    );
  }

  // Fallback: no language or too many lines — render plain text
  const lineContent = source.slice(line.start, line.start + line.length);
  return (
    <div
      style={{
        display: 'flex',
        background: bg,
        color: textColor,
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: '18px',
        whiteSpace: 'pre',
        padding: '0 8px',
      }}
    >
      <span style={{ color: prefixColor }}>{prefix}</span>
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{lineContent}</span>
    </div>
  );
}

interface DiffViewerProps {
  oldValue?: string;
  newValue?: string;
  fileName?: string;
}

export function DiffViewer({ oldValue, newValue, fileName }: DiffViewerProps) {
  const lines: DiffLine[] = [];
  const dark = useDarkMode();
  const language = detectLanguage(fileName);

  // Tokenize full texts once so character positions in the token tree
  // exactly match absolute character positions in the diff ranges.
  let oldStyles: Array<{ start: number; length: number; style: React.CSSProperties }> = [];
  let newStyles: Array<{ start: number; length: number; style: React.CSSProperties }> = [];

  if (oldValue !== undefined && newValue !== undefined && language) {
    try {
      const colors = dark ? darkTokenStyles : lightTokenStyles;
      collectStyledSegments(Prism.tokenize(oldValue, Prism.languages[language]), 0, undefined, oldStyles, colors);
      collectStyledSegments(Prism.tokenize(newValue, Prism.languages[language]), 0, undefined, newStyles, colors);
    } catch {
      // Prism failed (e.g. Objective-C++ with no dedicated grammar).
      // Fall back to JavaScript, then to raw strings.
      try {
        const colors = dark ? darkTokenStyles : lightTokenStyles;
        collectStyledSegments(Prism.tokenize(oldValue, Prism.languages.javascript), 0, undefined, oldStyles, colors);
        collectStyledSegments(Prism.tokenize(newValue, Prism.languages.javascript), 0, undefined, newStyles, colors);
      } catch {
      }
    }
  }

  // Build line-level diff using diffLines, then compute character-level
  // inline highlights via diffChars on paired removed/added lines.
  if (oldValue !== undefined && newValue !== undefined) {
    try {
      const lineParts = diffLines(oldValue, newValue);

      // Collect non-equal character ranges from diffChars result.
      // `type` is 'removed' for chars in old but not new, 'added' for chars in new but not old.
      function collectHighlightRanges(
        charParts: Array<{ value: string; added?: boolean; removed?: boolean; count?: number }>,
        type: 'removed' | 'added',
        lineStart: number,
        lineLength: number,
      ): Array<{ start: number; length: number }> {
        const ranges: Array<{ start: number; length: number }> = [];
        let pos = 0;
        for (const part of charParts) {
          // Only process parts that match the type OR are context.
          // Parts of the other type need to be ignored to get the math right.
          const isChanged = part[type];
          const isContext = (!part.added && !part.removed);
          if (isChanged || isContext) {
            const partEnd = pos + part.value.length;
            const partStart = pos;
            if (partEnd <= lineStart || partStart > lineStart + lineLength) {
              pos = partEnd;
              continue;
            }
            // Only collect parts that are changes
            if (isChanged) {
              ranges.push({ start: partStart, length: part.value.length });
            }
            pos = partEnd;
          }
        }
        return ranges;
      }

      // Walk lineParts to build the DiffLine array.
      // Buffers track removed/added lines that may be paired for inline highlighting.
      interface PendingLine {
        content: string;
        pos: number;
        length: number;
      }
      let removedBuffer: PendingLine[] = [];
      let addedBuffer: PendingLine[] = [];
      let oldPos = 0;
      let newPos = 0;

      for (const part of lineParts) {
        let partLines = part.value.split('\n');
        // Drop trailing empty string from split when value ends with \n.
        if (part.value.endsWith('\n')) partLines.pop();

        if (part.removed) {
          // Emit any pending added lines (no removed lines to pair with).
          if (addedBuffer.length > 0) {
            for (const a of addedBuffer) {
              lines.push({ type: 'added', start: a.pos, length: a.length, highlightRanges: [] });
            }
            addedBuffer = [];
          }
          // Buffer removed lines for potential pairing with subsequent added lines.
          for (const line of partLines) {
            const isComplete = (oldPos + line.length) < oldValue!.length && oldValue![oldPos + line.length] === '\n';
            removedBuffer.push({
              content: line,
              pos: oldPos,
              length: isComplete ? line.length + 1 : line.length,
            });
            oldPos += (isComplete ? line.length + 1 : line.length);
          }
        } else if (part.added) {
          // Pair added lines with buffered removed lines for inline highlighting.
          while (addedBuffer.length < removedBuffer.length && partLines.length > 0) {
            const removed = removedBuffer.shift()!;
            const addedContent = partLines.shift()!;
            const addedIsComplete = (newPos + addedContent.length) < newValue!.length && newValue![newPos + addedContent.length] === '\n';
            const addedLength = addedIsComplete ? addedContent.length + 1 : addedContent.length;

            const charDiff = diffChars(removed.content, addedContent);
            const removedRanges = collectHighlightRanges(charDiff, 'removed', 0, removed.content.length);
            const addedRanges = collectHighlightRanges(charDiff, 'added', 0, addedContent.length);

            lines.push({ type: 'removed', start: removed.pos, length: removed.length, highlightRanges: removedRanges });
            lines.push({ type: 'added', start: newPos, length: addedLength, highlightRanges: addedRanges });

            newPos += addedLength;
          }
          // Emit remaining removed lines without highlighting.
          for (const r of removedBuffer) {
            lines.push({ type: 'removed', start: r.pos, length: r.length, highlightRanges: [] });
          }
          removedBuffer = [];
          // Emit paired added lines (already emitted above).
          // Buffer any remaining added lines.
          for (const line of partLines) {
            const isComplete = (newPos + line.length) < newValue!.length && newValue![newPos + line.length] === '\n';
            addedBuffer.push({
              content: line,
              pos: newPos,
              length: isComplete ? line.length + 1 : line.length,
            });
            newPos += (isComplete ? line.length + 1 : line.length);
          }
        } else {
          // Context part — flush both buffers as unhighlighted lines.
          for (const r of removedBuffer) {
            lines.push({ type: 'removed', start: r.pos, length: r.length, highlightRanges: [] });
          }
          removedBuffer = [];
          for (const a of addedBuffer) {
            lines.push({ type: 'added', start: a.pos, length: a.length, highlightRanges: [] });
          }
          addedBuffer = [];
          // Emit context lines.
          for (const line of partLines) {
            const isComplete = (oldPos + line.length) < oldValue!.length && oldValue![oldPos + line.length] === '\n';
            const isNewComplete = (newPos + line.length) < newValue!.length && newValue![newPos + line.length] === '\n';
            const length = isComplete ? line.length + 1 : line.length;
            lines.push({ type: 'context', start: newPos, length, highlightRanges: [] });
            oldPos += (isComplete ? line.length + 1 : line.length);
            newPos += (isNewComplete ? line.length + 1 : line.length);
          }
        }
      }

      // Flush any remaining buffered lines.
      for (const r of removedBuffer) {
        lines.push({ type: 'removed', start: r.pos, length: r.length, highlightRanges: [] });
      }
      for (const a of addedBuffer) {
        lines.push({ type: 'added', start: a.pos, length: a.length, highlightRanges: [] });
      }
    } catch {
      // empty diff
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${dark ? '#30363d' : '#d0d7de'}`,
        borderRadius: '6px',
        overflow: 'auto',
        background: dark ? '#0d1117' : '#ffffff',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${dark ? '#30363d' : '#d0d7de'}`,
          color: dark ? '#c9d1d9' : '#1e1e1e',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}
      >
        {fileName}
      </div>
      <div style={{ fontSize: '12px' }}>
        {lines.map((line, i) => {
          const source = line.type === 'removed' ? (oldValue ?? '') : (newValue ?? '');
          const segments = line.type === 'removed' ? oldStyles : newStyles;
          return (
            <DiffLineWithSyntax
              key={i}
              line={line}
              source={source}
              segments={segments}
              language={language}
              index={i}
              dark={dark}
            />
          );
        })}
      </div>
    </div>
  );
}
