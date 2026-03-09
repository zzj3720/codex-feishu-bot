# Contributing

## 开发原则

- 运行时验证优先走 Docker，不要把 `pnpm start` 当成主验证路径
- 改动前先看 `README.md` 和 `AGENTS.md`
- 和飞书、Codex 协议相关的改动，优先补测试再改实现

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## 提交前检查

```bash
pnpm test
pnpm typecheck
pnpm build
```

如果改动涉及真实部署链路，再额外跑：

```bash
pnpm bootstrap:env
pnpm chrome:debug
pnpm docker:real:smoke
```

## Pull Request 说明

请在 PR 描述里写清楚：

- 改动动机
- 用户可见行为变化
- 测试范围
- 是否影响 Feishu 控制台自动化路径
