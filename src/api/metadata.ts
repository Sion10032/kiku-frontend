import type {
  MetadataField,
  MetadataOverrideDetail,
  SaveMetadataOverrideInput,
} from '../types';
import { apiFetch } from './client';

/** 编辑回显：原始值 + 覆盖状态 + 生效值。 */
export function getMetadataOverride(
  workId: string,
): Promise<MetadataOverrideDetail> {
  return apiFetch<MetadataOverrideDetail>(`work/${workId}/metadata/override`);
}

/** 保存覆盖：标量为最终值；tags/vas 为相对载入时生效值的动作列表。 */
export function saveMetadataOverride(
  workId: string,
  input: SaveMetadataOverrideInput,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`work/${workId}/metadata`, {
    method: 'PATCH',
    json: input,
  });
}

/** 单字段恢复原始（field ∈ title/circle/series/ageRating/tags/vas）。 */
export function resetMetadataField(
  workId: string,
  field: MetadataField,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`work/${workId}/metadata/${field}`, {
    method: 'DELETE',
  });
}
