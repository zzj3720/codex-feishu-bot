# Codex Bootstrap Prompt

Copy this prompt into Codex after opening or cloning the repository:

```text
严格按 README.md、AGENTS.md、docs/codex-bootstrap-playbook.md、docs/feishu-console-automation.md 执行，不要把普通控制台配置步骤推回给我。先运行 pnpm install、pnpm bootstrap:env、pnpm chrome:debug。然后先明确问我一个问题：是否要创建新的机器人。如果我回答“要”，就异步执行 `npx -y lark-op-cli@latest create-bot --name "Codex 机器人"` 并持续读取输出；如果过程中出现扫码登录，请把 ASCII 二维码原样转发给我。如果我回答“不要”，再确认我是否已经登录飞书开放平台或 OpenAI/Codex；如果我没登录，再停下来让我登录。登录完成后，就继续走原来的浏览器和 agent-browser / Chrome CDP 方案，只选择已有机器人并完成后续配置，不要再创建新的机器人。拿到 FEISHU_APP_ID 和 FEISHU_APP_SECRET 后写回 .env.real，然后用 Docker 启动并验证服务，最后告诉我怎么在飞书里测试。
```
