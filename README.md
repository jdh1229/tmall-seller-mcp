# 天猫商家登录 MCP

一个用于自动登录天猫/淘宝商家后台的 MCP (Model Context Protocol) 服务器。

## 功能特性

- ✅ 自动登录天猫/淘宝商家后台
- ✅ 支持多店铺账号管理
- ✅ 本地存储账号信息（安全加密）
- ✅ 跨平台支持（Windows/macOS/Linux）
- ✅ 页面导航、内容获取、元素点击/输入
- ✅ 截图功能

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/tmall-seller-mcp.git
cd tmall-seller-mcp
```

### 2. 安装依赖

```bash
npm install
```

### 3. 安装 Chrome 浏览器

MCP 需要 Chrome 浏览器来运行。可以通过以下方式之一安装：

**方式一：使用 agent-browser（推荐）**
```bash
npm install -g agent-browser
agent-browser install
```

**方式二：手动安装 Chrome**
- 下载并安装 [Google Chrome](https://www.google.com/chrome/)

### 4. 配置 MCP

在你的 MCP 客户端配置文件中添加：

```json
{
  "mcpServers": {
    "tmall-seller-mcp": {
      "command": "node",
      "args": ["/path/to/tmall-seller-mcp/src/index.js"]
    }
  }
}
```

将 `/path/to/tmall-seller-mcp` 替换为实际路径。

## 使用方法

### 1. 保存账号

首次使用需要保存账号：

```javascript
// 调用 tmall_save_account 工具
{
  "username": "你的店铺账号",
  "password": "你的密码",
  "shopName": "店铺名称（可选）"
}
```

账号信息会加密存储在 `~/.workbuddy/tmall-seller-accounts.json`。

### 2. 登录

```javascript
// 调用 tmall_login 工具
{
  "username": "你的店铺账号",
  "password": "你的密码"
}
```

### 3. 其他操作

#### 检查登录状态
```javascript
tmall_check_login()
```

#### 导航到页面
```javascript
tmall_navigate({
  url: "https://myseller.taobao.com/home.htm/comment-manage/list/rateWait4PC"
})
```

#### 获取页面内容
```javascript
tmall_get_content({
  selector: "CSS选择器（可选）"
})
```

#### 点击元素
```javascript
tmall_click({
  selector: "CSS选择器"
})
```

#### 输入文本
```javascript
tmall_type({
  selector: "CSS选择器",
  text: "要输入的文本"
})
```

#### 截图
```javascript
tmall_screenshot({
  path: "截图保存路径（可选）"
})
```

## 安全说明

- ✅ 账号密码仅存储在本地，不会上传到任何服务器
- ✅ 使用 AES-256-GCM 加密存储账号信息
- ✅ 加密密钥存储在系统环境变量中
- ✅ 支持多账号管理，每个账号独立加密

## 跨平台支持

MCP 会自动检测以下位置的 Chrome 浏览器：

**Windows:**
- `~/.agent-browser/browsers/chrome-*/chrome.exe`
- `C:\Program Files\Google\Chrome\Application\chrome.exe`

**macOS:**
- `~/.agent-browser/browsers/chrome/chrome-mac/Chromium.app`
- `/Applications/Google Chrome.app`

**Linux:**
- `~/.agent-browser/browsers/chrome/chrome-linux/chrome`
- `/usr/bin/google-chrome`

## 开发

```bash
# 启动 MCP 服务器
npm start

# 运行测试
npm test
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 注意事项

- 本工具仅供学习和研究使用
- 请遵守天猫/淘宝的使用条款
- 不要将账号信息分享给他人
- 定期更换密码以保证安全
