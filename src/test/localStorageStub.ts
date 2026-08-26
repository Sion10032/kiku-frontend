// node 测试环境（vitest environment: 'node'）没有 localStorage，这里提供内存实现。
// 属副作用模块：必须在使用 localStorage 的模块（如 zustand persist store）之前导入，
// 这样 persist 在 store 创建时才能成功绑定存储而不是退化为内存模式。

if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map<string, string>();
  globalThis.localStorage = {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: key => (mem.has(key) ? mem.get(key)! : null),
    key: index => Array.from(mem.keys())[index] ?? null,
    removeItem: key => void mem.delete(key),
    setItem: (key, value) => void mem.set(key, String(value)),
  };
}

export {};
