// 依赖补丁哨兵：@audio/decode-wavpack@1.0.0 的 wasm 输入缓冲泄漏由本地补丁
// （patches/@audio%2Fdecode-wavpack@1.0.0.patch，经 package.json 的
// patchedDependencies 应用）在包装层做 wasm 实例轮换修复。bun install 对
// 未应用的补丁会硬失败，但若依赖以其它方式安装（如迁移包管理器），补丁
// 可能静默缺失 → 长曲目播放 ~5 分钟后 "out of WASM memory"。本测试以
// 产物标记断言补丁在场，缺失时第一时间在 CI 暴露。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('wavpack 依赖补丁哨兵', () => {
  it('已安装的 @audio/decode-wavpack 含 wasm 实例轮换补丁（RECYCLE_FED_BYTES）', () => {
    const entry = require.resolve('@audio/decode-wavpack');
    const src = readFileSync(entry, 'utf8');
    expect(
      src.includes('RECYCLE_FED_BYTES'),
      '补丁未应用：@audio/decode-wavpack 缺少 wasm 实例轮换标记。'
        + '请用 bun install（package.json patchedDependencies）安装依赖；'
        + '若升级了该包，需重做 patches/ 下的补丁（上游修复后可直接移除）',
    ).toBe(true);
  });
});
