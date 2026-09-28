// WavPack 前端解码正确性冒烟关卡：
// decode-wavpack 解码 fixture → 与 ffmpeg 重新生成的参考 PCM 逐采样对比，
// 断言 maxDiff ≤ 1/32768（≤1 LSB @16bit）。
// /tmp/test-6s.f32 由本脚本用 ffmpeg 重新生成，不入库。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import decode from '@audio/decode-wavpack';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'src/wavpack/__fixtures__/test-6s.wv');
const refPath = '/tmp/test-6s.f32';
const MAX_DIFF = 1 / 32768;

// 重新生成参考 PCM（ffmpeg 解码 fixture 本身，保证参考与 fixture 同步）
execFileSync(
  'ffmpeg',
  ['-y', '-i', fixture, '-c:a', 'pcm_f32le', '-f', 'f32le', refPath],
  {
    stdio: 'pipe',
  },
);

const { channelData, sampleRate } = await decode(readFileSync(fixture));

// 参考 PCM 为交错 f32le（L R L R ...），decode-wavpack 输出按声道分离
const refBytes = Uint8Array.from(readFileSync(refPath));
const ref = new Float32Array(refBytes.buffer);
const [ch0, ch1] = channelData;

if (ch0.length !== ch1.length) {
  throw new Error(`channel length mismatch: ${ch0.length} vs ${ch1.length}`);
}
if (ref.length !== ch0.length * 2) {
  throw new Error(
    `sample count mismatch: ref=${ref.length} decoded=${ch0.length * 2}`,
  );
}

let maxDiff = 0;
for (let i = 0; i < ch0.length; i++) {
  const d0 = Math.abs(ref[2 * i] - ch0[i]);
  const d1 = Math.abs(ref[2 * i + 1] - ch1[i]);
  if (d0 > maxDiff) maxDiff = d0;
  if (d1 > maxDiff) maxDiff = d1;
}

console.log(
  `sampleRate=${sampleRate} samples=${ch0.length} maxDiff=${maxDiff}`,
);
if (maxDiff > MAX_DIFF) {
  throw new Error(`SMOKE FAIL: maxDiff=${maxDiff} > ${MAX_DIFF}`);
}
console.log('SMOKE PASS');
