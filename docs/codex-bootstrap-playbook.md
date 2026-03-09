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

1. Connect to the Chrome CDP endpoint started by `pnpm chrome:debug`.
2. Open the Feishu Open Platform app list.
3. If the user is not logged in, stop and ask them to finish login in that browser window.
4. Check whether there is already a Feishu app/bot that is clearly the intended target for this setup.
5. Reuse the existing app if it is clearly the right one; otherwise run `npx -y lark-op-cli@latest create-bot` to create a new bot.
6. If `create-bot` is running, read the command output continuously instead of waiting for process exit.
7. If the command shows an ASCII QR code or other login prompt, surface it to the user immediately so they can scan or confirm.
8. After the target bot/app is confirmed, continue without asking the user to click through normal console steps.
9. Follow the target state in `docs/feishu-console-automation.md`.
10. Persist the resulting `FEISHU_APP_ID` and `FEISHU_APP_SECRET` into `.env.real`.
11. If the user's machine already has `~/.codex/auth.json`, set `CODEX_HOME_SOURCE` in `.env.real` to that absolute host path. Only use `OPENAI_API_KEY` when local Codex auth is missing.
12. Keep `CODEX_ARTIFACTS_DIR` pointed at the default artifact directory unless the user explicitly wants another export location.
13. Keep `CODEX_WORKSPACE_HOST_PATH` pointed at the dedicated runtime workspace. Do not mount the repository checkout itself to `/workspace`.

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
