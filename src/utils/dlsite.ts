import { getWorkCodePrefix } from './workId';

/** DLsite 作品页链接（id 为完整作品代码；RJ → home 站，VJ → pro 站） */
export function dlsiteUrl(workId: string): string {
  const site = getWorkCodePrefix(workId) === 'VJ' ? 'pro' : 'home';
  return `https://www.dlsite.com/${site}/work/=/product_id/${workId}.html`;
}
