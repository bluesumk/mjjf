#!/bin/bash

# Git 自动提交脚本 v2.0
# 用途：一键执行完整的 git 流程，把最新改动推到远端
# 功能：检查分支、添加文件、提交、推送、显示结果

echo "🚀 开始执行 Git 自动提交流程..."
echo "================================="

# 1. 显示当前分支（确认不在 main 上）
current_branch=$(git branch --show-current)
echo "📍 当前分支: $current_branch"

if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
    echo "⚠️  警告：当前在主分支 ($current_branch) 上！"
    read -p "确定要在主分支上提交吗？(y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "❌ 取消提交，请切换到功能分支后重试"
        exit 1
    fi
fi

# 2. 检查是否有变更
echo ""
echo "🔍 检查工作区状态..."
git_status=$(git status --porcelain)

if [ -z "$git_status" ]; then
    echo "✅ 无更新，无需提交"
    echo ""
    echo "📄 当前最新提交："
    git log -1 --oneline
    exit 0
fi

echo "📝 发现以下变更："
git status --short

# 3. 执行 git add .（包括未跟踪文件）
echo ""
echo "📦 添加所有变更到暂存区..."
git add .

# 确认暂存区状态
staged_files=$(git diff --cached --name-only | wc -l)
echo "✅ 已添加 $staged_files 个文件到暂存区"

# 4. 生成 commit message（使用今天日期）
current_time=$(date "+%Y-%m-%d %H:%M")
commit_message="fix: auto commit $current_time"

echo ""
echo "💾 执行提交..."
echo "📝 Commit message: $commit_message"

git commit -m "$commit_message"

if [ $? -eq 0 ]; then
    echo "✅ 提交成功"
else
    echo "❌ 提交失败"
    exit 1
fi

# 5. 推送到远端当前分支
echo ""
echo "🚀 推送到远端分支: origin/$current_branch"

# 尝试推送，失败时重试一次
push_attempt=1
max_attempts=2

while [ $push_attempt -le $max_attempts ]; do
    if git push origin "$current_branch"; then
        echo "✅ 推送成功"
        break
    else
        if [ $push_attempt -eq $max_attempts ]; then
            echo "❌ 推送失败（已重试 $max_attempts 次）"
            echo "💡 请检查网络连接或手动执行: git push origin $current_branch"
            exit 1
        else
            echo "⚠️  推送失败，正在重试... (尝试 $push_attempt/$max_attempts)"
            sleep 2
            push_attempt=$((push_attempt + 1))
        fi
    fi
done

# 6. 显示远端分支的最新 commit 信息
echo ""
echo "📄 远端最新提交信息："
git log -1 --oneline origin/"$current_branch" 2>/dev/null || git log -1 --oneline

echo ""
echo "🎉 Git 自动提交流程完成！"
echo "================================="




