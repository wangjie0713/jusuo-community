<!-- SPDX-License-Identifier: MPL-2.0 -->
# 接入自己的 Home Assistant

**先体验模拟家庭，再配置真实设备。** 真实模式不再提供模拟设备，不会自动兜底成模拟成功。本轮交付没有连接任何真实 HA，也没有实际控制设备。

## 支持范围

仅 `light` 的开关和 `climate` 的 HVAC 开关、单个目标温度。不要映射门锁、安防、车库、车辆、摄像头或通过模板伪装的高风险设备。多实体灯组暂不支持；温度范围与运行模式来自设备状态。特殊恒温器、双目标温度和只读设备仍需单独适配。

## 1. 在 HA 中确认设备

先在 HA 自己的页面确认目标灯和空调可操作。再查找实体 ID，只把所需设备写入本机映射。不要把整个实体列表复制到 Issue 或公开仓库。

## 2. 创建本机映射

复制 `config/entity-map.example.json` 为同目录的 `entity-map.local.json`，只编辑新文件。保留示例文件的虚构内容。

- `device_key`：本项目的稳定名字，例如 `living-light`，只用小写英文、数字和短横线。
- `name`：页面显示名称。
- `room`：页面房间名称。
- `type`：`light` 或 `climate`。
- `entity_id`：在 HA 实际核对的实体 ID，只写进 `.local.json`。

最多 50 个设备。不要填厂商账号、URL 或额外服务参数。只配置 1 个测试灯开始，确认闭环后再逐个加入。

## 3. 配置服务端环境变量

复制 `deploy/.env.example` 为 `deploy/.env`，只编辑新文件：

```dotenv
CE_MODE=home-assistant
CE_HOST=127.0.0.1
CE_PORT=4177
CE_PASSWORD="REPLACE_WITH_YOUR_OWN_LONG_PASSWORD"
HA_BASE_URL="http://homeassistant.local:8123"
HA_TOKEN="REPLACE_WITH_YOUR_OWN_HA_TOKEN"
```

示例中的两个 `REPLACE_...` 是占位符，必须换成你自己的值。密码至少 16 位，建议随机生成，不复用其他账号密码。HA 的长期访问令牌在 HA 用户个人资料中创建，只保存在本机环境变量文件；参考 [HA 认证说明](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token)。地址必须为本地 / 内网 HTTP(S) 根地址，不允许带用户名、密码、路径参数或公网域名。

`npm start` 会读取 `deploy/.env`。修改后重启社区版即可；不需要重启正式 HA。操作系统已有环境变量优先于该文件，出现模式不符时先检查终端环境。

## 4. 验证自己的设备

1. 启动后先登录，确认页面标明自己的家庭，列表只有你配置的设备。
2. 确认设备名称与真实对象一致。三维空间仍是虚构示意，不对应真实位置。
3. 用测试灯操作一次，核对 UI、HA 状态和真实灯具三者一致。
4. 再测试空调开关与允许范围内的温度；不支持的模式不要强行映射。
5. 结果待核实时先读状态，不连续重复操作。

HTTP 本机测试只供这台电脑。要从其他设备访问，必须配置独立 HTTPS 入口与 CE_PASSWORD，明确 `CE_PUBLIC_ORIGIN`；服务只接受该来源。不要通过修改源码删除认证或 Host / Origin 检查。

## 可选容器模板

`deploy/compose.yaml` 是供有 Docker 经验的用户审阅的模板，**尚未在本机或 Windows 执行验证**。默认模拟模式；不连接 AI、不挂载 Docker socket。

1. 复制环境变量示例，设置自己的长密码；保持 `CE_MODE=demo`。
2. 在项目根目录运行 `docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet` 检查模板。
3. 再运行 `docker compose --env-file deploy/.env -f deploy/compose.yaml up --build -d`。
4. 模板仅把 `127.0.0.1:8443` 暴露到宿主机，通过 Caddy 提供 `https://localhost:8443`，需要在本机信任 Caddy 本地 CA。证书管理参照 [Caddy 本地 HTTPS](https://caddyserver.com/docs/automatic-https#local-https)，不要关闭浏览器证书验证。
5. 真实接入时显式挂载自己的 `entity-map.local.json` 替换模板中的示例挂载。容器内 `localhost` 指容器自身，不能用它寻找另一台 HA 主机。

LAN / iPad 部署涉及实际主机名与可信证书，先做单独配置和真机验证。此模板并非面向新手的一键全平台部署承诺。

## 秘密放在哪里

此独立 Node 服务使用环境变量，不读取 HA 的 `secrets.yaml`。如果以后公开 HA YAML 示例，应使用 `!secret`，并把实际 `secrets.yaml` 留在本机。`secrets.yaml` 只是分离秘密，**不会加密秘密**；见 [HA 官方说明](https://www.home-assistant.io/docs/configuration/secrets)与[安全说明](https://www.home-assistant.io/docs/configuration/securing/)。

`.env`、`*.local.json` 和 `secrets.yaml` 已忽略，但 `.gitignore` 不会撤回已经提交过的内容。上传前始终使用白名单导出和再次审阅。
