import type { ReactNode } from 'react';

/**
 * インライン記法（**太字**）をReact要素に変換する
 */
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return part;
  });
}

/**
 * AI出力テキストをパースして適切なHTML構造でレンダリングする。
 * 対応記法: **太字**, - 箇条書き, 空行
 */
export function AiResultBody({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let listItems: ReactNode[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} className="ai-result-list">
          {listItems}
        </ul>,
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^[-•]\s+(.*)/);

    if (bulletMatch) {
      listItems.push(<li key={i}>{renderInline(bulletMatch[1])}</li>);
    } else {
      flushList(`ul-${i}`);
      elements.push(
        <p key={i}>{line ? renderInline(line) : '\u00A0'}</p>,
      );
    }
  }
  flushList('ul-end');

  return <>{elements}</>;
}
