/** 单行歌词：start/end 为秒（LRC 末行无结束时间，end 为 null）。 */
export interface LyricLine {
  start: number;
  end: number | null;
  text: string;
}

/**
 * 解析歌词文本为按 start 升序的行数组。
 *
 * - LRC：手写解析（支持一行多时间戳、空行过滤），end 取下一行 start
 * - VTT：手写解析，start/end 均来自 cue 时间轴
 *
 * @param type 歌词格式
 * @param text 歌词全文
 */
export function parseLyrics(type: 'lrc' | 'vtt', text: string): LyricLine[] {
  const lines = type === 'vtt' ? parseVtt(text) : parseLrc(text);
  return lines.sort((a, b) => a.start - b.start);
}

/** 行首连续时间戳字段（如 "[00:12.00][00:45.5]"）。 */
const lrcTimeFieldExp = /^((?:\[\d{1,3}:\d{1,2}(?:\.\d{1,3})?])+)/;
/** 单个时间戳：[mm:ss] / [mm:ss.xx] / [mm:ss.xxx]。 */
const lrcTimeExp = /\[(\d{1,3}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;

/**
 * 解析 LRC：支持一行多时间戳，空文本行（如 "[00:08.18]"）跳过；
 * end 取下一行 start，末行为 null。
 *
 * 未用 lrc-file-parser：该库会把毫秒段前导零去掉（".09" 当作 900ms），
 * 对 ".05" 类时间戳偏差达数百毫秒，故手写解析。
 */
function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    const field = lrcTimeFieldExp.exec(line)?.[0];
    if (!field) continue; // 无时间戳（普通文本 / [ti:] 等标签行）

    const lyricText = line.slice(field.length).trim();
    if (!lyricText) continue;

    for (const [, mm, ss, ms] of field.matchAll(lrcTimeExp)) {
      lines.push({
        start:
          Number(mm) * 60
          + Number(ss)
          + Number((ms ?? '0').padEnd(3, '0')) / 1000,
        end: null,
        text: lyricText,
      });
    }
  }

  lines.sort((a, b) => a.start - b.start);
  for (let i = 0; i + 1 < lines.length; i++) {
    lines[i].end = lines[i + 1].start;
  }
  return lines;
}

/** VTT 时间戳（HH:MM:SS.mmm，小时可缺省）转秒，无法解析返回 null。 */
function parseVttTime(stamp: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(stamp);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return (
    (h ? Number(h) * 3600 : 0)
    + Number(m) * 60
    + Number(s)
    + Number(ms.padEnd(3, '0')) / 1000
  );
}

/**
 * 解析 WebVTT 文本。
 *
 * 按空行分块，跳过 WEBVTT 头 / NOTE / STYLE 等无 cue 行的块；
 * cue 行为 `start --> end`（可能缺 cue id、end 后带对齐参数），
 * 文本为 cue 行之后到块尾，多行以空格连接。
 */
function parseVtt(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);

  for (const block of blocks) {
    const rows = block.split('\n').filter((row) => row.trim() !== '');
    const cueIndex = rows.findIndex((row) => row.includes('-->'));
    if (cueIndex === -1) continue;

    const [rawStart, rawEnd] = rows[cueIndex].split('-->');
    if (rawEnd == null) continue;
    const start = parseVttTime(rawStart.trim());
    const end = parseVttTime(rawEnd.trim().split(/\s+/)[0]);
    if (start == null || end == null) continue;

    const cueText = rows.slice(cueIndex + 1).join(' ');
    if (cueText) lines.push({ start, end, text: cueText });
  }
  return lines;
}

/**
 * 查找 time 所在的歌词行下标（含 start、不含 end），无匹配返回 -1。
 *
 * 行间空隙（VTT 常见）返回 -1；LRC 行首尾相接，仅 time 早于首行时为 -1。
 */
export function findActiveLineIndex(lines: LyricLine[], time: number): number {
  for (let i = 0; i < lines.length; i++) {
    const { start, end } = lines[i];
    if (time < start) return -1;
    if (end == null || time < end) return i;
  }
  return -1;
}
