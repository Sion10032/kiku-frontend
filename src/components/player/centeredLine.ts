/**
 * 计算距滚动容器视口中心最近的行号（歌词面板"中心行"判定）。
 *
 * @param centers 每行中心的内容坐标（offsetTop + offsetHeight / 2）
 * @param scrollTop 容器当前滚动位置
 * @param viewportHeight 容器视口高度（clientHeight）
 * @returns 行号；空列表返回 -1，距离并列时取靠前的行
 */
export function findCenteredLine(
  centers: number[],
  scrollTop: number,
  viewportHeight: number,
): number {
  const target = scrollTop + viewportHeight / 2;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const dist = Math.abs(centers[i] - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
