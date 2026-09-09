import { useTranslation } from 'react-i18next';
import { workRoute } from '../routes/work';
import { useWorkQuery, useTracksQuery } from '../queries/useWorksQuery';
import { useWorkProgressQuery } from '../queries/useProgressQuery';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import WorkDetails from '../components/work/WorkDetails';
import WorkTree from '../components/work/WorkTree';
import WorkResume from '../components/work/WorkResume';

/**
 * 作品详情页。
 *
 * - 路由参数 id（完整 RJ code，如 "RJ01173549"）→ useWorkQuery(id) 拉取作品元数据
 * - useTracksQuery(id) 拉取文件树（后端 501 时内部回退 mock，见 api/works.ts）
 * - 左侧 WorkDetails 信息卡，右侧 WorkTree 文件树
 */
export default function Work() {
  const { t } = useTranslation();
  const { id } = workRoute.useParams();
  const workQuery = useWorkQuery(id);
  const tracksQuery = useTracksQuery(id);
  useWorkProgressQuery(id); // 进度行 → progressStore（WorkTree 显示/续播共用）

  if (workQuery.isLoading) {
    return (
      <div className='flex justify-center py-12'>
        <M3eCircularProgressIndicator />
      </div>
    );
  }

  if (workQuery.isError || !workQuery.data) {
    return (
      <div className='py-16 text-center opacity-60'>
        {t('works.load-failed')}
      </div>
    );
  }

  const work = workQuery.data;

  return (
    <div className='mx-auto flex max-w-350 flex-col gap-6 lg:flex-row lg:items-start'>
      <div className='w-full shrink-0 lg:w-90'>
        <WorkDetails work={work} />
      </div>
      <div className='min-w-0 flex-1'>
        {/* 继续播放/删除播放记录（登录且有进度时渲染） */}
        <div className='mb-3'>
          <WorkResume work={work} tree={tracksQuery.data ?? []} />
        </div>
        <WorkTree
          work={work}
          tree={tracksQuery.data ?? []}
          loading={tracksQuery.isLoading}
        />
      </div>
    </div>
  );
}
