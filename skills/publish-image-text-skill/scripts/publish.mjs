#!/usr/bin/env node

/**
 * Xiaohongshu Image/Text Publish Script
 * Publishes image/text content to Xiaohongshu via MCP protocol
 */

import { execSync } from 'child_process';

const MCP_URL = process.env.XIAOHONGSHU_MCP_URL || 'http://127.0.0.1:18060/mcp';

function runCurl(args) {
  return execSync(`curl -s ${args}`, { encoding: 'utf-8' });
}

function main() {
  try {
    // Read parameters from environment
    const title = process.env.XIAOHONGSHU_TITLE;
    const content = process.env.XIAOHONGSHU_CONTENT;
    const imagesStr = process.env.XIAOHONGSHU_IMAGES || '[]';
    const tagsStr = process.env.XIAOHONGSHU_TAGS || '[]';

    if (!title || !content) {
      console.error('❌ 错误: XIAOHONGSHU_TITLE 和 XIAOHONGSHU_CONTENT 是必需的');
      process.exit(1);
    }

    const images = JSON.parse(imagesStr);
    const tags = JSON.parse(tagsStr);

    if (!Array.isArray(images) || images.length === 0) {
      console.error('❌ 错误: 至少需要一张图片');
      process.exit(1);
    }

    console.log('正在初始化 MCP 会话...\n');

    // Step 1: Initialize and get session ID
    const initResponse = runCurl(`-D - ${MCP_URL} -X POST \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"publish-image-text-skill","version":"1.0"}}}'`);

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

    // Step 3: Check login status first
    console.log('检查登录状态...');
    const loginResult = runCurl(`${MCP_URL} -X POST \
      -H "Content-Type: application/json" \
      -H "Mcp-Session-Id: ${sessionId}" \
      -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_login_status","arguments":{}}}'`);

    const loginData = JSON.parse(loginResult);
    const loginText = loginData.result?.content?.[0]?.text;

    if (!loginText || !loginText.includes('✅')) {
      console.error('❌ 错误: 未登录。请先运行 check-login-skill 进行登录。');
      process.exit(1);
    }
    console.log('✅ 登录状态: 正常\n');

    // Step 4: Publish content
    console.log('正在发布内容...');
    const publishPayload = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'publish_content',
        arguments: {
          title,
          content,
          images,
          tags,
        }
      }
    };

    const publishResult = runCurl(`${MCP_URL} -X POST \
      -H "Content-Type: application/json" \
      -H "Mcp-Session-Id: ${sessionId}" \
      -d '${JSON.stringify(publishPayload)}'`);

    const publishData = JSON.parse(publishResult);
    const publishText = publishData.result?.content?.[0]?.text;

    console.log('✅ 发布成功！');
    console.log(publishText);

  } catch (error) {
    console.error('\n❌ 发布失败:', error.message);
    process.exit(1);
  }
}

main();
