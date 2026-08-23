import { apiFetch } from './client';
import type { Review, SubmitReviewInput } from '../types';

/** 按作品查询评价：GET /api/review?work_id=:id */
export function getReviewsByWork(workId: string): Promise<Review[]> {
  return apiFetch<Review[]>('review', {
    searchParams: { work_id: workId },
  });
}

/** 按用户查询评价：GET /api/review?username=:name */
export function getReviewsByUser(username: string): Promise<Review[]> {
  return apiFetch<Review[]>('review', {
    searchParams: { username },
  });
}

/** 提交/更新评价：PUT /api/review */
export function submitReview(input: SubmitReviewInput): Promise<Review | null> {
  return apiFetch<Review | null>('review', {
    method: 'PUT',
    json: input,
  });
}

/** 删除评价：DELETE /api/review */
export function deleteReview(workId: string): Promise<{ message: string; }> {
  return apiFetch<{ message: string; }>('review', {
    method: 'DELETE',
    json: { work_id: workId },
  });
}
