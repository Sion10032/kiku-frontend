import { useRef } from 'react';
import type { SwipeGestureDetail } from '@m3e/react/gestures';
import { usePlayerStore } from '../stores/playerStore';

/**
 * 滑动切换全屏播放器的共享逻辑：封面下滑收起（AudioPlayer）、
 * 迷你条信息区上滑展开（PlayerBar）。搭配 non-visual 的
 * M3eSwipeGesture 使用（directions 限定单方向）。
 *
 * 热区需加 touch-none：否则浏览器把触摸滑动当页面滚动，启动时派发
 * pointercancel 打断识别并触发下拉刷新（m3e 手势不自动设置 touch-action）。
 */
export function useSwipeHide(direction: 'down' | 'up') {
  const toggleHide = usePlayerStore((s) => s.toggleHide);
  const swipeActiveRef = useRef(false);

  /** M3eSwipeGesture 的 gesture 回调：end 且方向匹配时 toggleHide。 */
  function handleGesture(e: CustomEvent<SwipeGestureDetail>) {
    const { phase, direction: dir } = e.detail;
    if (phase === 'start') {
      swipeActiveRef.current = true;
    } else if (phase === 'end') {
      // 吞掉随后浏览器派发的 click 再复位（click 与 pointerup 同一
      // 事件循环，先于 0ms 定时器）；立即复位会让抑制失效，残留置位
      // 则会误吞下一次点按
      setTimeout(() => {
        swipeActiveRef.current = false;
      }, 0);
      if (dir === direction) toggleHide();
    } else {
      // cancel：识别中断，复位以便后续 click 正常
      swipeActiveRef.current = false;
    }
  }

  /** 包装 onClick：吞掉 swipe 释放后的尾随 click 一次（防 toggleHide
   *  被抵消 / 误触热区点击行为）。 */
  function swallowSwipeClick(action: () => void) {
    return () => {
      if (swipeActiveRef.current) {
        swipeActiveRef.current = false;
        return;
      }
      action();
    };
  }

  return { handleGesture, swallowSwipeClick };
}
