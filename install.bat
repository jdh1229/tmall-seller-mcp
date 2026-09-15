@echo off
chcp 65001 >nul
echo ========================================
echo   天猫商家登录助手 - 一键安装
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org
    echo 安装后重新运行此脚本
    pause
    exit /b 1
)

echo [1/3] 检测到 Node.js 版本:
node -v
echo.

REM 安装依赖
echo [2/3] 正在安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [3/3] 安装完成!
echo.
echo ========================================
echo   下一步: 配置到你的 AI 工具
echo ========================================
echo.
echo 在你的 MCP 配置文件中添加:
echo.
echo {
echo   "mcpServers": {
echo     "tmall-seller-mcp": {
echo       "command": "node",
echo       "args": ["%cd%\src\index.js"]
echo     }
echo   }
echo }
echo.
echo 路径: %cd%\src\index.js
echo.
pause
