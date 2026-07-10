import { useEffect } from 'react';

import { absoluteUrl, robotsContent, siteName, type SeoMetadata } from '../lib/seo';

export function usePageSeo(metadata: SeoMetadata) {
  useEffect(() => {
    document.title = metadata.title;
    document.documentElement.lang = 'en';

    setMetaTag('name', 'description', metadata.description);
    setMetaTag('name', 'robots', metadata.robots ?? robotsContent);
    setMetaTag('property', 'og:site_name', siteName);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('property', 'og:title', metadata.title);
    setMetaTag('property', 'og:description', metadata.description);
    setMetaTag('property', 'og:image', absoluteUrl('/icon-512.png'));
    setMetaTag('name', 'twitter:card', 'summary');
    setMetaTag('name', 'twitter:title', metadata.title);
    setMetaTag('name', 'twitter:description', metadata.description);
    setMetaTag('name', 'twitter:image', absoluteUrl('/icon-512.png'));
    if (metadata.canonicalPath) {
      setMetaTag('property', 'og:url', absoluteUrl(metadata.canonicalPath));
      setCanonical(metadata.canonicalPath);
    } else {
      removeMetaTag('property', 'og:url');
      setCanonical();
    }
  }, [metadata]);
}

function setCanonical(path?: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!path) {
    link?.remove();
    return;
  }

  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.append(link);
  }

  link.href = absoluteUrl(path);
}

function setMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.append(tag);
  }

  tag.content = content;
}

function removeMetaTag(attribute: 'name' | 'property', key: string) {
  document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)?.remove();
}
