# 小云账本 ☁

一个给手机用的小记账本：奶油底色、圆角卡片、一只住在首页的小云。没有广告、没有登录、不联网，数据只留在你自己的设备上。

## 怎么在手机上打开

**方式一：扫码安装（临时 HTTPS，最省事）**

我已经用 cloudflared 起了一条临时隧道，手机扫码就能打开（二维码见 `preview/qr.png`，对话里也贴了）：

```
https://interactions-stay-wing-limitations.trycloudflare.com/
```

- 这是 Cloudflare 的 quick tunnel，**地址是临时的**：电脑上 `cloudflared.exe` 进程一停就失效；
- 打开一次、装到主屏幕之后，Service Worker 已经把外壳缓存下来，之后**断网也能用**；
- 隧道开着的时候这个页面在公网可访问（只是静态文件，你的账单数据在手机浏览器本地，不经过服务器）；
- 想再开一次：`C:\Users\xuzhe\cloudflared.exe tunnel --url http://127.0.0.1:4321`（会生成新地址）。

**方式二：同一个 Wi-Fi（不装也行，打开就用）**

电脑上这个目录已经起了一个静态服务，手机浏览器打开：

```
http://192.168.1.42:4321
```

- 电脑和手机要连同一个路由器；
- 电脑关机/休眠后就访问不到了；
- 服务是我用一条命令起在后台的（没有窗口）。重启电脑后要重新起一次：

  ```powershell
  C:\Users\xuzhe\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe -m http.server 4321 --bind 0.0.0.0 --directory C:\Users\xuzhe\pocket-ledger
  ```

- 如果手机打不开：多半是 Windows 防火墙把入站挡了（本机网络是「公用」）。用**管理员** PowerShell 放行一次：

  ```powershell
  netsh advfirewall firewall add rule name="xiaoyun-ledger-4321" dir=in action=allow protocol=TCP localport=4321
  ```

  也可以临时把手机和电脑连到同一个手机热点试试。

**方式三：部署到永久地址（想要长期稳定就用这个）**

把整个目录传到任意静态托管即可，比如：

- GitHub Pages：新建仓库 → 上传这几个文件 → Settings → Pages → 选 main 分支；
- Vercel / Netlify：把文件夹拖进去，选 "Static"，不用构建命令；
- 自己的服务器：丢进 Nginx 的静态目录。

拿到 `https://…` 地址后：

- **iPhone**：Safari 打开 → 分享 → 「添加到主屏幕」；
- **Android**：Chrome 打开 → 菜单 → 「安装应用」/「添加到主屏幕」。

装好之后有独立图标、全屏无地址栏，断网也能用（Service Worker 缓存了外壳）。

**方式四：电脑上直接看**

浏览器打开 `http://127.0.0.1:4321`，窗口拉窄就能看到手机版式；宽屏会显示成一个居中的手机壳。

## 功能

- **记一笔**：数字键盘输入金额 → 选分类 → 可改日期、写备注 → 保存。支出 9 类、收入 4 类。
- **首页**：本月支出大字、收入/结余、预算进度条、最近 4 笔。
- **明细**：按天分组、每天小计、全部/支出/收入筛选、可切月份。
- **统计**：支出环形图、分类占比、近 7 天柱状图、分类排行。
- **我的**：每月预算、导出/导入 JSON 备份、清空账本。
- **改/删**：点任意一条记录就能改，弹层右上角的垃圾桶删掉。

## 数据

- 存在浏览器的 `localStorage`，键名 `xiaoyun.ledger.v1`；
- 换手机、换浏览器、清理浏览器数据都会丢，所以「我的 → 导出备份」会下载一份 JSON；
- 导入会**覆盖**当前记录（会二次确认）。

## 文件结构

```
index.html            页面骨架 + 图标 sprite
style.css             全部样式（奶油色系、圆角、弹层动画）
app.js                全部逻辑（无框架、无依赖）
sw.js                 Service Worker：离线缓存
manifest.webmanifest  PWA 清单（名称、图标、主题色）
icons/                192 / 512 / maskable 图标
```

没有任何构建步骤：改完文件刷新就生效。

## 想改点什么

- **配色**：`style.css` 顶部的 `:root` 变量，`--coral`（主色）、`--mint`、`--butter`、`--bg` 都在那儿；
- **分类**：`app.js` 里的 `CATS`，加一项就会自动出现在记账弹层和统计里（`icon` 要对应 `index.html` 里某个 `<symbol id="i-…">`）；
- **小云**：首页的云在 `index.html` 的 `.mascot` 里，是纯 SVG；空状态的云在 `app.js` 的 `emptyHtml()`；
- **文案**：问候语在 `app.js` 的 `greeting()`，空状态在 `emptyHtml()`。

> 改完记得把 `sw.js` 第一行的 `CACHE = 'xiaoyun-ledger-v1'` 换个版本号（比如 v2），
> 否则手机上的旧缓存会一直盖住新文件。开发时用 `?v=时间戳` 打开也能绕过缓存。

## 已知边界

- 单机版：没有多设备同步、没有账号；
- 金额上限 9999999.99，够日常用；
- 只记「一笔一笔」的流水，不做复式账、不做多币种。
