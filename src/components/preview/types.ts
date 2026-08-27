import type { ComponentType } from 'react';
import type { TrackLeaf } from '../../types';

/** 预览目标（WorkTree 从 TrackLeaf + Work 派生）。 */
export interface PreviewFile {
  workId: string;
  /** media index（文件相对路径），streamUrl/downloadUrl 共用 */
  hash: string;
  /** 显示名（含扩展名） */
  title: string;
  /** 小写扩展名（无点）；无扩展名为空串（`.hidden` 视为无扩展名） */
  ext: string;
  /** 文件树节点类型（后端分类可宽于扩展名表，作辅助匹配） */
  leafType: TrackLeaf['type'];
}

/** 所有预览器组件的统一 props（保持最小集合，未来格式零改动接入）。 */
export interface PreviewerProps {
  file: PreviewFile;
}

/**
 * 预览器注册项。
 * 新增格式 = 新组件文件 + registry 数组加一行，不改壳与 WorkTree。
 */
export interface PreviewerDefinition {
  /** 注册表内唯一 id（调试用） */
  id: string;
  /** 能否预览该文件（按扩展名 / leafType 判断） */
  matches: (file: PreviewFile) => boolean;
  /** 预览器组件（自行 fetch streamUrl，自行处理加载/错误态） */
  component: ComponentType<PreviewerProps>;
}

/** 从 TrackLeaf 派生预览目标；ext 取自 hash 的最后一段文件名。 */
export function toPreviewFile(workId: string, leaf: TrackLeaf): PreviewFile {
  const name = leaf.hash.split('/').pop() ?? leaf.hash;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return {
    workId,
    hash: leaf.hash,
    title: leaf.title,
    ext,
    leafType: leaf.type,
  };
}
