import { useEffect } from 'react';
import { SITE_NAME, BASE_URL, DEFAULT_KEYWORDS } from '../config';

interface HeadParams {
  title?: string;
  description?: string;
  keywords?: string;
  path?: string;
}

export function useHead({ title, description, keywords, path }: HeadParams) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | ${SITE_NAME} ― 日記管理・分析・可視化`
      : `${SITE_NAME} ― 日記を取り込んで過去の自分と再会する無料ウェブアプリ`;
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }

    setMeta('name', 'keywords', keywords ? `${keywords},${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS);

    setMeta('property', 'og:title', fullTitle);
    setMeta('name', 'twitter:title', fullTitle);

    if (path) {
      const url = `${BASE_URL}${path}`;
      setMeta('property', 'og:url', url);

      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', url);
    }

    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, keywords, path]);
}
