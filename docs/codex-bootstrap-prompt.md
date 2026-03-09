# Codex Bootstrap Prompt

Copy this prompt into Codex after opening or cloning the repository:

```text
严格按 README.md、AGENTS.md、docs/codex-bootstrap-playbook.md、docs/feishu-console-automation.md 执行，不要把普通控制台配置步骤推回给我。先运行 pnpm install、pnpm bootstrap:env、pnpm chrome:debug；如果我没登录飞书开放平台或 OpenAI/Codex，再停下来让我登录。登录完成后，使用 Chrome CDP 自动配置飞书开发者平台，拿到 FEISHU_APP_ID 和 FEISHU_APP_SECRET 后写回 .env.real，然后用 Docker 启动并验证服务，最后告诉我怎么在飞书里测试。
```
