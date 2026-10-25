// @vitest-environment jsdom
import { Children, type ReactElement, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  EQ_CUSTOM_PRESET_LIMIT,
  defaultQs,
  flatGains,
  type EqualizerPreset,
} from '../../utils/equalizer';
import EqualizerDialog from './EqualizerDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// @m3e/web 组件在 jsdom 无法注册 custom elements，mock 成轻量转发组件（同
// MetadataEditDialog.test 约定）；只保留被测逻辑依赖的行为。
vi.mock('@m3e/react/dialog', () => ({
  M3eDialog: (props: { open?: boolean; children?: ReactNode }) =>
    props.open ? <div>{props.children}</div> : null,
}));

vi.mock('@m3e/react/form-field', () => ({
  M3eFormField: (props: { children?: ReactNode }) => (
    <div>{props.children}</div>
  ),
}));

vi.mock('@m3e/react/button', () => ({
  M3eButton: (props: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button
      type='button'
      aria-label={props['aria-label']}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  ),
}));

// 下拉：把 M3eOption 子元素摊成原生 option，value 由选中项推导（M3eOption
// 的 selected 只反映受控选中态，jsdom 里没有 select 的 value 语义）
vi.mock('@m3e/react/select', () => ({
  M3eSelect: (props: {
    id?: string;
    children?: ReactNode;
    disabled?: boolean;
    onChange?: (e: { target: { value: string } }) => void;
  }) => {
    const options = Children.toArray(props.children) as ReactElement<{
      value?: string;
      selected?: boolean;
    }>[];
    const value = options.find((o) => o.props.selected)?.props.value ?? '';
    return (
      <select
        id={props.id}
        data-testid='eq-preset-select'
        disabled={props.disabled}
        value={value}
        onChange={(e) =>
          props.onChange?.({ target: { value: e.target.value } })
        }
      >
        {props.children}
      </select>
    );
  },
}));

vi.mock('@m3e/react/option', () => ({
  M3eOption: (props: {
    children?: ReactNode;
    value?: string;
    disabled?: boolean;
  }) => (
    <option value={props.value} disabled={props.disabled}>
      {props.children}
    </option>
  ),
}));

// 滑条：竖排滑条在这里只剩「按 band 分发的 onChange + disabled + thumb 值」
vi.mock('@m3e/react/slider', () => ({
  M3eSlider: (props: {
    children?: ReactNode;
    id?: string;
    orientation?: string;
    disabled?: boolean;
    onInput?: (e: { target: { value: number } }) => void;
  }) => {
    const band = (props.id ?? '').replace('eq-band-', '');
    return (
      <div
        data-testid={`eq-slider-${band}`}
        data-orientation={props.orientation}
      >
        <input
          type='text'
          aria-label={`eq-band-${band}`}
          disabled={props.disabled}
          onChange={(e) =>
            props.onInput?.({ target: { value: Number(e.target.value) } })
          }
        />
        {props.children}
      </div>
    );
  },
  M3eSliderThumb: (props: { value?: number }) => (
    <span data-testid='eq-thumb' data-value={props.value} />
  ),
}));

vi.mock('@m3e/react/switch', () => ({
  M3eSwitch: (props: {
    checked?: boolean;
    disabled?: boolean;
    onInput?: (e: { target: { checked: boolean } }) => void;
  }) => (
    <input
      type='checkbox'
      role='switch'
      data-testid='eq-enabled'
      checked={props.checked ?? false}
      disabled={props.disabled}
      // 受控 checkbox 必须挂 onChange，否则 React 会把点击后的 checked 回滚；
      // 真实 m3e-switch 同时派发 input/change，这里统一映射到 onInput
      onChange={(e) =>
        props.onInput?.({ target: { checked: e.target.checked } })
      }
    />
  ),
}));

const initialStore = useSettingsStore.getState();

afterEach(() => {
  cleanup();
  useSettingsStore.setState(initialStore, true);
});

/** 造一个自定义 preset（缺省全平 / 默认 Q）。 */
function preset(
  id: string,
  name: string,
  gains: number[] = flatGains(),
  qs: number[] = defaultQs(),
): EqualizerPreset {
  return { id, name, gains, qs };
}

/**
 * 播种均衡器状态。eqCurrent 与 activeId 一致：测试只关心渲染侧，
 * 不重复验证 store 的 preset→运行态推导逻辑。
 */
