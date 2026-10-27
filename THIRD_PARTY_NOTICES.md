<!-- SPDX-License-Identifier: MPL-2.0 -->
# 第三方与代码来源

## Three.js 与配套模块

- 文件：`public/vendor/three.module.js`、`three.core.min.js`、`OrbitControls.js`、`GLTFLoader.js`、`BufferGeometryUtils.js`、`SkeletonUtils.js`。
- Copyright © 2010–2026 three.js authors。
- 许可：MIT，完整原文见 [public/vendor/LICENSE](public/vendor/LICENSE)。
- 上游：[Three.js](https://github.com/mrdoob/three.js)。保留原文件及授权头，由 `scripts/vendor-integrity.json` 校验。主项目 MPL-2.0 不改变其 MIT 授权。

## 居所社区版自有内容

作者授权的基础状态回读模块 `server/control-verification.mjs` 来自其既有项目；社区版页面、最小服务端、教程与虚构模型独立维护，按 [MPL-2.0](LICENSE) 提供。未包含原私人 Git 历史、完整 AI、真实映射或家庭模型。

社区版对照作者原版的空间首页、石墨色界面、设备页与交互规则制作。背景为自制 CSS，设备插图为通用 SVG，使用系统字体；不包含品牌产品照片、用户背景照片或外部音频素材。

## 虚构模型与截图

`scripts/create-community-model.py` 是独立 Blender 生成器；`public/assets/community-detail-v6.glb` 由它生成虚构建筑、家具、UV、程序纹理及光影。暖木、米白与橄榄绿借鉴作者授权的视觉风格，未导入真实家庭的工程、模型、UV 或烘焙贴图。

Blender / Cycles 是制作工具，未随包分发，普通运行无需安装。自有模型与截图的许可范围见 [NOTICE.md](NOTICE.md)，模型生成方法见 [模型说明](docs/model-customization.md)。所有随包截图来自社区版虚构家庭。
