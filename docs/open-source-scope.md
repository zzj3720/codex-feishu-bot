# Open Source Scope

## Supported v1 Flow

- A user opens this repository in Codex.
- Codex reads the repository instructions and bootstrap docs.
- Codex prepares `.env.real`, launches Chrome with CDP, and uses browser automation to configure Feishu Open Platform.
- Codex keeps generated deliverables in a separate artifacts directory instead of polluting the repository root.
- Codex runs against a dedicated mounted runtime workspace instead of the repository checkout root.
- The only supported production deployment target is a single Docker service.
- Codex starts the Docker deployment and validates it.

## What Is Automated

- Local environment file scaffolding.
- Launching a dedicated Chrome debugging instance.
- Navigating Feishu Open Platform.
- Creating or reusing a Feishu app.
- Enabling bot capability, event subscription, permissions, and release flow.
- Writing discovered app credentials back into `.env.real`.
- Starting Docker services and running smoke checks.

## What Still Needs Human Presence

- Feishu login, SSO, 2FA, or tenant-admin approval.
- OpenAI/Codex authentication if local Codex state is missing.
- Final choice when the tenant already has multiple plausible Feishu apps and the target is ambiguous.

## Non-Goals for v1

- Automating Feishu developer-console setup via unsupported management APIs.
- Supporting non-Docker production runtimes as the primary path.
- Hiding every single third-party prompt; login and approval prompts still belong to the user.
