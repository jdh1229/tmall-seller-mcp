# 天猫商家登录 MCP 服务器

自动登录天猫/淘宝商家后台的 MCP (Model Context Protocol) 服务器，支持会话保持、页面操作、多店铺账号管理。

## 快速开始

### 前置条件

- **Node.js** >= 18（[下载](https://nodejs.org)）
- **Chrome 浏览器**（会自动检测以下路径）
  - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - macOS: `/Applications/Google Chrome.app`
  - Linux: `/usr/bin/google-chrome`

### 安装

**方式一：一键安装（推荐）**

1. 从 [Releases](https://github.com/jdh1229/tmall-seller-mcp/releases) 下载最新 ZIP 包
2. 解压到任意目录
3. 双击 `install.bat`（Windows）或运行 `./install.sh`（macOS/Linux）
4. 安装完成后，将项目路径配置到你的 AI 工具中

**方式二：从源码安装**

```bash
git clone https://github.com/jdh1229/tmall-seller-mcp.git
cd tmall-seller-mcp
npm install
```

### 配置

在你的 AI 工具（WorkBuddy / 千问办公 / Claude Desktop 等）的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "tmall-seller-mcp": {
      "command": "node",
      "args": ["<项目路径>/src/index.js"]
    }
  }
}
```

将 `<项目路径>` 替换为你实际解压/克隆的目录，例如：
- Windows: `C:\\Users\\你的用户名\\Desktop\\tmall-seller-mcp\\src\\index.js`
- macOS/Linux: `/Users/你的用户名/tmall-seller-mcp/src/index.js`

### 使用

配置完成后重启 AI 工具，直接对话即可：

- "帮我登录天猫商家后台"
- "查看今天的评价"
- "截图当前页面"

首次登录需要提供店铺账号和密码，之后会自动保存并复用。

---

## 技术文档

### 架构

```
┌──────────────┐     MCP 协议      ┌──────────────────┐    Playwright    ┌──────────────┐
│  AI 客户端    │ ◄──────────────► │  MCP 服务器       │ ◄──────────────► │  Chrome      │
│ (WorkBuddy等) │                  │ (src/index.js)    │                  │  浏览器      │
└──────────────┘                   └──────────────────┘                  └──────────────┘
```

### 工具列表

#### 基础操作

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `tmall_login` | 登录商家后台 | `username`: 店铺账号, `password`: 密码, `shopName?`: 店铺名称 |
| `tmall_check_login` | 检查当前登录状态 | 无 |
| `tmall_navigate` | 导航到指定页面 | `url`: 目标页面 URL |
| `tmall_get_content` | 获取页面内容 | `selector?`: CSS 选择器（不填则获取整个页面） |
| `tmall_click` | 点击页面元素 | `selector`: CSS 选择器 |
| `tmall_type` | 在输入框中填写文本 | `selector`: CSS 选择器, `text`: 文本内容 |
| `tmall_screenshot` | 截取当前页面截图 | `path?`: 截图保存路径 |
| `tmall_execute_js` | 执行 JavaScript 代码 | `script`: JS 代码字符串 |
| `tmall_wait` | 等待指定时间 | `ms`: 等待毫秒数 |
| `tmall_close` | 关闭浏览器 | 无 |

#### 账号管理

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `tmall_get_accounts` | 获取已保存的所有店铺账号 | 无 |
| `tmall_save_account` | 保存店铺账号（不登录） | `username`: 店铺账号, `password`: 密码, `shopName?`: 店铺名称 |

#### 评价管理

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `tmall_filter_reviews` | 筛选评价（自动清除旧条件后搜索） | `date?`: today/yesterday/7days/30days, `sentiment?`: positive/negative/neutral, `contentType?`: ["有内容","有图片","有视频","有追评"], `replyStatus?`: 已回复/未回复, `keyword?`: 搜索关键词 |
| `tmall_get_review_list` | 获取当前页面的评价列表（结构化数据） | 无 |
| `tmall_reply_review` | 回复单条评价 | `reviewIndex`: 评价索引（从 0 开始）, `replyText`: 回复内容（最多 500 字） |

**评价管理使用示例：**

```
// 查看今天的负面评价
tmall_navigate({ url: "https://myseller.taobao.com/home.htm/comment-manage/list/rateWait4PC" })
tmall_filter_reviews({ date: "today", sentiment: "negative" })
tmall_get_review_list()

// 回复第一条正面评价
tmall_filter_reviews({ sentiment: "positive" })
tmall_reply_review({ reviewIndex: 0, replyText: "感谢您的好评！" })
```

> 后续将陆续添加订单管理、商品管理、退款管理等页面的专用工具。

### 数据存储

- **账号信息**: `~/.workbuddy/tmall-seller-accounts.json`
- **会话状态**: `~/.workbuddy/tmall-seller-states/<用户名>.json`
- **调试截图**: 系统临时目录下的 `tmall-seller-mcp-debug/`

### 开发

```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 运行测试
npm test
```

### 安全

- 账号密码仅存储在本地文件系统
- 不上传到任何外部服务器
- 每个账号的会话状态独立存储
- 使用 Playwright 的 `storageState` 管理 cookie/session

### 跨平台

Chrome 路径自动检测逻辑见 `src/browser.js` 的 `findChromePath()` 函数。

---

## 许可证

MIT

## 注意事项

- 本工具仅供学习和研究使用
- 请遵守天猫/淘宝的使用条款
- 不要将账号信息分享给他人
