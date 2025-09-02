# 热修复补丁集合

## 补丁应用顺序建议
1. **[SHARE-BTN]** - 修复分享按钮变量名（优先级：高）
2. **[ENV]** - 统一云开发环境配置（优先级：中）

---

## [SHARE-BTN] 修复分享按钮变量名

### 问题描述
分享按钮使用了未定义的 `canShare` 变量，应该使用已有的 `shareReady` 变量。

### 补丁内容

**文件: pages/session/create/index.wxml**
```diff
        <!-- 仅当可分享时渲染按钮；不再使用 disabled -->
-       <button wx:if="{{canShare}}"
+       <button wx:if="{{shareReady}}"
                id="shareBtn"
                class="share-btn"
                open-type="share">分享邀请</button>
        <!-- 不可点时用 view 占位，防止布局跳动 -->
-       <view wx:else class="share-btn share-btn--disabled">分享邀请</view>
+       <view wx:else class="share-btn share-btn--disabled">分享邀请</view>
      </view>
    </view>
    
    <!-- QA-FIX: B3 邀请码模块隐藏 -->
    <view wx:if="{{false}}" class="invite-code-section">
      <text class="code-label">邀请码：</text>
      <text class="invite-code">{{inviteCode || '生成中...'}}</text>
      <button size="mini" class="copy-btn" bindtap="copyInviteCode" disabled="{{!inviteCode}}">复制</button>
    </view>
  </view>
  
  <!-- 开始记分按钮 -->
  <view class="start-btn-section">
    <button type="primary" class="start-btn" bindtap="startScoring" disabled="{{participants.length === 0}}">开始计分</button>
  </view>
  
  <!-- 新增参与者弹窗 -->
  <!-- 蒙层：禁止穿透滚动 -->
  <view class="modal-mask" wx:if="{{showAddModal}}" catchtouchmove="true">
    <view class="modal-panel">
      <view class="modal-title">添加参与者</view>

      <!-- 输入框：保持既有 bindinput/placeholder，不要改逻辑 -->
      <input class="modal-input"
             placeholder="请输入姓名"
             value="{{newName}}"
             bindinput="inputChange" />

      <view class="modal-actions">
        <button class="btn ghost" bindtap="cancelAdd">取消</button>
        <button class="btn primary" bindtap="confirmAdd">确认</button>
      </view>
    </view>
  </view>

  <!-- 调试用：无任何父级拦截，固定定位在右下角；上线前可删除 -->
- <button wx:if="{{canShare}}"
+ <button wx:if="{{shareReady}}"
          class="share-debug"
          open-type="share">测试分享</button>
```

---

## [ENV] 统一云开发环境配置

### 问题描述
profile云函数使用动态环境变量，而app.js和session云函数使用固定环境ID，可能导致环境不一致。

### 补丁内容

**文件: cloudfunctions/profile/index.js**
```diff
const cloud = require('wx-server-sdk');
- cloud.init({ env: process.env.TCB_ENV || process.env.SCF_NAMESPACE }); // 继承现有环境
+ cloud.init({ env: 'cloudbase-3go6h0x7b3bc5b04' }); // 与app.js保持一致
const db = cloud.database();
const _ = db.command;
const coll = db.collection('users');
const now = () => db.serverDate();
```

---

## 补丁验证步骤

### [SHARE-BTN] 验证步骤
1. 进入"创建牌局"页面
2. 检查分享按钮是否正常显示（生成邀请信息后）
3. 点击分享按钮，确认能弹出微信分享菜单
4. 选择分享给朋友，确认分享卡片内容正确
5. 用另一台设备扫码或点击分享链接，确认能进入加入页面

### [ENV] 验证步骤
1. 在"我的"页面尝试同步微信资料，确认能正常保存到云端
2. 在"编辑资料"页面确认能正常读取云端数据
3. 创建牌局时确认session能正常写入云端
4. 检查云开发控制台，确认所有数据都写入同一环境

---

## 注意事项

1. **不自动应用**: 这些补丁仅作为参考，需要手动逐个应用并测试
2. **回归测试**: 每个补丁应用后都需要进行完整的功能回归测试  
3. **环境备份**: 修改云函数环境配置前，建议先备份现有数据
4. **分批发布**: 建议先修复高优先级的SHARE-BTN问题，验证无误后再处理ENV问题