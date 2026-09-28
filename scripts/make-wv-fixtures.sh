#!/usr/bin/env bash
# 生成 .wv 测试 fixture：6 秒 44.1kHz 立体声 16bit，确定性 lavfi 信号（与 PoC 同款表达式）。
# 产物：src/wavpack/__fixtures__/test-6s.wv（入库）；/tmp/test-6s.{wav,f32} 为临时参考文件。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p src/wavpack/__fixtures__

ffmpeg -y -f lavfi -i "aevalsrc=0.5*sin(2*PI*(200+11*t)*t)|0.35*sin(2*PI*440*t)+0.15*sin(2*PI*(310+7*t)*t):s=44100:d=6" \
  -c:a pcm_s16le /tmp/test-6s.wav
ffmpeg -y -i /tmp/test-6s.wav -c:a wavpack src/wavpack/__fixtures__/test-6s.wv
ffmpeg -y -i src/wavpack/__fixtures__/test-6s.wv -c:a pcm_f32le -f f32le /tmp/test-6s.f32
