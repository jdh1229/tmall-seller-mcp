import { spawn } from 'child_process';

const server = spawn('node', ['src/index.js'], {
  cwd: 'D:\\WorkBuddy工作区域\\2026-09-15-13-36-10\\tmall-seller-mcp'
});

let response = '';

server.stdout.on('data', (data) => {
  response += data.toString();
  console.log('收到响应:', data.toString());
});

server.stderr.on('data', (data) => {
  console.error('服务器日志:', data.toString());
});

// 发送初始化请求
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// 发送工具列表请求
setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  server.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1000);

// 5秒后关闭
setTimeout(() => {
  server.kill();
  console.log('\n测试完成');
}, 5000);
