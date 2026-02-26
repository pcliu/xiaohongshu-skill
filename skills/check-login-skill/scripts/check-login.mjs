#!/usr/bin/env node

/**
 * Xiaohongshu Login Check Script
 * Checks login status and displays QR code if needed
 */

import { execSync } from 'child_process';
import fs from 'fs';

const MCP_URL = process.env.XIAOHONGSHU_MCP_URL || 'http://127.0.0.1:18060/mcp';

function runCurl(args) {
  return execSync(`curl -s ${args}`, { encoding: 'utf-8' });
}

function main() {
  try {
    console.log('Checking Xiaohongshu login status...\n');

    // Step 1: Initialize and get session ID
    const initResponse = runCurl(`-D - ${MCP_URL} -X POST \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"check-login-skill","version":"1.0"}}}'`);

    const sessionIdMatch = initResponse.match(/mcp-session-id:\s*(.+)/i);
    const sessionId = sessionIdMatch ? sessionIdMatch[1].trim() : null;

    if (!sessionId) {
      throw new Error('Failed to get session ID');
    }

    // Step 2: Send initialized notification
    runCurl(`${MCP_URL} -X POST \
      -H "Content-Type: application/json" \
      -H "Mcp-Session-Id: ${sessionId}" \
      -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'`);

    // Step 3: Check login status
    const loginResult = runCurl(`${MCP_URL} -X POST \
      -H "Content-Type: application/json" \
      -H "Mcp-Session-Id: ${sessionId}" \
      -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_login_status","arguments":{}}}'`);

    const loginData = JSON.parse(loginResult);
    const loginText = loginData.result?.content?.[0]?.text;

    if (!loginText) {
      throw new Error('Invalid login response');
    }

    // Check if logged in by looking for the checkmark
    if (loginText.includes('✅') && loginText.includes('已登录')) {
      console.log('✅ 已登录小红书！');
      console.log(loginText);
      process.exit(0);
    }

    console.log('❌ 未登录小红书，正在获取登录二维码...\n');

    // Step 4: Get QR code
    const qrResult = runCurl(`${MCP_URL} -X POST \
      -H "Content-Type: application/json" \
      -H "Mcp-Session-Id: ${sessionId}" \
      -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_login_qrcode","arguments":{}}}'`);

    const qrData = JSON.parse(qrResult);
    const qrContent = JSON.parse(qrData.result.content[0].text);

    if (qrContent.qrcode) {
      const buffer = Buffer.from(qrContent.qrcode, 'base64');
      const qrPath = '/tmp/xiaohongshu_qrcode.png';
      fs.writeFileSync(qrPath, buffer);
      console.log(`✅ 二维码已保存至: ${qrPath}`);
    }

    if (qrContent.expiresIn) {
      console.log(`\n⏰ 二维码将在 ${qrContent.expiresIn} 秒后过期。`);
    }

    console.log('\n📱 请使用小红书 APP 扫描二维码登录');
    console.log('扫描后请重新运行此脚本检查登录状态。');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
