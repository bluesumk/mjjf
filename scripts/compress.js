/**
 * 微信小程序代码压缩脚本
 * 用于在发布前压缩 JavaScript 文件，减少代码包体积
 */
const fs = require('fs');
const path = require('path');

// 压缩函数 - 移除注释和多余空白
function compressJS(content) {
  return content
    // 移除单行注释
    .replace(/\/\/.*$/gm, '')
    // 移除多行注释
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 移除多余的空白行
    .replace(/\n\s*\n/g, '\n')
    // 移除行首尾空白
    .replace(/^\s+|\s+$/gm, '')
    // 压缩空白字符
    .replace(/\s+/g, ' ')
    // 移除分号前的空格
    .replace(/\s*;\s*/g, ';')
    // 移除逗号前后的空格
    .replace(/\s*,\s*/g, ',')
    // 移除括号内外的空格
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .replace(/\s*\{\s*/g, '{')
    .replace(/\s*\}\s*/g, '}')
    .replace(/\s*\[\s*/g, '[')
    .replace(/\s*\]\s*/g, ']')
    // 移除操作符前后的空格
    .replace(/\s*=\s*/g, '=')
    .replace(/\s*\+\s*/g, '+')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\*\s*/g, '*')
    .replace(/\s*\/\s*/g, '/')
    // 移除冒号前后的空格
    .replace(/\s*:\s*/g, ':');
}

// 压缩单个JS文件
function compressJSFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const compressed = compressJS(content);
      const originalSize = Buffer.byteLength(content, 'utf8');
      const compressedSize = Buffer.byteLength(compressed, 'utf8');
      const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      
      // 创建备份
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, content);
      
      // 写入压缩后的内容
      fs.writeFileSync(filePath, compressed);
      
      console.log(`✅ 压缩完成: ${filePath}`);
      console.log(`   原始大小: ${originalSize} bytes`);
      console.log(`   压缩后: ${compressedSize} bytes`);
      console.log(`   减少: ${reduction}%\n`);
    }
  } catch (error) {
    console.error(`❌ 压缩失败: ${filePath}`, error.message);
  }
}

// 递归遍历目录压缩JS文件
function compressDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules 和 .git 目录
      if (item !== 'node_modules' && item !== '.git' && item !== 'scripts') {
        compressDirectory(itemPath);
      }
    } else if (item.endsWith('.js')) {
      compressJSFile(itemPath);
    }
  });
}

// 主压缩函数
function main() {
  console.log('🚀 开始压缩 JavaScript 文件...\n');
  
  // 压缩 app.js
  compressJSFile('app.js');
  
  // 压缩 pages 目录下的所有 JS 文件
  if (fs.existsSync('pages')) {
    compressDirectory('pages');
  }
  
  // 压缩 utils 目录下的所有 JS 文件
  if (fs.existsSync('utils')) {
    compressDirectory('utils');
  }
  
  console.log('✨ 所有 JavaScript 文件压缩完成！');
  console.log('💡 备份文件已保存为 .backup 后缀');
  console.log('⚠️  请在发布前测试确保功能正常');
}

// 恢复备份的函数
function restoreBackup() {
  console.log('🔄 开始恢复备份文件...\n');
  
  function restoreDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    
    const items = fs.readdirSync(dirPath);
    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        if (item !== 'node_modules' && item !== '.git' && item !== 'scripts') {
          restoreDirectory(itemPath);
        }
      } else if (item.endsWith('.js.backup')) {
        const originalPath = itemPath.replace('.backup', '');
        const content = fs.readFileSync(itemPath, 'utf8');
        fs.writeFileSync(originalPath, content);
        fs.unlinkSync(itemPath); // 删除备份文件
        console.log(`✅ 恢复: ${originalPath}`);
      }
    });
  }
  
  // 恢复 app.js
  if (fs.existsSync('app.js.backup')) {
    const content = fs.readFileSync('app.js.backup', 'utf8');
    fs.writeFileSync('app.js', content);
    fs.unlinkSync('app.js.backup');
    console.log('✅ 恢复: app.js');
  }
  
  restoreDirectory('pages');
  restoreDirectory('utils');
  
  console.log('\n✨ 所有文件已恢复到压缩前状态！');
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.includes('--restore')) {
  restoreBackup();
} else {
  main();
}

