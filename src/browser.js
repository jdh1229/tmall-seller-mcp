import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { tmpdir } from 'os';

// 跨平台 Chrome 路径检测
function findChromePath() {
  const homeDir = homedir();
  
  // Windows 路径
  if (platform() === 'win32') {
    const winPaths = [
      join(homeDir, '.agent-browser', 'browsers', 'chrome-153.0.8010.36', 'chrome.exe'),
      join(homeDir, '.agent-browser', 'browsers', 'chrome', 'chrome.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    for (const p of winPaths) {
      if (existsSync(p)) return p;
    }
  }
  
  // macOS 路径
  if (platform() === 'darwin') {
    const macPaths = [
      join(homeDir, '.agent-browser', 'browsers', 'chrome', 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
    
    for (const p of macPaths) {
      if (existsSync(p)) return p;
    }
  }
  
  // Linux 路径
  if (platform() === 'linux') {
    const linuxPaths = [
      join(homeDir, '.agent-browser', 'browsers', 'chrome', 'chrome-linux', 'chrome'),
      '/usr/bin/google-chrome',
      '/usr/bin/chromium'
    ];
    
    for (const p of linuxPaths) {
      if (existsSync(p)) return p;
    }
  }
  
  // 如果都没找到，返回默认路径（让 Playwright 自己尝试）
  return undefined;
}

const CHROME_PATH = findChromePath();

// 账号存储路径
const CREDENTIALS_FILE = join(homedir(), '.workbuddy', 'tmall-seller-accounts.json');

// 状态存储路径
const STATE_DIR = join(homedir(), '.workbuddy', 'tmall-seller-states');

// 调试截图路径（使用临时目录）
const DEBUG_DIR = join(tmpdir(), 'tmall-seller-mcp-debug');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.currentAccount = null;
    this.isLoggedIn = false;
  }

  // 加载账号信息
  loadAccounts() {
    if (!existsSync(CREDENTIALS_FILE)) {
      return [];
    }
    try {
      const data = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'));
      return data.accounts || [];
    } catch (e) {
      return [];
    }
  }

  // 保存账号信息
  saveAccount(username, password, shopName) {
    let data = { accounts: [] };
    
    if (existsSync(CREDENTIALS_FILE)) {
      try {
        data = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'));
      } catch (e) {}
    }

    const existing = data.accounts.find(a => a.username === username);
    if (existing) {
      existing.password = password;
      existing.shopName = shopName;
      existing.updatedAt = new Date().toISOString();
    } else {
      data.accounts.push({
        shopName: shopName || username,
        username,
        password,
        createdAt: new Date().toISOString()
      });
    }

    const dir = join(homedir(), '.workbuddy');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2));
  }

  // 获取状态文件路径
  getStatePath(username) {
    if (!existsSync(STATE_DIR)) {
      mkdirSync(STATE_DIR, { recursive: true });
    }
    const safeName = username.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    return join(STATE_DIR, `${safeName}.json`);
  }

  // 启动浏览器
  async launch() {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless: false,
      executablePath: CHROME_PATH,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
  }

  // 创建上下文（带状态恢复）
  async createContext(username) {
    if (this.context) {
      await this.context.close();
    }

    const statePath = this.getStatePath(username);
    const options = {
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // 尝试恢复状态
    if (existsSync(statePath)) {
      try {
        const state = JSON.parse(readFileSync(statePath, 'utf-8'));
        options.storageState = state;
      } catch (e) {
        // 状态文件损坏，忽略
      }
    }

    this.context = await this.browser.newContext(options);
    this.page = await this.context.newPage();
    this.currentAccount = username;
  }

  // 保存状态
  async saveState() {
    if (!this.context || !this.currentAccount) {
      return;
    }

    const statePath = this.getStatePath(this.currentAccount);
    try {
      const state = await this.context.storageState();
      writeFileSync(statePath, JSON.stringify(state));
    } catch (e) {
      // 保存失败，忽略
    }
  }

  // 登录
  async login(username, password) {
    await this.launch();
    await this.createContext(username);

    // 导航到登录页
    console.error('[MCP] 正在导航到登录页...');
    await this.page.goto('https://myseller.taobao.com/home.htm', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // 等待页面完全加载
    console.error('[MCP] 等待页面加载...');
    await this.page.waitForTimeout(5000);
    
    // 调试：打印当前 URL 和所有 frames
    const debugUrl = this.page.url();
    console.error(`[MCP] 当前 URL: ${debugUrl}`);
    
    const allFrames = this.page.frames();
    console.error(`[MCP] 找到 ${allFrames.length} 个 frames:`);
    allFrames.forEach((f, i) => {
      console.error(`  [${i}] ${f.url()}`);
    });

    // 查找登录 iframe（带重试）
    let loginFrame = null;
    for (let i = 0; i < 5; i++) {
      loginFrame = this.page.frames().find(f => 
        f.url().includes('havanalogin.taobao.com') || 
        f.url().includes('login.taobao.com') ||
        f.url().includes('loginmyseller.taobao.com')
      );
      if (loginFrame) {
        console.error(`[MCP] 找到登录 frame: ${loginFrame.url()}`);
        break;
      }
      console.error(`[MCP] 第 ${i + 1} 次重试查找登录 frame...`);
      await this.page.waitForTimeout(2000);
    }
    
    if (!loginFrame) {
      // 截图帮助调试
      if (!existsSync(DEBUG_DIR)) {
        mkdirSync(DEBUG_DIR, { recursive: true });
      }
      const debugPath = join(DEBUG_DIR, `login-debug-${Date.now()}.png`);
      await this.page.screenshot({ path: debugPath });
      console.error(`[MCP] 调试截图已保存到: ${debugPath}`);
      throw new Error(`登录页面未加载。当前 URL: ${debugUrl}，找到 ${allFrames.length} 个 frames，但没有登录相关的 frame。调试截图已保存。`);
    }

    // 切换到密码登录
    try {
      const pwdTab = await loginFrame.$('text=密码登录');
      if (pwdTab) {
        await pwdTab.click();
        await this.page.waitForTimeout(500);
      }
    } catch (e) {}

    // 填写用户名
    const usernameInput = await loginFrame.$('#fm-login-id');
    if (!usernameInput) {
      throw new Error('用户名输入框未找到');
    }
    await usernameInput.click({ clickCount: 3 });
    await usernameInput.fill(username);

    // 填写密码
    const passwordInput = await loginFrame.$('#fm-login-password');
    if (!passwordInput) {
      throw new Error('密码输入框未找到');
    }
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.fill(password);

    await this.page.waitForTimeout(1000);

    // 点击登录
    const loginBtn = await loginFrame.$('button:has-text("登录")');
    if (!loginBtn) {
      throw new Error('登录按钮未找到');
    }
    await loginBtn.click();

    // 等待登录完成
    await this.page.waitForTimeout(5000);

    // 检查登录结果
    const currentUrl = this.page.url();
    if (currentUrl.includes('login')) {
      throw new Error('登录失败，请检查账号密码');
    }

    this.isLoggedIn = true;
    
    // 保存状态
    await this.saveState();

    return {
      success: true,
      url: currentUrl,
      username: username
    };
  }

  // 检查登录状态
  async checkLoginStatus() {
    if (!this.page) {
      return { loggedIn: false, message: '浏览器未启动' };
    }

    const currentUrl = this.page.url();
    if (currentUrl.includes('login')) {
      this.isLoggedIn = false;
      return { loggedIn: false, message: '未登录', url: currentUrl };
    }

    return {
      loggedIn: true,
      message: '已登录',
      url: currentUrl,
      account: this.currentAccount
    };
  }

  // 导航到页面
  async navigate(url) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await this.page.waitForTimeout(2000);

    return {
      url: this.page.url(),
      title: await this.page.title()
    };
  }

  // 获取页面内容
  async getPageContent(selector) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    if (selector) {
      const el = await this.page.$(selector);
      if (!el) {
        throw new Error(`元素未找到: ${selector}`);
      }
      return await el.textContent();
    }

    return await this.page.content();
  }

  // 点击元素
  async click(selector) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    const el = await this.page.$(selector);
    if (!el) {
      throw new Error(`元素未找到: ${selector}`);
    }

    await el.click();
    await this.page.waitForTimeout(1000);

    return { success: true };
  }

  // 输入文本
  async type(selector, text) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    const el = await this.page.$(selector);
    if (!el) {
      throw new Error(`元素未找到: ${selector}`);
    }

    await el.click({ clickCount: 3 });
    await el.fill(text);

    return { success: true };
  }

  // 截图
  async screenshot(path) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    await this.page.screenshot({ path, fullPage: false });
    return { success: true, path };
  }

  // 获取所有账号
  getAccounts() {
    return this.loadAccounts();
  }

  // 执行 JavaScript
  async executeJs(script) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }
    return await this.page.evaluate(script);
  }

  // 等待指定时间
  async wait(ms) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }
    await this.page.waitForTimeout(ms);
    return { success: true, waited: ms };
  }

  // 获取评价列表（结构化数据）
  async getReviewList() {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }
    
    return await this.page.evaluate(() => {
      const result = {};
      
      // 获取总数
      const totalText = document.body.innerText;
      const totalMatch = totalText.match(/共\s*(\d+)\s*条/);
      result.total = totalMatch ? parseInt(totalMatch[1]) : 0;
      
      // 获取评价列表
      const rows = document.querySelectorAll('tr');
      const reviews = [];
      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return;
        
        const review = {};
        
        // 情感分类
        const sentimentCell = cells[1];
        review.sentiment = sentimentCell?.innerText?.trim() || '';
        
        // 评价内容
        const contentCell = cells[2];
        review.content = contentCell?.innerText?.trim() || '';
        
        // 商品信息
        const productCell = cells[3];
        review.product = productCell?.innerText?.trim() || '';
        
        // 买家信息
        const buyerCell = cells[4];
        review.buyer = buyerCell?.innerText?.trim() || '';
        
        // 操作
        const actionCell = cells[5];
        review.actions = actionCell?.innerText?.trim() || '';
        
        // 提取主评ID
        const idMatch = review.content.match(/主评ID[：:]\s*(\d+)/);
        review.reviewId = idMatch ? idMatch[1] : '';
        
        // 提取初次评价时间
        const timeMatch = review.content.match(/初次评价[：:]\s*([\d-]+\s*[\d:]*)/);
        review.time = timeMatch ? timeMatch[1].trim() : '';
        
        // 提取评价正文（去掉元数据）
        const contentLines = review.content.split('\n');
        review.text = contentLines[0] || '';
        
        // 提取订单号
        const orderMatch = review.content.match(/订单号[：:]\s*(\d+)/);
        review.orderId = orderMatch ? orderMatch[1] : '';
        
        if (review.reviewId || review.text) {
          reviews.push(review);
        }
      });
      
      result.reviews = reviews;
      return result;
    });
  }

  // 筛选评价
  async filterReviews(options) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }
    
    const { date, sentiment, contentType, replyStatus, keyword } = options || {};
    const results = [];
    
    // 先清除条件
    try {
      const clearBtn = await this.page.$('button:has-text("清除条件")');
      if (clearBtn) {
        await clearBtn.click();
        await this.page.waitForTimeout(500);
        results.push('已清除条件');
      }
    } catch (e) {}
    
    // 设置日期
    if (date) {
      try {
        const startInput = await this.page.$('input[placeholder*="起始"]');
        if (startInput) {
          await startInput.click();
          await this.page.waitForTimeout(1000);
          
          if (date === 'today') {
            const todayBtn = await this.page.$('text=今天');
            if (todayBtn) {
              await todayBtn.click();
              await this.page.waitForTimeout(500);
              results.push('日期: 今天');
            }
          } else if (date === 'yesterday') {
            const yesterdayBtn = await this.page.$('text=昨天');
            if (yesterdayBtn) {
              await yesterdayBtn.click();
              await this.page.waitForTimeout(500);
              results.push('日期: 昨天');
            }
          } else if (date === '7days') {
            const btn = await this.page.$('text=近7天');
            if (btn) {
              await btn.click();
              await this.page.waitForTimeout(500);
              results.push('日期: 近7天');
            }
          } else if (date === '30days') {
            const btn = await this.page.$('text=近30天');
            if (btn) {
              await btn.click();
              await this.page.waitForTimeout(500);
              results.push('日期: 近30天');
            }
          }
        }
      } catch (e) {
        results.push(`日期设置失败: ${e.message}`);
      }
    }
    
    // 设置情感分类
    if (sentiment) {
      try {
        const sentimentMap = {
          'positive': '正面评价',
          'negative': '负面评价',
          'neutral': '中性评价',
          'all': '全部'
        };
        const sentimentText = sentimentMap[sentiment] || sentiment;
        
        // 打开下拉框
        const trigger = await this.page.$('.next-select-trigger');
        if (trigger) {
          await trigger.click();
          await this.page.waitForTimeout(1000);
          
          const option = await this.page.$(`text=${sentimentText}`);
          if (option) {
            await option.click();
            await this.page.waitForTimeout(500);
            results.push(`情感: ${sentimentText}`);
          }
        }
      } catch (e) {
        results.push(`情感设置失败: ${e.message}`);
      }
    }
    
    // 设置评价内容标签
    if (contentType && Array.isArray(contentType)) {
      for (const tag of contentType) {
        try {
          const tagEl = await this.page.$(`.next-tag:has-text("${tag}")`);
          if (tagEl) {
            await tagEl.click();
            await this.page.waitForTimeout(300);
            results.push(`内容标签: ${tag}`);
          }
        } catch (e) {}
      }
    }
    
    // 设置商家回复状态
    if (replyStatus) {
      try {
        const replyEl = await this.page.$(`.next-tag:has-text("${replyStatus}")`);
        if (replyEl) {
          await replyEl.click();
          await this.page.waitForTimeout(300);
          results.push(`回复状态: ${replyStatus}`);
        }
      } catch (e) {}
    }
    
    // 设置关键词
    if (keyword) {
      try {
        const searchInput = await this.page.$('input[placeholder*="评价关键词"]');
        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await searchInput.fill(keyword);
          results.push(`关键词: ${keyword}`);
        }
      } catch (e) {}
    }
    
    // 点击搜索
    try {
      const searchBtn = await this.page.$('button:has-text("搜索")');
      if (searchBtn) {
        await searchBtn.click();
        await this.page.waitForTimeout(2000);
        results.push('已执行搜索');
      }
    } catch (e) {}
    
    // 获取结果总数
    const totalText = await this.page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/共\s*(\d+)\s*条/);
      return match ? match[1] : '未知';
    });
    results.push(`结果: 共 ${totalText} 条`);
    
    return { success: true, actions: results };
  }

  // 回复单条评价
  async replyReview(reviewIndex, replyText) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }
    
    if (!replyText || replyText.trim().length === 0) {
      throw new Error('回复内容不能为空');
    }
    
    if (replyText.length > 500) {
      throw new Error('回复内容不能超过500字');
    }
    
    // 点击第 N 条评价的回复按钮
    const reviewBtnSelector = `tr:nth-child(${reviewIndex + 1}) .next-btn-primary:has-text("评价")`;
    const reviewBtn = await this.page.$(reviewBtnSelector);
    if (!reviewBtn) {
      throw new Error(`未找到第 ${reviewIndex + 1} 条评价的回复按钮`);
    }
    await reviewBtn.click();
    await this.page.waitForTimeout(1000);
    
    // 输入回复内容
    const textarea = await this.page.$('textarea[placeholder*="请输入"]');
    if (!textarea) {
      throw new Error('未找到回复输入框');
    }
    await textarea.click({ clickCount: 3 });
    await textarea.fill(replyText);
    await this.page.waitForTimeout(500);
    
    // 点击确认提交
    const submitBtn = await this.page.$('button:has-text("确认提交")');
    if (!submitBtn) {
      throw new Error('未找到确认提交按钮');
    }
    await submitBtn.click();
    await this.page.waitForTimeout(2000);
    
    return { 
      success: true, 
      message: `第 ${reviewIndex + 1} 条评价已回复`,
      replyText: replyText
    };
  }

  // 关闭浏览器
  async close() {
    if (this.context) {
      await this.saveState();
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.page = null;
    this.isLoggedIn = false;
    this.currentAccount = null;
  }
}

export default BrowserManager;
