// WavPack 播放错误的文案常量与 i18n key 映射。
//
// worker 侧用常量拼装 error message——文案前缀本身是主线程识别协议的一部分，
// 改动需与本文件的映射同步；主线程 WasmWvPlayer.fail() 经 wavpackErrorKey
// 把已知错误收敛为本地化文案（worker 不感知界面语言），未知/动态 message
// 保留 player.wavpack-error 的 {{message}} 插值兜底。

/** 不受支持/损坏文件（load 阶段 open/解码失败） */
export const WAVPACK_UNSUPPORTED_TEXT =
  '该文件为不受支持的 WavPack 文件或已损坏';
/** seek 探测定位失败（前缀，后接 sample N） */
export const WAVPACK_SEEK_FAILED_PREFIX = 'seek 定位失败：';
/** 流式数据不足 totalSamples（前缀，后接帧数明细） */
export const WAVPACK_TRUNCATED_PREFIX = '流提前结束';

export type WavpackErrorCode = 'DECODE' | 'NETWORK';

export type WavpackErrorI18nKey =
  | 'player.wavpack-error'
  | 'player.wavpack-error-unsupported'
  | 'player.wavpack-error-seek'
  | 'player.wavpack-error-truncated'
  | 'player.wavpack-error-network';

/** 已知错误 → i18n key；NETWORK 与未知 message 走原文插值兜底 */
export function wavpackErrorKey(
  code: WavpackErrorCode,
  message: string,
): WavpackErrorI18nKey {
  if (message === WAVPACK_UNSUPPORTED_TEXT) {
    return 'player.wavpack-error-unsupported';
  }
  if (message.startsWith(WAVPACK_SEEK_FAILED_PREFIX)) {
    return 'player.wavpack-error-seek';
  }
  if (message.startsWith(WAVPACK_TRUNCATED_PREFIX)) {
    return 'player.wavpack-error-truncated';
  }
  if (code === 'NETWORK') return 'player.wavpack-error-network';
  return 'player.wavpack-error';
}
