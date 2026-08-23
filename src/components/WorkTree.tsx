import { useEffect, useMemo, useRef, useState } from 'react';
import { M3eListOption, M3eSelectionList } from '@m3e/react/list';
import { M3eMenu, M3eMenuItem, type M3eMenuElement } from '@m3e/react/menu';
import { M3eIconButton } from '@m3e/react/icon-button';
import { M3eIcon } from '@m3e/react/icon';
import { M3eCircularProgressIndicator } from '@m3e/react/progress-indicator';
import '@m3e/icons/outlined/folder';
import '@m3e/icons/outlined/music_note';
import '@m3e/icons/outlined/play_arrow';
import '@m3e/icons/outlined/pause';
import '@m3e/icons/outlined/description';
import '@m3e/icons/outlined/image';
import '@m3e/icons/outlined/download';
import '@m3e/icons/outlined/more_vert';
import '@m3e/icons/outlined/queue_music';
import '@m3e/icons/outlined/open_in_new';
import '@m3e/icons/outlined/arrow_back';
import { usePlayerStore } from '../stores/playerStore';
import { downloadUrl, streamUrl } from '../api/media';
import type { TrackFolder, TrackLeaf, TrackNode, Work } from '../types';
import { M3eBreadcrumb, M3eBreadcrumbItem } from '@m3e/react/breadcrumb';
import { useM3eListOptionStyle } from '../hooks/useM3eListOptionStyle';
import { toTrack } from '../utils/track';

interface WorkTreeProps {
  work: Work;
  /** 文件树根数组（/tracks/:id 响应） */
  tree: TrackNode[];
  loading?: boolean;
}

/** ⋮ 菜单状态：目标叶子节点 + 触发菜单的按钮（作为定位锚点）。 */
interface MenuState {
  node: TrackLeaf;
  anchor: HTMLElement;
}

/**
 * 文件树浏览器 + 面包屑导航。
 *
 * - 文件夹：点击进入（面包屑可回退）
 * - 音频：点击 → setQueue 播放当前目录音频；⋮ 菜单：添加到队列、下一首播放、下载
 * - 文本/图片：菜单「打开文件」（新标签页流式打开）；other 类型：下载
 *
 * 播放器（Howler）在步骤 8 实现；此处仅负责写入 playerStore 队列。
 */
export default function WorkTree({ work, tree, loading = false }: WorkTreeProps) {
  // 面包屑路径（文件夹标题数组）
  const [path, setPath] = useState<string[]>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<M3eMenuElement>(null);

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);

  // 单目录作品自动进入根目录（对齐原 kikoeru-quasar 行为）
  useEffect(() => {
    const initial: string[] = [];
    let nodes = tree;
    while (nodes.length === 1 && nodes[0].type === 'folder') {
      initial.push(nodes[0].title);
      nodes = nodes[0].children;
    }
    setPath(initial);
  }, [tree]);

  // 按面包屑路径解析当前目录
  const fatherFolder = useMemo(() => {
    let nodes = tree;
    for (const name of path) {
      const folder = nodes.find(
        (n): n is Extract<TrackNode, { type: 'folder' }> =>
          n.type === 'folder' && n.title === name,
      );
      if (!folder) return tree;
      nodes = folder.children;
    }
    return nodes;
  }, [tree, path]);

  // 当前目录的音频队列（点击播放 / 下一首 / 添加到队列共用）
  const queueTracks = useMemo(
    () =>
      fatherFolder
        .filter((n): n is TrackLeaf => n.type !== 'folder')
        .filter((n) => n.type === 'audio')
        .map((n) => toTrack(work, n)),
    [fatherFolder, work],
  );

  // 当前正在播放的曲目（需属于本作品，避免跨作品同名高亮）
  const currentTrack =
    queue[queueIndex]?.workId === work.id ? queue[queueIndex] : undefined;

  function enterFolder(folder: Extract<TrackNode, { type: 'folder' }>) {
    setPath((prev) => [...prev, folder.title]);
  }

  function playLeaf(leaf: TrackLeaf) {
    const index = queueTracks.findIndex((t) => t.hash === leaf.hash);
    setQueue(queueTracks, index === -1 ? 0 : index);
  }

  function downloadLeaf(leaf: TrackLeaf) {
    const a = document.createElement('a');
    a.href = downloadUrl(work.id, leaf.hash);
    a.download = leaf.hash.split('/').pop() ?? leaf.hash;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openLeaf(leaf: TrackLeaf) {
    window.open(streamUrl(work.id, leaf.hash), '_blank', 'noopener');
  }

  /** 打开菜单：以 ⋮ 按钮为锚点（m3e-menu 自动翻转防溢出）。 */
  function openMenu(leaf: TrackLeaf, anchor: HTMLElement) {
    setMenu({ node: leaf, anchor });
  }

  // 每次 openMenu 都产生新的 menu 对象，确保重复点击同一行的 ⋮ 也会重新 show
  useEffect(() => {
    if (menu) void menuRef.current?.show(menu.anchor);
  }, [menu]);

  function isCurrent(leaf: TrackLeaf): boolean {
    return currentTrack?.hash === leaf.hash;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 面包屑 */}
      <M3eBreadcrumb>
        <M3eBreadcrumbItem onClick={() => setPath([])}>
          ROOT
        </M3eBreadcrumbItem>
        {path.map((name, i) => (
          <M3eBreadcrumbItem
            key={`${name}-${i}`}
            onClick={() => setPath(path.slice(0, i + 1))}>
            {name}
          </M3eBreadcrumbItem>
        ))}
      </M3eBreadcrumb>

      {/* 文件列表 */}
      {loading && (
        <div className="flex justify-center py-12">
          <M3eCircularProgressIndicator />
        </div>
      )}

      {!loading && fatherFolder.length === 0 && (
        <div className="py-16 text-center opacity-60">
          {tree.length === 0 ? '该作品暂无文件' : '目录为空'}
        </div>
      )}

      {!loading && fatherFolder.length > 0 && (
        <M3eSelectionList variant='segmented' hide-selection-indicator>
          {path.length > 0 && <ParentListItem onBack={() => setPath(path.slice(0, -1))} />}
          {fatherFolder.map((node) =>
            node.type === 'folder' ? (
              <TrackFolderListItem
                key={node.title}
                node={node}
                onEnter={() => enterFolder(node)}
              />
            ) : (
              <TrackLeafListItem
                key={node.hash}
                node={node}
                current={isCurrent(node)}
                onPlay={playLeaf}
                onOpenMenu={openMenu}
              />
            ),
          )}
        </M3eSelectionList>
      )}

      {/* 上下文菜单（⋮ 按钮触发；定位 / 翻转 / 关闭均由 m3e-menu 处理） */}
      <M3eMenu ref={menuRef}>
        {menu && menu.node.type === 'audio' && (
          <>
            <M3eMenuItem onClick={() => addToQueue(toTrack(work, menu.node))}>
              <span slot="icon">
                <M3eIcon name="play_arrow" />
              </span>
              添加到队列
            </M3eMenuItem>
            <M3eMenuItem onClick={() => playNext(toTrack(work, menu.node))}>
              <span slot="icon">
                <M3eIcon name="queue_music" />
              </span>
              下一首播放
            </M3eMenuItem>
          </>
        )}
        {menu && (menu.node.type === 'text' || menu.node.type === 'image') && (
          <M3eMenuItem onClick={() => openLeaf(menu.node)}>
            <span slot="icon">
              <M3eIcon name="open_in_new" />
            </span>
            打开文件
          </M3eMenuItem>
        )}
        {menu && (
          <M3eMenuItem onClick={() => downloadLeaf(menu.node)}>
            <span slot="icon">
              <M3eIcon name="download" />
            </span>
            下载文件
          </M3eMenuItem>
        )}
      </M3eMenu>
    </div>
  );
}

