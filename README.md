# 棋间 Online Club

支持跨设备实时对战的棋类房间应用，包含国际象棋、中国象棋、围棋和五子棋。

## 功能

- WebSocket 实时房间大厅、聊天和棋局状态同步
- 用户名 + 密码登录，首次登录自动注册
- 创建公开或暗号房间，跨设备输入房间码和暗号加入
- 服务端校验落子回合与基础棋子移动规则
- 同一套界面支持国际象棋、中国象棋、围棋和五子棋
- 围棋支持提子和禁入自杀点，五子棋支持服务端五连胜负判断

## 运行

```bash
npm install
npm run dev:full
```

打开 `http://localhost:5173/`。需要让其他设备访问时，把开发容器的 5173 端口设为 Public，并使用 VS Code 转发后的 HTTPS 地址。Vite 会把 `/ws` 自动代理到 3001 端口。

只启动服务端：

```bash
npm run server
```

服务端健康检查：`http://localhost:3001/`

## 一站部署到 Render

项目现在可以由一个 Render Web Service 同时托管网站前端和 WebSocket 实时服务，不需要拆成两个平台。

1. 将仓库连接到 Render。
2. Render 使用仓库中的 `render.yaml`，构建命令为 `npm install`，启动命令为 `npm start`。
3. Render 会先执行构建，再启动 Node 服务，得到类似 `https://qijian-game-server.onrender.com` 的唯一网站地址。
4. 直接打开这个地址即可访问网站和联机服务。

生产环境不需要配置 `VITE_WS_URL`，前端会自动连接当前网站的 `wss://` 地址。本地开发仍由 Vite 自动代理 `/ws` 到 3001 端口。

## 校验

```bash
npm run build
npm run lint
```

当前用户、房间和棋局存储在服务端内存中，服务重启后会清空。正式运营前应替换为数据库、持久化会话和限流。
