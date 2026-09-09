import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { M3eButton } from '@m3e/react/button';

/** 404 页面。步骤 15 完善样式。 */
export default function Error404() {
  const { t } = useTranslation();
  return (
    <section className='flex h-dvh flex-col items-center justify-center gap-4 text-center'>
      <h1 className='m-0 text-7xl'>404</h1>
      <p>{t('common.not-found')}</p>
      <Link to='/works' className='no-underline'>
        <M3eButton variant='filled'>{t('common.back-to-works')}</M3eButton>
      </Link>
    </section>
  );
}
