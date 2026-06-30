# GitHub 托管与运维最佳实践

> 面向：本项目（家庭财务规划模拟器）的**维护者**（也就是你）。
> 目标：把这个纯前端项目托管到 GitHub、实现「提交代码 → 公开网址自动更新」、并保持日常维护省心。
> 性质：**操作手册**——按章节对照着做即可。每条都附「为什么」和「做了之后的效果」。

---

## 0. 先看现状：项目已经准备好了什么

动手前先知道你已经具备哪些条件，避免重复劳动：

| 项目 | 现状 | 说明 |
| --- | --- | --- |
| 开源协议 | ✅ 已有 MIT LICENSE | 别人能合法使用 / 修改 / 分享 |
| 项目说明 README | ✅ 已较完整 | 介绍、功能、快速开始、隐私说明、技术栈都有 |
| 依赖锁文件 | ✅ `package-lock.json` | 保证别人和云端装出来的依赖版本一致 |
| 单文件打包 | ✅ `vite-plugin-singlefile` | `npm run build` 产出单个 `dist/index.html` |
| 脱敏 | ✅ `.gitignore` 已排除敏感数据 | `.claude/`、`公积金基数.txt`、`房贷月供金额.md` 等不会上传 |
| 提交规范 | ✅ 中文 + 类型前缀 | 如 `feat(ui):` `docs(plan):` `style(ui):` |
| 自动部署 / CI | ❌ 尚未配置 | 本文档第二、三章解决 |
| 在线试用地址 | ❌ 尚未有 | 部署后填回 README |
| 仓库占位地址 | ⚠️ 待替换 | `package.json` 里 `homepage` / `repository` 是占位，需改成真实地址 |

---

## 一、把项目放到 GitHub（开源准备）

> 效果：项目对全世界公开可见，别人能搜到、能看源码、能克隆使用。

### 1.1 新建公开仓库并推送

如果还没推送：

1. GitHub 网页右上角 `+` → **New repository**
2. 仓库名建议：`family-finance-app`（和 `package.json` 里一致）
3. **可见性选 Public（公开）**——只有公开仓库才享受免费的自动部署和无限构建
4. **不要**勾「Initialize with README / .gitignore / LICENSE」，你本地都有了，勾了反而冲突
5. 创建后 GitHub 会给一段推送命令，照着执行：

```bash
git remote add origin https://github.com/<你的用户名>/family-finance-app.git
git branch -M main          # 把本地主分支统一改名为 main（GitHub 默认就是 main）
git push -u origin main
```

### 1.2 完善仓库「门面」

推送后，在 GitHub 网页上做几件一次性的小事，让项目更专业、更易被发现：

- **About 简介**：仓库主页右上角点 `About` 的齿轮，填一句话描述 + 官网地址（部署后的 Pages 地址）+ 话题标签（topics，如 `personal-finance` `vue` `budget-planner`），让别人能搜到你。
- **默认分支确认是 `main`**：`Settings → General → Default branch`。
- **改掉占位地址**：`package.json` 里的 `homepage` 和 `repository.url` 目前是占位的 `Leytou/family-finance-app`，推送到你真实的仓库后，改成真实地址。

### 1.3 脱敏最后检查（重要）

你的 `.gitignore` 已经排除了个人数据和本地工具目录，做得很好。再确认两点：

- **提交前看一眼要传的东西**：用 `git status` / `git diff` 检查，别把 `公积金基数.txt`、`房贷月供金额.md` 这类文件误提交。它们虽已被忽略，但换了新文件名时要记得补进 `.gitignore`。
- **根目录的临时日志**：项目根目录目前有一些 `.vite-*.log`、`.vite-dev-check.*.log` 等调试日志，建议在 `.gitignore` 里加一行 `*.log`（或 `.vite-*.log`），避免它们被提交。

---

## 二、自动部署到公开网址（核心）

> 效果：以后你只要正常提交代码到 main 分支，过一两分钟，公开网址上的内容就自动更新成最新版。不用手动打包、不用手动上传。

这是纯前端项目最舒服的用法。原理：在仓库里放一个「自动化配置文件」（GitHub Actions），每次推送，GitHub 的云端机器自动帮你跑构建并发布。公开仓库**完全免费**。

### 2.1 一次性设置：开启 Pages

进入仓库 `Settings → Pages → Source`，选择 **GitHub Actions**（不是 branch）。只需做一次。

### 2.2 放入自动化配置文件

在项目里新建 `.github/workflows/deploy.yml`（注意 `.github` 是隐藏目录），内容如下，每步都加了中文注释：

```yaml
# .github/workflows/deploy.yml
# 作用：把代码合并到 main 分支时，自动打包并发布到 GitHub Pages 公开网址。
name: 构建并发布到 GitHub Pages

on:
  push:
    branches: [ main ]     # 只有 main 分支收到推送时才触发
  workflow_dispatch:        # 也允许在 GitHub 网页手动点按钮触发（Actions 页面）

# 发布到 Pages 需要的权限
permissions:
  contents: read
  pages: write
  id-token: write

# 同一时间只跑一个部署，避免新旧版本互相覆盖
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 拉取代码
        uses: actions/checkout@v4

      - name: 安装 Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20      # 项目要求 Node 18+，这里用 20 LTS 更稳
          cache: npm            # 缓存依赖，加快后续构建

      - name: 安装依赖
        run: npm ci             # 按锁文件确定性安装（比 npm install 更稳、更快）

      - name: 运行测试
        run: npm run test       # 先跑测试，测试不过就不继续发布（见第三章）

      - name: 打包
        run: npm run build

      - name: 上传构建产物
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist            # 打包结果在 dist 目录（本项目是单个 index.html）

      - name: 发布到 GitHub Pages
        uses: actions/deploy-pages@v4
```

