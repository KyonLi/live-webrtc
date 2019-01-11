# live-webrtc

WebRTC连接摄像头方案

## 简介

这是一个基于WebRTC实现主播、刮票口远程连接摄像头的Demo

## 安装和使用

1. 安装Node.js及npm环境
2. 下载源码到本地，修改`public/caster.html`和`public/operator.html`中websocket地址为本机ip
3. 使用命令`npm install`安装所需要的库
4. 运行命令`node server.js`，建议配合`forever`
5. 访问`http://localhost:3000/`查看效果
6. 由于Chrome限制，其他客户端需要反向代理通过`localhost`访问才能调用摄像头