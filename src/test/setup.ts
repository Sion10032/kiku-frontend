// vitest setupFiles 入口：为 node 环境注入内存 localStorage。
// stub 自带幂等 guard，与测试文件内的手动导入并存也不会重复注册。
import './localStorageStub';
