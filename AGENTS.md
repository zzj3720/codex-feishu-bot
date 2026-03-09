# AGENTS.md

This repository is designed for a Codex-operated bootstrap flow.

## Primary Goal

Set up and deploy a Feishu bot backed by `codex app-server` with as little manual work as possible. The intended operator is another Codex session running on the user's machine.

Prompt-scoped exception:

- If the user's prompt explicitly says not to open a browser and to only run `npx -y lark-op-cli@latest create-bot`, obey that narrower scope and stop after reporting the command result.

## Required Execution Order

1. Read `README.md`.
2. Read `docs/codex-bootstrap-playbook.md`.
3. Read `docs/feishu-console-automation.md`.
4. Run `pnpm install`.
5. Run `pnpm bootstrap:env`.
6. Run `pnpm chrome:debug`.
7. Use browser automation through Chrome CDP to configure Feishu Open Platform.
8. Persist discovered values into `.env.real`.
9. Start Docker deployment with `pnpm docker:up`.
10. Verify with `pnpm docker:smoke`.

## Browser Automation Rules

- Prefer Chrome DevTools Protocol automation over telling the user to click around manually.
- If `agent-browser` is available, prefer it. Otherwise use any browser/CDP capability available in Codex.
- After login is complete, create a new Feishu enterprise self-built app/bot for this setup flow. Do not switch to reusing an older app unless the user explicitly asks for that.
- Drive the UI by visible labels and user goals, not brittle CSS selectors.

## What Still Requires the User

- Logging into Feishu Open Platform in the browser.
- Logging into OpenAI/Codex if the local `~/.codex` state is missing.
- Approving tenant-admin prompts if the organization requires them.

Only stop for those checkpoints. Do not push routine console clicking back onto the user.

## Deployment Rules

- Use the Docker path for setup and validation. Do not default to `pnpm start`.
- Use the single-container Docker path. Do not reintroduce a `codex-app-server` sidecar deployment mode.
- Keep runtime secrets in `.env.real`.
- Keep Codex runtime work under the mounted `/workspace` only. Do not treat the repository checkout as the runtime workspace.
- Prefer `CODEX_HOME_SOURCE=/absolute/path/to/~/.codex` when local Codex auth already exists; only fall back to `OPENAI_API_KEY` when it does not.
- Keep generated user-facing files under `CODEX_ARTIFACTS_DIR` unless the user explicitly asks to write into the repository itself.
- Never commit `.env.real` or local browser profile data.
- Prefer `pnpm docker:*` commands for validation and debugging.

## Success Criteria

- Feishu app is configured for long connection mode.
- `im.message.receive_v1` is subscribed.
- Required IM permissions are granted.
- App credentials are present in `.env.real`.
- `pnpm docker:up` succeeds.
- `pnpm docker:smoke` succeeds.
- The user can message the bot in Feishu without additional manual setup.
