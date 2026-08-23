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
export default function Placeholder({ title }: { title: string; }) {
  return (
    <section>
      <h1>{title}</h1>
      <p>
        该页面尚未实现，将在后续步骤完成。
      </p>
    </section>
  );
}
