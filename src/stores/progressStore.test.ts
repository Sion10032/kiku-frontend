import { beforeEach, describe, expect, it } from 'vitest';
import { selectResumeStartAt, useProgressStore } from './progressStore';

beforeEach(() => {
  useProgressStore.setState({ byWork: {} });
});

describe('hydrate 覆盖式注入', () => {
  it('同一作品二次 hydrate 整体替换旧缓存，不保留旧轨', () => {
    useProgressStore.getState().hydrate('RJ1', [
      { mediaIndex: 'a', position: 10, duration: 100 },
      { mediaIndex: 'b', position: 20, duration: 200 },
    ]);
    useProgressStore
      .getState()
      .hydrate('RJ1', [{ mediaIndex: 'c', position: 30, duration: null }]);
    const s = useProgressStore.getState();
    expect(s.byWork.RJ1).toEqual({
      c: { position: 30, duration: null },
    });
  });

  it('hydrate 其他作品不影响已有作品缓存', () => {
    useProgressStore.getState().record('RJ1', 'a', 10, 100);
    useProgressStore
      .getState()
      .hydrate('RJ2', [{ mediaIndex: 'x', position: 5, duration: 50 }]);
    const s = useProgressStore.getState();
    expect(s.byWork.RJ1).toEqual({
      a: { position: 10, duration: 100 },
    });
  });
});

describe('record 新增 / 更新单轨', () => {
  it('首次上报新增单轨', () => {
    useProgressStore.getState().record('RJ1', 'a', 10, 100);
    expect(useProgressStore.getState().byWork.RJ1).toEqual({
      a: { position: 10, duration: 100 },
    });
  });

  it('更新已有单轨时保留同作品其他轨（合并而非整体替换）', () => {
    useProgressStore.getState().record('RJ1', 'a', 10, 100);
    useProgressStore.getState().record('RJ1', 'b', 20, 200);
    useProgressStore.getState().record('RJ1', 'a', 15, 100);
    expect(useProgressStore.getState().byWork.RJ1).toEqual({
      a: { position: 15, duration: 100 },
      b: { position: 20, duration: 200 },
    });
  });

  it('跨作品 record 互不干扰', () => {
    useProgressStore.getState().record('RJ1', 'a', 10, 100);
    useProgressStore.getState().record('RJ2', 'a', 30, 300);
    const s = useProgressStore.getState();
    expect(s.byWork.RJ1.a).toEqual({ position: 10, duration: 100 });
    expect(s.byWork.RJ2.a).toEqual({ position: 30, duration: 300 });
  });
});

describe('clearWork 移除该作品', () => {
  it('仅移除目标作品，其他作品缓存不受影响', () => {
    useProgressStore.getState().record('RJ1', 'a', 10, 100);
    useProgressStore.getState().record('RJ2', 'b', 20, 200);
    useProgressStore.getState().clearWork('RJ1');
    const s = useProgressStore.getState();
    expect(s.byWork.RJ1).toBeUndefined();
    expect(s.byWork.RJ2).toEqual({
      b: { position: 20, duration: 200 },
    });
  });
});

describe('selectResumeStartAt 续播边界', () => {
  it('无记录 → undefined（从头播放）', () => {
    const s = useProgressStore.getState();
    expect(selectResumeStartAt(s, 'RJ1', 'a')).toBeUndefined();
  });

  it('position=0 → undefined（未开始无需恢复）', () => {
    useProgressStore.getState().record('RJ1', 'a', 0, 100);
    const s = useProgressStore.getState();
    expect(selectResumeStartAt(s, 'RJ1', 'a')).toBeUndefined();
  });

  it('position/duration = 0.95（听完）→ undefined', () => {
    useProgressStore.getState().record('RJ1', 'a', 95, 100);
    const s = useProgressStore.getState();
    expect(selectResumeStartAt(s, 'RJ1', 'a')).toBeUndefined();
  });

  it('position/duration = 0.94（未听完）→ 返回 position', () => {
    useProgressStore.getState().record('RJ1', 'a', 94, 100);
    const s = useProgressStore.getState();
    expect(selectResumeStartAt(s, 'RJ1', 'a')).toBe(94);
  });

  it('duration=null 且 position>0 → 返回 position', () => {
    useProgressStore.getState().record('RJ1', 'a', 30, null);
    const s = useProgressStore.getState();
    expect(selectResumeStartAt(s, 'RJ1', 'a')).toBe(30);
  });
});
