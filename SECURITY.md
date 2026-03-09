# Security Policy

## 报告方式

如果你发现了会导致以下问题的安全缺陷，请不要直接公开发 issue：

- 泄露 `FEISHU_APP_SECRET`
- 泄露 `OPENAI_API_KEY`
- 泄露本地 `~/.codex` 凭证
- 允许未授权用户控制机器人或读取工作空间内容

请通过私下渠道联系维护者处理。

## 敏感文件

这些文件和目录不应提交到仓库：

- `.env.real`
- `.codex-local/`
- 本地浏览器 profile
- 含真实飞书租户凭证的日志或截图

## 基本建议

- 优先通过 `CODEX_HOME_SOURCE` 复用本机已有 Codex 登录态
- 只有在必须时才使用 `OPENAI_API_KEY`
- 在公开截图或日志前，先确认所有 app id、secret、token 和用户数据都已经打码