/** 返回上一层目录的行（子目录顶部显示 ".."）。 */
function ParentListItem({ onBack }: { onBack: () => void }) {
  const ref = useM3eListOptionStyle({
    style: {
      '.content': {
        flex: '1 !important',
      },
    },
  });

  return (
    <M3eListOption ref={ref} onClick={onBack}>
      <span slot="leading" className="me-3">
        <M3eIcon name="arrow_back" />
      </span>
      <span className="min-w-0 flex-1 truncate">..</span>
    </M3eListOption>
  );
}

/** 文件夹行：folder 图标 + 标题 + 子项数。 */
function TrackFolderListItem({ node, onEnter }: { node: TrackFolder; onEnter: () => void }) {
  const ref = useM3eListOptionStyle({
    style: {
      '.content': {
        flex: '1 !important',
      },
    },
  });

  return (
    <M3eListOption ref={ref} onClick={onEnter}>
      <span slot="leading" className="me-3">
        <M3eIcon name="folder" />
      </span>
      <span className="min-w-0 flex-1 truncate">{node.title}</span>
      <span
        slot="supporting-text"
        className="truncate text-xs opacity-60"
      >
        {node.children.length} 个项目
      </span>
    </M3eListOption>
  );
}

interface TrackLeafListItemProps {
  node: TrackLeaf;
  /** 是否为当前播放曲目（高亮显示）。 */
  current: boolean;
  onPlay: (node: TrackLeaf) => void;
  onOpenMenu: (node: TrackLeaf, anchor: HTMLElement) => void;
}

/** 叶子文件行：类型图标 + 标题 + 播放/暂停 + ⋮ 更多操作。 */
function TrackLeafListItem({
  node,
  current,
  onPlay,
  onOpenMenu,
}: TrackLeafListItemProps) {
  const ref = useM3eListOptionStyle({
    style: {
      '.content': {
        flex: '1 !important',
      },
    },
  });

  return (
    <M3eListOption
      ref={ref}
      onClick={() => node.type === 'audio' && onPlay(node)}
      selected={current}
    >
      <span slot="leading" className="me-3">
        <M3eIcon name={leafIcon(node.type)} />
      </span>
      <span className="min-w-0 flex-1 truncate">{node.title}</span>
      <span slot="trailing" className="flex items-center gap-1">
        <M3eIconButton
          aria-label="更多操作"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(node, e.currentTarget as HTMLElement);
          }}
        >
          <M3eIcon name="more_vert" />
        </M3eIconButton>
      </span>
    </M3eListOption>
  );
}

function leafIcon(type: TrackLeaf['type']): string {
  switch (type) {
    case 'audio':
      return 'music_note';
    case 'image':
      return 'image';
    default:
      return 'description';
  }
}