把这个文件提交并推送到 main，GitHub 就会自动跑第一次部署。

### 2.3 看结果

- 进入仓库的 **Actions** 标签页，能看到每次自动运行的记录：绿色对勾 = 成功，红色叉 = 失败（点进去看日志排查）。
- 部署成功后，公开网址形如：`https://<你的用户名>.github.io/family-finance-app/`（`Settings → Pages` 顶部能看到确切地址）。
- **拿到地址后填回 README**，加一行「在线试用」，并填到仓库 About 的官网字段。

### 2.4 触发时机说明

只有「推送到 **main** 分支」才会触发部署。如果你平时在功能分支上改、改完再合并 main，那是在**合并那一刻**自动发布——在功能分支上的普通提交不会反复触发发布。这是有意的，避免半成品被发布上网。

### 2.5 费用

公开仓库的 GitHub Actions 和 Pages **完全免费**，不限次数、不限访问流量。只有私有仓库才有限额 / 收费，本项目是开源的，不涉及。

---

## 三、让提交更省心：自动跑测试

> 效果：每次推送，云端自动跑一遍测试。如果某次改动把功能改坏了，测试会立刻在 Actions 页面标红提醒，不用等你手动发现。

上面的 `deploy.yml` 里已经包含了 `npm run test` 这一步（在打包之前）。也就是说你已经自动拥有了「测试不过就不发布」的保护。

如果还希望**还没合并到 main、只是在功能分支或 Pull Request 上**也自动跑测试，再加一个独立小文件 `.github/workflows/test.yml`：

```yaml
# .github/workflows/test.yml
# 作用：在功能分支 / PR 上推送时也跑测试，提前发现问题。
name: 测试

on:
  push:
    branches-ignore: [ main ]   # main 由 deploy.yml 负责，这里跑其他分支
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test
```

> 这条是进阶项，觉得一个 `deploy.yml` 够用就先不加。项目大了、协作多了再拆。

---

## 四、发版本（Release）

> 效果：给重要里程碑打上版本号（如 v1.0），别人能在 GitHub 上方便地下载到「开箱即用」的单文件网页。

注意：项目里已有的 [发布打包说明](./发布打包说明.md) 讲的是**本地打包、发给朋友**的流程；本节讲的是**在 GitHub 上正式发布版本**，两者互补。

### 流程

1. 确认要发布的代码已在 main 上、且自动部署已通过。
2. 打标签并推送：

```bash
git tag v1.0.0          # 版本号建议用语义化版本：主版本.次版本.修订号
git push origin v1.0.0
```

3. 在 GitHub 网页 `Releases → Draft a new release`，选刚推的标签，填版本说明（这次更新了什么）。
4. **把 `dist/index.html` 作为附件上传到这个 Release**。这样访客在 Release 页面能直接下载到一个双击即用的网页文件，不用懂编程。

> 小技巧：附件 html 可以改个好认的名字，如 `家庭财务规划模拟器-v1.0.html`。

---

## 五、日常维护习惯

- **小步提交**：做完一个小功能就提交一次，别攒一大堆。提交信息继续用你现在的规范——中文描述 + 类型前缀（`feat:` 新功能、`fix:` 修 bug、`docs:` 文档、`style:` 样式、`refactor:` 重构、`test:` 测试）。
- **别提交本地产物**：`dist/`、`node_modules/`、各种 `.log` 都不要提交（`dist` 和 `node_modules` 已忽略，日志建议补忽略）。
- **依赖更新**：偶尔看一下 `npm outdated`，更新依赖后跑一遍测试，没问题再提交。
- **敏感数据永远在 `.gitignore` 里**：任何含真实金额 / 账号 / 个人信息的文件，第一时间确认它被忽略。

---

## 六、进阶（以后需要再加，现在不用管）

这些等项目有人来贡献、或规模变大时再考虑，个人项目完全可以跳过：

- **Dependabot**：`Settings → Code security → Dependabot`，开启后 GitHub 会自动盯着依赖有没有安全漏洞，有就提 PR 提醒你升级。免费、省心，有空时推荐开一下。
- **CONTRIBUTING.md / Issue 模板**：当有人想给你提需求或改代码时再加，规范大家怎么反馈。
- **分支保护**：要求 PR 通过测试才能合并 main。一个人开发时没必要，多人协作时再加。

---

## 速查清单 ✅

把本文档要做的动作浓缩成一页纸，做完一项勾一项：

**一次性准备**
- [ ] 在 GitHub 创建公开仓库 `family-finance-app` 并推送代码
- [ ] 本地主分支统一为 `main`（`git branch -M main`）
- [ ] 仓库 About 填简介、话题标签、官网地址
- [ ] `package.json` 的 homepage / repository.url 改成真实地址
- [ ] `.gitignore` 补一行 `*.log`（忽略临时日志）

**自动部署**
- [ ] `Settings → Pages → Source` 选 GitHub Actions
- [ ] 新建 `.github/workflows/deploy.yml`（内容见 2.2）并推送
- [ ] Actions 页面确认第一次部署成功（绿勾）
- [ ] 拿到 Pages 网址，填回 README「在线试用」和仓库 About

**可选**
- [ ] 新建 `.github/workflows/test.yml`（功能分支 / PR 上也跑测试）
- [ ] 打第一个 Release 标签并上传单文件 html
- [ ] 开启 Dependabot 依赖安全提醒

---

> 维护这份文档：随着项目演进，如果哪条实践不再适用或有了更好的做法，直接更新本文档。它服务于你自己的日常维护，保持「实用」比「齐全」更重要。
