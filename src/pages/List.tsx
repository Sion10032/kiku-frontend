import Placeholder from './Placeholder';

export type ListType = 'circles' | 'tags' | 'vas';

/** 圈子/标签/声优列表页。步骤 9 实现。 */
export default function List({ type }: { type: ListType }) {
  const label = { circles: '圈子', tags: '标签', vas: '声优' }[type];
  return <Placeholder title={`${label}列表`} />;
}
