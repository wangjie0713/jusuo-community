<!-- SPDX-License-Identifier: MPL-2.0 -->
# 第一次上传到 GitHub

本文面向第一次发布项目的作者。MPL-2.0 已确定；本地上传包准备完成不等于已经上传或公开。目标仓库为 [wangjie0713/jusuo-community](https://github.com/wangjie0713/jusuo-community)。正式项目与原私人仓库不参与此流程。

## 第 1 步：确认新仓库保持 Private

打开目标仓库，确认仓库名旁显示 **Private**。若你能打开、协作者却收到 404，可能只是连接工具尚无权访问新私有仓库，不必为了让工具读取而提前公开。

## 第 2 步：使用本次生成的上传文件夹

维护者在独立社区版运行以下命令：

```sh
npm test
npm run check
npm run package:upload
```

打包需要 Python 3，只供维护者使用。它按 `scripts/release-files.json` 的逐文件清单导出到新的 `dist/jusuo-community-upload-UTC时间/`；同名 ZIP 与 SHA-256 manifest 放在目录外供本地备份、核验。保留旧包，不自动覆盖、删除或上传。

**用户只上传这次生成的文件夹内部内容。** 打开它应直接看到 `README.md`、`LICENSE`、`NOTICE.md`、`package.json`、`public`、`server` 等。不要把外层文件夹、整个 dist 或 ZIP 拖进去；否则别人拿不到正确的项目结构。

包内只有社区版源码、虚构模型与截图、示例配置、教程、测试、打包脚本、授权文件和 GitHub 模板。没有正式项目、私人 Git 历史、完整 AI、真实户型、实际 `.env`、家庭配置、日志或密钥。

## 第 3 步：打开网页上传入口

1. 打开目标仓库的 **Code** 页。
2. 点击文件列表上方 **Add file → Upload files**。
3. 空仓库若没有 Add file，点击引导区的 **uploading an existing file**。
4. 页面出现拖放区域或 **choose your files** 就进入了正确位置。

此时还没有上传提交，不用填写代码命令。

## 第 4 步：拖入文件夹里面的内容

1. Mac 的 Finder 打开这次生成的上传文件夹。
2. 按 **Command + Shift + .** 显示隐藏项目。应能看到 `.github`、`.gitignore`、`.dockerignore`；`deploy/` 内应有 `.env.example`。
3. 按 **Command + A** 选中文件夹内所有内容，拖入 GitHub 的上传区域，等待上传列表完整显示。Windows 则先开启“显示隐藏的项目”，再选择内部内容。
4. 核对列表包含根目录的 `README.md`、`LICENSE`、`NOTICE.md`、`package.json`，以及 `.github/workflows/check.yml`、`.gitignore`、`.dockerignore`、`deploy/.env.example`。本次清单共 62 个文件。
5. 如果路径多了一层 `jusuo-community-upload-.../`，说明拖入了外层目录；返回仓库重新打开上传页面，只选择内部内容。
6. 若浏览器漏掉隐藏文件，补拖对应文件或目录；仍不能完整上传时暂停，改用 GitHub Desktop 协助上传，避免缺配置却误以为完成。

GitHub 网页单文件上限 25 MiB、一次最多 100 个文件，本包符合这两个限制。参照 [GitHub 官方上传说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

## 第 5 步：保存这次上传

检查列表后，提交说明填：

```text
Add Community Edition preview under MPL-2.0
```

对于这个只含初始 README 的新私有仓库，可以选直接提交到当前默认分支，再点 **Commit changes**。若界面要求新分支，选新分支并按页面创建 Pull Request，检查后合入默认分支。上传的 README 会替换 GitHub 自动生成的占位 README。

成功标志：回到 Code 页面后，根目录直接显示项目文件，README 显示介绍与截图，GitHub 能识别 MPL-2.0。若页面报密钥检测或权限错误，不要跳过，先让协作者检查具体文件。

## 第 6 步：确认别人拿到的版本能运行

1. 点击 **Actions**，检查 **Community checks** 是否通过。工作流文件遗漏或工作流被禁用时不会有检查，不能把“没有失败记录”当成通过。
2. 检查 README 图片、安装教程、模型说明和许可证链接是否正常。
3. 用 **Code → Download ZIP** 下载仓库当前版本，在新的位置解压。
4. 在解压目录按 [入门教程](getting-started.md) 启动。应无需私人 `.env` 或原项目就能打开虚构家庭并进行模拟控制。
5. 本机检查不代表真实 HA、Windows、iPad 已验收；这些仍在 Roadmap 中。

## 第 7 步：最后再决定公开

私有仓库只对获授权账号可见，公开仓库才能让普通用户直接访问。完成以上检查后，再由作者明确决定是否在 **Settings → General → Danger Zone → Change repository visibility** 切换为 Public。不要修改原正式仓库的可见性。

公开后别人可能复制或建立分支，改回私有不能收回已分发副本。第一次不必同时制作 Release；先让 README、教程、演示与反馈入口工作，再考虑版本标签和演示视频。

## 日后如何更新

只在独立社区版维护公开内容，每次重新核对文件清单、截图、授权和测试后导出。不要从正式私人仓库整批复制或合并历史。

`.gitignore` 不会清除已上传的历史，GitHub 网页上传也不能代替白名单筛选。若意外上传凭据，应先撤销 / 轮换凭据，再处理历史与副本。
