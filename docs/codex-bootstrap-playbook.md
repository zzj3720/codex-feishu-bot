# Codex Bootstrap Playbook

This playbook is written for a fresh Codex session operating this repository on behalf of the user.

## Operator Objective

End state:

- The one-click Feishu bot creation command has run
- Any login QR code has been surfaced to the user
- The resulting identifiers, files, and next steps are summarized back to the user

## Required Commands

Run from repository root:

```bash
npx -y lark-op-cli@latest create-bot
```

## Execution Path

1. Do not open a browser.
2. Do not install or invoke `agent-browser`.
3. Run `npx -y lark-op-cli@latest create-bot`.
4. Read stdout/stderr continuously instead of waiting for process exit.
5. If the command shows an ASCII QR code or other login prompt, surface it to the user immediately so they can scan or confirm.
6. Wait for the command to finish, or clearly explain which user action it is blocked on.
7. When the command completes, provide the user with:

- the bot/app name used
- any identifiers or credentials printed by the script
- generated file paths or config locations
- the next step the user should take

## Guardrails

- Do not open Chrome or any other browser.
- Do not use Chrome CDP.
- Do not install or invoke `agent-browser`.
- Do not continue into Docker deployment or repository setup as part of this prompt path.
- Do not expose secrets in terminal output beyond what is necessary for the user to continue.
