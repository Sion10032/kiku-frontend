import { useTranslation } from 'react-i18next';

/**
 * 通用占位页面。各页面在后续步骤实现：
 * - Works        → 步骤 6
 * - Work         → 步骤 7
 * - List         → 步骤 9
 * - Favourites   → 步骤 10
 * - Login        → 步骤 5
 * - Dashboard/*  → 步骤 13
 * - Error404     → 步骤 15
 *
 * 实现后删除对应导入并替换为真实组件。
 */
export default function Placeholder({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{title}</h1>
      <p>{t('common.not-implemented')}</p>
    </section>
  );
}
