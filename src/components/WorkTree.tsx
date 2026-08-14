import { Fragment, useEffect, useMemo, useState } from 'react';
import { M3eList, M3eListItem } from '@m3e/react/list';
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
import { usePlayerStore, type Track } from '../stores/playerStore';
import { downloadUrl, streamUrl } from '../api/media';
import type { TrackLeaf, TrackNode, Work } from '../types';

interface WorkTreeProps {
  work: Work;
  /** 文件树根数组（/tracks/:id 响应） */
  tree: TrackNode[];
  loading?: boolean;
}

/** 右键/更多菜单项。 */
interface MenuState {
  node: TrackLeaf;
  x: number;
  y: number;
}

/**
 * 文件树浏览器 + 面包屑导航。
 *
 * - 文件夹：点击进入（面包屑可回退）
 * - 音频：点击 → setQueue 播放当前目录音频；右键/⋮ 菜单：添加到队列、下一首播放、下载
 * - 文本/图片：菜单「打开文件」（新标签页流式打开）；other 类型：下载
 *
 * 播放器（Howler）在步骤 8 实现；此处仅负责写入 playerStore 队列。
 */
export default function WorkTree({ work, tree, loading = false }: WorkTreeProps) {
  // 面包屑路径（文件夹标题数组）
  const [path, setPath] = useState<string[]>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playing = usePlayerStore((s) => s.playing);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const togglePlaying = usePlayerStore((s) => s.togglePlaying);

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

  function toggleCurrent() {
    togglePlaying();
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

  /** 打开菜单：右键以光标定位，⋮ 按钮以按钮左下角定位。 */
  function openMenu(leaf: TrackLeaf, e: { clientX: number; clientY: number }) {
    setMenu({
      node: leaf,
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 140),
    });
  }

  function isCurrent(leaf: TrackLeaf): boolean {
    return currentTrack?.hash === leaf.hash;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 面包屑 */}
      <nav className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setPath([])}
          className={crumbClass(path.length === 0)}
        >
          ROOT
        </button>
        {path.map((name, i) => (
          <Fragment key={`${name}-${i}`}>
            <span className="opacity-40">/</span>
            <button
              type="button"
              onClick={() => setPath(path.slice(0, i + 1))}
              className={crumbClass(i === path.length - 1)}
            >
              {name}
            </button>
          </Fragment>
        ))}
      </nav>

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
        <M3eList>
          {fatherFolder.map((node) =>
            node.type === 'folder' ? (
              <M3eListItem key={node.title} onClick={() => enterFolder(node)}>
                <span slot="leading" className="me-3">
                  <M3eIcon name="folder" />
                </span>
                <span className="min-w-0 flex-1 truncate">{node.title}</span>
                <span
                  slot="supporting-text"
                  className="text-xs opacity-60"
                >
                  {node.children.length} 个项目
                </span>
              </M3eListItem>
            ) : (
              <M3eListItem
                key={node.hash}
                onClick={() => node.type === 'audio' && playLeaf(node)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openMenu(node, e);
                }}
                className={
                  isCurrent(node) ? 'bg-[var(--md-sys-color-primary-container)]' : ''
                }
              >
                <span slot="leading" className="me-3">
                  <M3eIcon name={leafIcon(node.type)} />
                </span>
                <span className="min-w-0 flex-1 truncate">{node.title}</span>
                <span slot="trailing" className="flex items-center gap-1">
                  {node.type === 'audio' && (
                    <M3eIconButton
                      aria-label={isCurrent(node) ? '暂停' : '播放'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrent(node)) toggleCurrent();
                        else playLeaf(node);
                      }}
                    >
                      <M3eIcon
                        name={
                          isCurrent(node) && playing ? 'pause' : 'play_arrow'
                        }
                      />
                    </M3eIconButton>
                  )}
                  <M3eIconButton
                    aria-label="更多操作"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      openMenu(node, {
                        clientX: rect.left,
                        clientY: rect.bottom,
                      });
                    }}
                  >
                    <M3eIcon name="more_vert" />
                  </M3eIconButton>
                </span>
              </M3eListItem>
            ),
          )}
        </M3eList>
      )}

      {/* 上下文菜单（右键 / ⋮ 按钮触发） */}
      {menu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(null);
          }}
        >
          <div
            className="absolute flex min-w-36 flex-col rounded-md border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] py-1 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {menu.node.type === 'audio' && (
              <>
                <MenuButton
                  icon="play_arrow"
                  label="添加到队列"
                  onClick={() => {
                    addToQueue(toTrack(work, menu.node));
                    setMenu(null);
                  }}
                />
                <MenuButton
                  icon="queue_music"
                  label="下一首播放"
                  onClick={() => {
                    playNext(toTrack(work, menu.node));
                    setMenu(null);
                  }}
                />
              </>
            )}
            {(menu.node.type === 'text' || menu.node.type === 'image') && (
              <MenuButton
                icon="open_in_new"
                label="打开文件"
                onClick={() => {
                  openLeaf(menu.node);
                  setMenu(null);
                }}
              />
            )}
            <MenuButton
              icon="download"
              label="下载文件"
              onClick={() => {
                downloadLeaf(menu.node);
                setMenu(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** 由叶子节点构造播放队列项（hash = media index，供 stream/download）。 */
function toTrack(work: Work, leaf: TrackLeaf): Track {
  return {
    hash: leaf.hash,
    title: leaf.title,
    workTitle: work.title,
    workId: work.id,
    mediaStreamUrl: streamUrl(work.id, leaf.hash),
    mediaDownloadUrl: downloadUrl(work.id, leaf.hash),
  };
}

/** 面包屑按钮样式。 */
function crumbClass(active: boolean): string {
  return [
    'rounded-full px-2 py-1 text-sm no-underline',
    active
      ? 'text-[var(--md-sys-color-primary)]'
      : 'opacity-70 hover:opacity-100',
  ].join(' ');
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

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-start text-sm hover:bg-[var(--md-sys-color-surface-container-high)]"
    >
      <M3eIcon name={icon} />
      {label}
    </button>
  );
}
