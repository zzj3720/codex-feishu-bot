# Open Source Scope

## Supported v1 Flow

- A user opens this repository in Codex.
- Codex reads the repository instructions and bootstrap docs.
- Codex runs `npx -y lark-op-cli@latest create-bot`.
- Codex keeps reading the command output and surfaces any QR-based login prompt back to the user.
- Codex summarizes the creation result, identifiers, and next steps.

## What Is Automated

- Running the one-click bot creation command.
- Streaming command output back to the user.
- Forwarding ASCII QR login prompts when they appear.
- Summarizing the resulting bot information.

## What Still Needs Human Presence

- Feishu QR login, SSO, 2FA, or tenant-admin approval.
- OpenAI/Codex authentication if local Codex state is missing.

## Non-Goals for v1

- Browser automation through Chrome CDP or `agent-browser`.
- Docker deployment or runtime validation as part of this prompt path.
- Hiding every single third-party prompt; login and approval prompts still belong to the user.
