import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectCurrentIndex,
  selectCurrentTrack,
  usePlayerStore,
  type Track,
} from './playerStore';

const t = (hash: string): Track => ({
  hash,
  title: `曲 ${hash}`,
  workTitle: '作品',
  workId: 'RJ000',
});

beforeEach(() => {
  localStorage.clear();
  usePlayerStore.setState({
    queue: [],
    currentUid: null,
    playing: false,
    playMode: 'order',
  });
});

describe('setQueue 入队分配条目 uid', () => {
  it('每条目 uid 唯一，currentUid 指向 index 条目', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b'), t('c')], 1);
    const { queue, currentUid } = usePlayerStore.getState();
    expect(new Set(queue.map((x) => x.uid)).size).toBe(3);
    expect(currentUid).toBe(queue[1].uid);
    expect(selectCurrentIndex(usePlayerStore.getState())).toBe(1);
  });

  it('重复 hash 的条目获得不同 uid', () => {
    usePlayerStore.getState().setQueue([t('a')], 0);
    usePlayerStore.getState().playNext(t('a')); // 「下一首播放」同曲
    const { queue, currentUid } = usePlayerStore.getState();
    expect(queue).toHaveLength(2);
    expect(queue[0].hash).toBe(queue[1].hash);
    expect(queue[0].uid).not.toBe(queue[1].uid);
    expect(currentUid).toBe(queue[0].uid);
  });
});

describe('reorderQueue 重排不改变当前曲目', () => {
  it('当前曲被拖走后 currentUid 仍指向它（回归：索引修正 bug）', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b'), t('c')], 1);
    const b = usePlayerStore.getState().queue[1];
    usePlayerStore.getState().reorderQueue(1, 2);
    const s = usePlayerStore.getState();
    expect(s.queue[2].uid).toBe(b.uid);
    expect(s.currentUid).toBe(b.uid);
    expect(selectCurrentIndex(s)).toBe(2);
  });

  it('其他曲拖过当前曲，当前曲身份不变', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b'), t('c')], 1);
    const b = usePlayerStore.getState().queue[1];
    usePlayerStore.getState().reorderQueue(0, 2); // a 拖到 c 之后，b 前移
    const s = usePlayerStore.getState();
    expect(s.currentUid).toBe(b.uid);
    expect(selectCurrentIndex(s)).toBe(0);
  });
});

describe('removeFromQueue', () => {
  it('删除当前曲之前的条目，当前曲身份不变', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b'), t('c')], 2);
    const c = usePlayerStore.getState().queue[2];
    usePlayerStore.getState().removeFromQueue(0);
    const s = usePlayerStore.getState();
    expect(s.currentUid).toBe(c.uid);
    expect(selectCurrentIndex(s)).toBe(1);
  });

  it('删除当前曲 → currentUid 置空（停止播放）', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b')], 0);
    usePlayerStore.getState().removeFromQueue(0);
    expect(usePlayerStore.getState().currentUid).toBeNull();
    expect(selectCurrentTrack(usePlayerStore.getState())).toBeUndefined();
  });
});

describe('nextTrack / previousTrack', () => {
  it('order 模式顺序前进，到末尾停止', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b')], 0);
    usePlayerStore.getState().nextTrack();
    expect(selectCurrentIndex(usePlayerStore.getState())).toBe(1);
    usePlayerStore.getState().nextTrack();
    const s = usePlayerStore.getState();
    expect(s.playing).toBe(false);
    expect(selectCurrentIndex(s)).toBe(1);
  });

  it('allRepeat 循环', () => {
    usePlayerStore.setState({ playMode: 'allRepeat' });
    usePlayerStore.getState().setQueue([t('a'), t('b')], 1);
    usePlayerStore.getState().nextTrack();
    expect(selectCurrentIndex(usePlayerStore.getState())).toBe(0);
  });

  it('repeatOne 原地不动', () => {
    usePlayerStore.setState({ playMode: 'repeatOne' });
    usePlayerStore.getState().setQueue([t('a'), t('b')], 1);
    usePlayerStore.getState().nextTrack();
    expect(selectCurrentIndex(usePlayerStore.getState())).toBe(1);
  });

  it('队列仅 1 首时 shuffle 不随机', () => {
    usePlayerStore.setState({ playMode: 'shuffle' });
    usePlayerStore.getState().setQueue([t('a')], 0);
    usePlayerStore.getState().nextTrack();
    expect(selectCurrentIndex(usePlayerStore.getState())).toBe(0);
  });

  it('previousTrack 到头回绕到最后一首', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b')], 0);
    usePlayerStore.getState().previousTrack();
    expect(selectCurrentIndex(usePlayerStore.getState())).toBe(1);
  });
});

describe('addToQueue / playFromQueue', () => {
  it('空队列首次入队成为当前曲目', () => {
    usePlayerStore.getState().addToQueue(t('a'));
    const s = usePlayerStore.getState();
    expect(s.currentUid).toBe(s.queue[0].uid);
  });

  it('已有当前曲时入队不改变当前曲目', () => {
    usePlayerStore.getState().setQueue([t('a')], 0);
    const a = usePlayerStore.getState().queue[0];
    usePlayerStore.getState().addToQueue(t('b'));
    expect(usePlayerStore.getState().currentUid).toBe(a.uid);
  });

  it('playFromQueue 点击切曲', () => {
    usePlayerStore.getState().setQueue([t('a'), t('b')], 0);
    const b = usePlayerStore.getState().queue[1];
    usePlayerStore.getState().playFromQueue(b.uid);
    const s = usePlayerStore.getState();
    expect(s.currentUid).toBe(b.uid);
    expect(s.playing).toBe(true);
  });
});