function seed({
  enabled = true,
  activeId = 'flat',
  customPresets = [] as EqualizerPreset[],
  gains,
  qs,
}: {
  enabled?: boolean;
  activeId?: string;
  customPresets?: EqualizerPreset[];
  gains?: number[];
  qs?: number[];
} = {}) {
  const active = customPresets.find((p) => p.id === activeId);
  useSettingsStore.setState({
    equalizer: { enabled, activeId, customPresets },
    eqCurrent: {
      gains: gains ?? (active ? [...active.gains] : flatGains()),
      qs: qs ?? (active ? [...active.qs] : defaultQs()),
    },
  });
}

/** 全部滑条 thumb 的 value 快照（按频段顺序）。 */
function thumbValues(): string[] {
  return screen
    .getAllByTestId('eq-thumb')
    .map((el) => el.getAttribute('data-value') ?? '');
}

const select = () =>
  screen.getByTestId('eq-preset-select') as HTMLSelectElement;

describe('渲染', () => {
  it('显示标题，默认选中 flat，10 段滑条 + 8 个 Q 输入', () => {
    seed();
    render(<EqualizerDialog open onClose={() => {}} />);

    expect(screen.getByText('player.eq-title')).not.toBeNull();
    expect(select().value).toBe('flat');
    expect(screen.getAllByTestId('eq-thumb')).toHaveLength(10);
    expect(thumbValues()).toEqual([
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
    ]);
    // 首尾走 shelf（恒默认 Q），不给输入框
    expect(screen.getAllByRole('spinbutton')).toHaveLength(8);
    expect(screen.queryByLabelText('Q 31')).toBeNull();
    expect(screen.queryByLabelText('Q 16k')).toBeNull();
  });

  it('dB 值格式：正值带 +、负值带 -、负零归 0.0', () => {
    seed({
      gains: [-0, 4.5, -4.5, 0, 0, 0, 0, 0, 0, 0],
    });
    render(<EqualizerDialog open onClose={() => {}} />);

    expect(screen.getAllByText('+4.5')).toHaveLength(1);
    expect(screen.getAllByText('-4.5')).toHaveLength(1);
    expect(screen.queryByText('-0.0')).toBeNull();
    expect(screen.getAllByText('0.0')).toHaveLength(8);
  });

  it('内置与自定义分组：有自定义项时插入不可选的分隔项', () => {
    seed({ customPresets: [preset('c1', '我的预置')] });
    render(<EqualizerDialog open onClose={() => {}} />);

    const options = [...select().querySelectorAll('option')];
    const dividers = options.filter((o) => o.disabled);
    expect(dividers.map((o) => o.textContent)).toEqual([
      expect.stringContaining('player.eq-group-builtin'),
      expect.stringContaining('player.eq-group-custom'),
    ]);
    expect(options.map((o) => o.value)).toContain('c1');
  });
});

describe('预置选择', () => {
  it('选择自定义项后滑条与 dB 文本反映其 gains', () => {
    seed({
      customPresets: [
        preset('c1', '我的预置', [1, 2, 3, 4, 5, 6, 7, 8, 9, -2]),
      ],
    });
    render(<EqualizerDialog open onClose={() => {}} />);

    fireEvent.change(select(), { target: { value: 'c1' } });

    expect(useSettingsStore.getState().equalizer.activeId).toBe('c1');
    expect(useSettingsStore.getState().eqCurrent.gains).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, -2,
    ]);
    expect(thumbValues()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '-2',
    ]);
    expect(screen.getAllByText('+9.0')).toHaveLength(1);
    expect(screen.getAllByText('-2.0')).toHaveLength(1);
    expect(select().value).toBe('c1');
  });
});

describe('滑条拖动', () => {
  it('选中内置项：只改运行态，不写回自定义项', () => {
    seed({ customPresets: [preset('c1', '我的预置')] });
    render(<EqualizerDialog open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('eq-band-4'), {
      target: { value: '5' },
    });

    const state = useSettingsStore.getState();
    expect(state.eqCurrent.gains[4]).toBe(5);
    expect(state.equalizer.customPresets[0].gains[4]).toBe(0);
    expect(thumbValues()[4]).toBe('5');
    expect(screen.getAllByText('+5.0')).toHaveLength(1);
  });

  it('选中自定义项：运行态与持久化副本同时更新', () => {
    seed({
      activeId: 'c1',
      customPresets: [preset('c1', '我的预置')],
    });
    render(<EqualizerDialog open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('eq-band-6'), {
      target: { value: '-3.5' },
    });

    const state = useSettingsStore.getState();
    expect(state.eqCurrent.gains[6]).toBe(-3.5);
    expect(state.equalizer.customPresets[0].gains[6]).toBe(-3.5);
    expect(thumbValues()[6]).toBe('-3.5');
  });
});

