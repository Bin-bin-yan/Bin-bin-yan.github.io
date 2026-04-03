# H5 婚礼邀请函

一个面向手机浏览的静态婚礼邀请函项目，适合直接部署到 GitHub Pages。

## 当前信息

- 新郎：闫斌斌
- 新娘：谷晓敏
- 婚礼日期：2026 年 5 月 3 日
- 设宴地点：洛阳市和平门烤鸭店

## 本地开发

1. 处理图片素材：

   ```powershell
   npm run prepare:images
   ```

2. 启动本地静态服务：

   ```bash
   npm run dev
   ```

3. 打开浏览器访问 `http://localhost:4173`。

## 构建站点

```bash
npm run build
```

构建后会生成 `dist/`，其中只包含 GitHub Pages 需要发布的静态文件。

## GitHub Pages 部署

1. 将当前目录初始化为 Git 仓库并推送到 GitHub。
2. 仓库 `Settings -> Pages` 中把 `Build and deployment` 设为 `GitHub Actions`。
3. 推送到 `main` 或 `master` 分支后，`.github/workflows/deploy.yml` 会自动构建并发布。

## 图片维护说明

- 原始婚纱照保留在本地 `图片/` 目录，不要提交到仓库。
- 页面实际使用的是 `assets/images/gallery/` 下的优化后图片。
- 如果你替换了 `图片/` 目录里的内容，重新执行 `npm run prepare:images` 即可更新页面图库。

## 可调整位置

- 婚礼基础信息：`src/data/wedding.js`
- 页面结构与交互：`src/main.js`
- 视觉样式：`src/styles/main.css`
- 图片处理脚本：`scripts/prepare-images.ps1`
