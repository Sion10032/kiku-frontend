import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/review';
import type { SubmitReviewInput } from '../types';

/**
 * 提交/更新评价（PUT /api/review）。
 *
 * 成功后失效相关查询（invalidateQueries 按 queryKey 前缀匹配）：
 * - ['works', ...]：作品列表（userRating 影响 rating 排序与展示）
 * - ['work', id]：作品详情（我的评价入口 / userRating）
 * - ['reviews', ...]：我的评价（收藏页 / 写评价对话框回显）
 */
export function useReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitReviewInput) => api.submitReview(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

/** 删除评价（DELETE /api/review），失效范围与提交一致。 */
export function useDeleteReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: number) => api.deleteReview(workId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['work'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}