describe('Q 输入', () => {
  it('失焦越界值被 clamp 到 8 并写入 store', () => {
    seed({ activeId: 'c1', customPresets: [preset('c1', '我的预置')] });
    render(<EqualizerDialog open onClose={() => {}} />);

    const input = screen.getByLabelText('Q 250') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8.5' } });
    fireEvent.blur(input);

    expect(useSettingsStore.getState().eqCurrent.qs[3]).toBe(8);
    expect(input.value).toBe('8');
  });

  it('非法输入回落原值，不写入 store', () => {
    seed({ activeId: 'c1', customPresets: [preset('c1', '我的预置')] });
    render(<EqualizerDialog open onClose={() => {}} />);

    const input = screen.getByLabelText('Q 1k') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(useSettingsStore.getState().eqCurrent.qs[5]).toBe(1.4);
    expect(input.value).toBe('1.4');
  });
});

describe('删除预置', () => {
  it('内置项选中时删除按钮禁用；选中自定义项可删除并回落 flat', () => {
    seed({ customPresets: [preset('c1', '我的预置')] });
    render(<EqualizerDialog open onClose={() => {}} />);

    const del = screen.getByRole('button', {
      name: 'player.eq-delete',
    }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);

    fireEvent.change(select(), { target: { value: 'c1' } });
    expect(del.disabled).toBe(false);

    fireEvent.click(del);
    const state = useSettingsStore.getState();
    expect(state.equalizer.customPresets).toEqual([]);
    expect(state.equalizer.activeId).toBe('flat');
  });
});

describe('新增预置', () => {
  it('达到上限时新增按钮禁用并显示上限提示', () => {
    seed({
      customPresets: Array.from({ length: EQ_CUSTOM_PRESET_LIMIT }, (_, i) =>
        preset(`c${i}`, `预置 ${i}`),
      ),
    });
    render(<EqualizerDialog open onClose={() => {}} />);

    expect(
      (
        screen.getByRole('button', {
          name: 'player.eq-add',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText('player.eq-limit')).not.toBeNull();
  });

  it('输入名称保存后新增一套并切换到该项', () => {
    seed();
    render(<EqualizerDialog open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'player.eq-add' }));
    const nameInput = screen.getByLabelText(
      'player.eq-name-label',
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '我的预置' } });
    fireEvent.click(screen.getByRole('button', { name: 'player.eq-save' }));

    const state = useSettingsStore.getState();
    expect(state.equalizer.customPresets).toHaveLength(1);
    expect(state.equalizer.customPresets[0].name).toBe('我的预置');
    expect(state.equalizer.activeId).toBe(state.equalizer.customPresets[0].id);
    // 保存后命名对话框关闭
    expect(screen.queryByLabelText('player.eq-name-label')).toBeNull();
  });

  it('名称为空时保存按钮禁用', () => {
    seed();
    render(<EqualizerDialog open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'player.eq-add' }));
    expect(
      (
        screen.getByRole('button', {
          name: 'player.eq-save',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe('总开关', () => {
  it('关闭时面板控件禁用（开关自身仍可用），开启后恢复', () => {
    seed({ enabled: false });
    render(<EqualizerDialog open onClose={() => {}} />);

    const toggle = screen.getByTestId('eq-enabled') as HTMLInputElement;
    expect(select().disabled).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'player.eq-add',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText('eq-band-0') as HTMLInputElement).disabled,
    ).toBe(true);
    expect((screen.getByLabelText('Q 62') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(toggle.disabled).toBe(false);

    fireEvent.click(toggle);

    expect(useSettingsStore.getState().equalizer.enabled).toBe(true);
    expect(select().disabled).toBe(false);
    expect((screen.getByLabelText('Q 62') as HTMLInputElement).disabled).toBe(
      false,
    );
  });
});
