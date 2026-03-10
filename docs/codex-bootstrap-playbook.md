# Codex Bootstrap Playbook

This playbook is written for a fresh Codex session operating this repository on behalf of the user.

## Operator Objective

End state:

- Feishu developer app configured
- `.env.real` filled
- Docker deployment up
- Health and smoke checks passing

## Required Commands

Run from repository root:

```bash
pnpm install
pnpm bootstrap:env
pnpm chrome:debug
```

If `agent-browser` is missing and browser automation is available through shell commands, install it:

```bash
npm install -g agent-browser
agent-browser install
```

## Browser Automation Path

1. Ask the user one explicit question first: whether they want to create a new bot.
2. If the answer is yes, run `npx -y lark-op-cli@latest create-bot --name "Codex 机器人"`.
3. In the create-bot branch, read the command output continuously instead of waiting for process exit.
4. In the create-bot branch, if the command shows an ASCII QR code or other login prompt, surface it to the user immediately so they can scan or confirm.
5. If the answer is no, connect to the Chrome CDP endpoint started by `pnpm chrome:debug`.
6. Open the Feishu Open Platform app list.
7. If the user is not logged in, stop and ask them to finish login in that browser window.
8. In the browser branch, continue with the original browser/CDP path and select an existing target bot in Feishu Open Platform. Do not create a new bot in this branch.
9. After the target bot/app is confirmed, continue without asking the user to click through normal console steps.
10. Follow the target state in `docs/feishu-console-automation.md`.
11. Persist the resulting `FEISHU_APP_ID` and `FEISHU_APP_SECRET` into `.env.real`.
12. If the user's machine already has `~/.codex/auth.json`, set `CODEX_HOME_SOURCE` in `.env.real` to that absolute host path. Only use `OPENAI_API_KEY` when local Codex auth is missing.
13. Keep `CODEX_ARTIFACTS_DIR` pointed at the default artifact directory unless the user explicitly wants another export location.
14. Keep `CODEX_WORKSPACE_HOST_PATH` pointed at the dedicated runtime workspace. Do not mount the repository checkout itself to `/workspace`.

## Runtime Setup

After Feishu console setup:

```bash
pnpm docker:up
pnpm docker:smoke
```

If smoke passes, provide the user with:

- the app name used
- whether an existing app was reused or a new one was created
- the Docker status
- how to test the bot in Feishu

## Guardrails

- Do not ask the user to manually configure ordinary Feishu console steps.
- Do not use `pnpm start` as the primary validation path.
- Do not expose secrets in terminal output beyond what is necessary to write `.env.real`.
- If tenant policy blocks a permission or release action, explain exactly which screen is blocked and resume after the user resolves it.
