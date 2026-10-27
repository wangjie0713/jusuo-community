<!-- SPDX-License-Identifier: MPL-2.0 -->
# 安全与隐私

当前版本是早期社区预览版，不是经过第三方安全认证的生产产品。

真实配置只在服务器本机维护：`deploy/.env`、`config/entity-map.local.json`。不得放入浏览器静态目录或截图。`.gitignore` 和白名单导出提供两层防误传；它们不能撤回已经上传的秘密。

真实模式有密码会话、CSRF / Origin / Host 检查、设备白名单、参数校验、基础节流与状态回读。默认只监听本机。真实 HA Token 不下发前端，上游原始错误不直接显示。没有遥测、外部字体、云端 AI 调用或设备 API 缓存。

这不是多租户系统，没有账户管理、MFA 或安全审计平台。用于真实家庭前应完成对应环境的兼容验证；面向其他家庭部署需要单独设计网络隔离、备份、授权和维护流程。

发现安全问题时不要开包含秘密的公开 Issue。正式仓库启用 GitHub 的 Private vulnerability reporting 后，可在 Security → Report a vulnerability 私下报告；尚未提供该入口时，先只用普通 Issue 询问私下联系渠道，不附漏洞细节或凭据。

误上传凭据时先撤销 / 轮换，再处理 Git 历史与派生副本。不要只删除当前文件就当作已解决。
