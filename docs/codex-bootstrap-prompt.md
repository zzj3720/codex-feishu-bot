# Codex Bootstrap Prompt

Copy this prompt into Codex after opening or cloning the repository:

```text
严格按 README.md、AGENTS.md、docs/codex-bootstrap-playbook.md、docs/feishu-console-automation.md 执行。优先走 Docker，不要把普通控制台配置步骤推回给我。先运行 pnpm install、pnpm bootstrap:env、pnpm chrome:debug；如果我没登录飞书开放平台或 OpenAI/Codex，再停下来让我登录。登录完成后，不要先通过浏览器手动创建或挑选机器人，直接异步执行 `npx -y lark-op-cli@latest create-bot --name "Codex 机器人"` 并持续读取输出；如果脚本输出表明已有可复用的机器人或应用，就直接沿用该结果继续后续配置；如果过程中出现扫码登录，请把 ASCII 二维码原样转发给我。拿到 FEISHU_APP_ID 和 FEISHU_APP_SECRET 后写回 .env.real，然后用 Docker 启动并验证服务，最后告诉我怎么在飞书里测试。
```
