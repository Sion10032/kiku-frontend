import { workRoute } from '../routes/work';
import { useWorkQuery, useTracksQuery } from '../queries/useWorksQuery';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import WorkDetails from '../components/WorkDetails';
import WorkTree from '../components/WorkTree';

/**
 * 作品详情页。
 *
 * - 路由参数 id（完整 RJ code，如 "RJ01173549"）→ useWorkQuery(id) 拉取作品元数据
 * - useTracksQuery(id) 拉取文件树（后端 501 时内部回退 mock，见 api/works.ts）
 * - 左侧 WorkDetails 信息卡，右侧 WorkTree 文件树
 */
export default function Work() {
  const { id } = workRoute.useParams();
  const workQuery = useWorkQuery(id);
  const tracksQuery = useTracksQuery(id);

  if (workQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <M3eCircularProgressIndicator />
      </div>
    );
  }

  if (workQuery.isError || !workQuery.data) {
    return (
      <div className="py-16 text-center opacity-60">作品不存在或加载失败</div>
    );
  }

  const work = workQuery.data;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 lg:flex-row lg:items-start">
      <div className="w-full shrink-0 lg:w-90">
        <WorkDetails work={work} />
      </div>
      <div className="min-w-0 flex-1">
        <WorkTree
          work={work}
          tree={tracksQuery.data ?? []}
          loading={tracksQuery.isLoading}
        />
      </div>
    </div>
  );
}
