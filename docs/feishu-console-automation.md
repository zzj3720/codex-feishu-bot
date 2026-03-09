# Feishu Console Automation

This document defines the target state that Codex should reach when automating Feishu Open Platform through Chrome CDP.

## Target App State

- App type: enterprise self-built app
- Has bot capability enabled
- Event subscription mode: long connection / persistent connection
- Subscribed event: `im.message.receive_v1`
- App version released and enabled for testing in the current tenant

## Permission Target

Feishu permission labels change over time, so automate toward capabilities, not brittle literal strings.

Codex should search for and grant the smallest IM permission set that covers:

- receiving group messages
- receiving direct messages
- receiving group `@bot` messages or group mention read access
- creating bot messages
- updating messages or cards
- uploading and sending files

When the console provides both Chinese and English labels, either is acceptable as long as the capability above is covered.

## Recommended Console Flow

1. Open the app list in Feishu Open Platform.
2. Reuse an existing app if it is obviously the intended bot app; otherwise create a new enterprise self-built app.
3. Enable bot capability.
4. Open the event subscription page.
5. Select long connection / persistent connection mode.
6. Add `im.message.receive_v1`.
7. Open the permissions page and add the IM permissions listed above.
8. Open version management / release.
9. Create and release a version so the bot is usable in the tenant.
10. Copy the App ID and App Secret back into `.env.real`.

## Human Stop Points

Only pause for the user when one of these happens:

- Feishu login is required.
- SSO / 2FA is required.
- Tenant admin approval is required.
- The console presents multiple plausible existing apps and the target is genuinely ambiguous.

Otherwise continue autonomously.
