# 《生活英语重启》网站

这是三册成人生活英语自学教材的网站呈现层。课文不直接写在网页组件中；网站在构建前读取上级目录中的系列总纲、课程地图和各课Markdown源稿，自动生成首页、三册目录和96个独立课页。

## 内容工作流

1. 在 `../lessons/unit-XX/` 编写或修改单课Markdown；
2. 在上级目录同步人物事实、词块复现和项目状态；
3. 审核通过后将隐藏标记改为 `lesson-status: complete`；
4. 运行 `npm run content` 更新网站内容数据；
5. 运行 `npm run build` 验证正式构建；
6. 运行 `npm test` 验证首页、目录、完整课页和规划页。

`app/generated/content.ts` 是生成文件，不应手工修改，但需要随网站源码提交，作为托管构建无法访问上级书稿目录时使用的内容快照。本地存在上级Markdown源稿时，`npm run content`和`npm run build`会先重新生成它；托管环境缺少上级目录时，构建会使用已提交的快照。

## 本地命令

```bash
npm run dev
npm run typecheck
npm run build
npm run build:edgeone
npm test
```

## EdgeOne 发布

公开 Git 仓库：`https://github.com/qingci2014/elife`

EdgeOne 项目接入 `main` 分支后，每次发布按以下顺序进行：

1. 更新内容并提交到本地 Git；
2. 双击 `publish-edgeone.cmd`；
3. 脚本先运行完整测试，再确认工作区没有遗漏，最后通过 HTTP/1.1 推送 `main`；
4. EdgeOne 检测到新提交后自动构建和部署。

EdgeOne 使用 Next.js 预设，构建命令为 `npm run build:edgeone`，输出目录为 `.next`。默认的 `npm run build` 继续用于现有 Vinext/Sites 构建。

脚本不会自动暂存或提交文件，避免把无关改动带到线上。

网站页面结构和写作规范见上级目录的 `website-workflow.md`。
