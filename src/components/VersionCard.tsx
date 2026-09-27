import { useTranslation } from 'react-i18next';
import { M3eCard } from '@m3e/react/card';
import { SETTING_ROW_LAYOUT } from '../constants';
import { useVersionQuery } from '../queries/useVersionQuery';
import type { VersionResponse } from '../types';
import { APP_COMMIT, APP_VERSION, formatVersion } from '../utils/appVersion';

/**
 * 服务端一行的文案：有数据显示 `版本-commit`；请求失败显示 `—`；
 * 加载中留空（`—` 只代表「拿不到」，不代表「还在请求」，两者不混用）。
 */
function backendVersion(
  data: VersionResponse | undefined,
  isError: boolean,
): string {
  if (data) return formatVersion(data.current, data.commit);
  return isError ? '—' : '';
}

/** 一行「标签 + 版本号」：窄屏上下堆叠，≥sm 左右分布（同其它设置行） */
function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={SETTING_ROW_LAYOUT}>
      <span>{label}</span>
      <span className='text-sm tabular-nums opacity-70'>{value}</span>
    </div>
  );
}

/**
 * 版本卡片（设置页底部）：前端构建期注入的版本 + 服务端 GET /api/version。
 * 形如 `v9.9.9-abc1234`；版本未注入为 `dev`、commit 未注入为 `unknown`（见 utils/appVersion）。
 * 无交互、无更新检查（后端 latest 目前恒为 null，不做假按钮）。
 *
 * 不设卡片标题：两行「前端 / 服务端」已自明，与设置页其它卡片的朴素风格一致。
 */
export default function VersionCard() {
  const { t } = useTranslation();
  const { data, isError } = useVersionQuery();

  return (
    <M3eCard>
      <div slot='content' className='flex flex-col gap-6'>
        <VersionRow
          label={t('settings.version-frontend')}
          value={formatVersion(APP_VERSION, APP_COMMIT)}
        />
        <VersionRow
          label={t('settings.version-backend')}
          value={backendVersion(data, isError)}
        />
      </div>
    </M3eCard>
  );
}
