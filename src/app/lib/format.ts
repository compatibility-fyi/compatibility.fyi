export function formatWebsiteUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
