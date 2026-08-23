import { useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getToken } from '../api/token';

/**
 * 订阅 SSE 事件流。
 *
 * - 用 ref 持有最新回调，避免 onEvent 变化触发重订阅。
 * - AbortController 在卸载时关闭连接。
 * - @microsoft/fetch-event-source 基于 Fetch，可在请求头携带 JWT。
 *
 * @param url     端点路径（如 /api/scanner/events）
 * @param onEvent 收到事件回调：(event: string, data: unknown)
 * @param deps    额外依赖（默认不传，仅 url 变化重连）
 */
export function useSSE(
  url: string,
  onEvent: (event: string, data: unknown) => void,
  deps?: readonly unknown[],
) {
  const cbRef = useRef(onEvent);

  // 每次渲染后同步最新回调，避免 onEvent 变化触发重订阅
  useEffect(() => {
    cbRef.current = onEvent;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    const token = getToken();

    fetchEventSource(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: ctrl.signal,
      async onopen(res) {
        if (!res.ok) throw new Error(`SSE ${res.status}`);
      },
      onmessage(ev) {
        let data: unknown = ev.data;
        try {
          data = JSON.parse(ev.data);
        }
        catch {
          /* 非 JSON 原样返回 */
        }
        cbRef.current(ev.event, data);
      },
      onerror(err) {
        console.error('SSE error', err);
        // 不抛出 → fetch-event-source 自动重连；抛出则停止重连
      },
    });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ url, ...(deps ?? []) ]);
}
