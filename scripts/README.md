# 微信小程序优化脚本

本目录包含用于优化微信小程序性能的脚本和配置。

## 功能特性

### 1. 代码压缩 (compress.js)
- 自动压缩所有 JavaScript 文件
- 移除注释和多余空白
- 减少代码包体积
- 自动创建备份文件

### 2. 组件按需注入
- 已在 `app.json` 和 `project.config.json` 中配置
- 启用 `lazyCodeLoading: "requiredComponents"`
- 仅加载页面实际使用的组件

## 使用方法

### 代码压缩

#### 压缩所有JS文件：
```bash
node scripts/compress.js
```

#### 恢复备份文件：
```bash
node scripts/compress.js --restore
```

### 配置说明

#### project.config.json 配置
```json
{
  "setting": {
    "minifyJS": true,      // 启用 JS 压缩
    "minifyWXML": true,    // 启用 WXML 压缩
    "minifyWXSS": true,    // 启用 WXSS 压缩
    "bundle": false        // 禁用代码合并（推荐）
  },
  "lazyCodeLoading": "requiredComponents"  // 启用按需注入
}
```

#### app.json 配置
```json
{
  "lazyCodeLoading": "requiredComponents"
}
```

## 优化效果

### 代码压缩
- **文件体积减少**: 通常可减少 20-40% 的 JS 文件大小
- **加载速度提升**: 更小的文件体积意味着更快的下载和解析
- **网络消耗降低**: 减少用户流量消耗

### 组件按需注入
- **启动速度提升**: 仅加载必要组件，减少初始化时间
- **内存占用降低**: 减少不必要的组件实例化
- **包体积优化**: 未使用的组件代码不会被打包

## 注意事项

1. **备份重要性**: 
   - 脚本会自动创建 `.backup` 备份文件
   - 发布前请确保功能正常
   - 如有问题可使用 `--restore` 恢复

2. **测试验证**:
   - 压缩后务必进行完整功能测试
   - 检查所有页面和交互是否正常
   - 验证数据流和页面跳转

3. **发布流程**:
   ```bash
   # 1. 压缩代码
   node scripts/compress.js
   
   # 2. 测试功能
   # 在微信开发者工具中进行完整测试
   
   # 3. 上传发布
   # 使用微信开发者工具上传代码
   
   # 4. 恢复开发环境（可选）
   node scripts/compress.js --restore
   ```

## 性能监控

### 代码包体积监控
- 关注上传时的包体积大小
- 确保单个包不超过 2MB 限制
- 监控各页面的代码分布

### 启动性能监控
- 使用微信开发者工具的性能面板
- 关注页面首次渲染时间
- 监控组件加载时间

## 故障排除

### 压缩后功能异常
```bash
# 立即恢复备份
node scripts/compress.js --restore

# 检查错误日志
# 根据具体错误调整压缩规则
```

### 组件按需注入问题
- 检查 `app.json` 中的 `lazyCodeLoading` 配置
- 确保基础库版本 >= 2.11.1
- 验证组件引用路径正确性

## 更新记录

- **v1.0.0**: 初始版本，支持 JS 代码压缩和组件按需注入
