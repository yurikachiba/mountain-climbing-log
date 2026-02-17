import { useEffect } from 'react';

interface HeadParams {
  title?: string;
  description?: string;
  path?: string;
}

const SITE_NAME = '登山ログ';
const BASE_URL = 'https://mountain-climbing-log.com';

export function useHead({ title, description, path }: HeadParams) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
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
  }, [title, description, path]);
}
