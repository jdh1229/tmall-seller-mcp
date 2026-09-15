import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import BrowserManager from './browser.js';

const browserManager = new BrowserManager();

// 定义 MCP 服务器
const server = new Server({
  name: 'tmall-seller-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'tmall_login',
        description: '登录天猫/淘宝商家后台。首次使用需要提供账号密码，之后会自动保存并复用。',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: '店铺账号（如：立邦官方旗舰店:松鼠）'
            },
            password: {
              type: 'string',
              description: '登录密码'
            },
            shopName: {
              type: 'string',
              description: '店铺名称（可选，用于标识）'
            }
          },
          required: ['username', 'password']
        }
      },
      {
        name: 'tmall_check_login',
        description: '检查当前登录状态',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'tmall_navigate',
        description: '导航到指定页面（需要先登录）',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: '目标页面 URL'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'tmall_get_content',
        description: '获取页面内容（需要先登录）',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS 选择器（可选，不填则获取整个页面）'
            }
          }
        }
      },
      {
        name: 'tmall_click',
        description: '点击页面元素（需要先登录）',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS 选择器'
            }
          },
          required: ['selector']
        }
      },
      {
        name: 'tmall_type',
        description: '在输入框中填写文本（需要先登录）',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS 选择器'
            },
            text: {
              type: 'string',
              description: '要填写的文本'
            }
          },
          required: ['selector', 'text']
        }
      },
      {
        name: 'tmall_screenshot',
        description: '截取当前页面截图（需要先登录）',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '截图保存路径（可选，默认保存到当前目录）'
            }
          }
        }
      },
      {
        name: 'tmall_get_accounts',
        description: '获取已保存的所有店铺账号',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'tmall_save_account',
        description: '保存店铺账号（不登录，仅保存）',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: '店铺账号'
            },
            password: {
              type: 'string',
              description: '登录密码'
            },
            shopName: {
              type: 'string',
              description: '店铺名称'
            }
          },
          required: ['username', 'password']
        }
      },
      {
        name: 'tmall_close',
        description: '关闭浏览器',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'tmall_login': {
        const { username, password, shopName } = args;
        
        // 保存账号
        browserManager.saveAccount(username, password, shopName);
        
        // 执行登录
        const result = await browserManager.login(username, password);
        
        return {
          content: [
            {
              type: 'text',
              text: `登录成功！\n账号: ${result.username}\n当前页面: ${result.url}`
            }
          ]
        };
      }

      case 'tmall_check_login': {
        const status = await browserManager.checkLoginStatus();
        
        return {
          content: [
            {
              type: 'text',
              text: status.loggedIn 
                ? `已登录\n账号: ${status.account}\n当前页面: ${status.url}`
                : `未登录: ${status.message}`
            }
          ]
        };
      }

      case 'tmall_navigate': {
        const { url } = args;
        const result = await browserManager.navigate(url);
        
        return {
          content: [
            {
              type: 'text',
              text: `导航成功\nURL: ${result.url}\n标题: ${result.title}`
            }
          ]
        };
      }

      case 'tmall_get_content': {
        const { selector } = args || {};
        const content = await browserManager.getPageContent(selector);
        
        return {
          content: [
            {
              type: 'text',
              text: content.substring(0, 10000) // 限制返回内容长度
            }
          ]
        };
      }

      case 'tmall_click': {
        const { selector } = args;
        await browserManager.click(selector);
        
        return {
          content: [
            {
              type: 'text',
              text: `点击成功: ${selector}`
            }
          ]
        };
      }

      case 'tmall_type': {
        const { selector, text } = args;
        await browserManager.type(selector, text);
        
        return {
          content: [
            {
              type: 'text',
              text: `填写成功: ${selector}`
            }
          ]
        };
      }

      case 'tmall_screenshot': {
        const { path } = args || {};
        const screenshotPath = path || `screenshot-${Date.now()}.png`;
        const result = await browserManager.screenshot(screenshotPath);
        
        return {
          content: [
            {
              type: 'text',
              text: `截图已保存: ${result.path}`
            }
          ]
        };
      }

      case 'tmall_get_accounts': {
        const accounts = browserManager.getAccounts();
        
        if (accounts.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '暂无保存的账号'
              }
            ]
          };
        }
        
        const list = accounts.map((a, i) => 
          `${i + 1}. ${a.shopName || a.username}\n   账号: ${a.username}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `已保存的账号:\n\n${list}`
            }
          ]
        };
      }

      case 'tmall_save_account': {
        const { username, password, shopName } = args;
        browserManager.saveAccount(username, password, shopName);
        
        return {
          content: [
            {
              type: 'text',
              text: `账号已保存: ${username}`
            }
          ]
        };
      }

      case 'tmall_close': {
        await browserManager.close();
        
        return {
          content: [
            {
              type: 'text',
              text: '浏览器已关闭'
            }
          ]
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `错误: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('天猫商家登录 MCP 服务器已启动');
}

main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', async () => {
  await browserManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browserManager.close();
  process.exit(0);
});
