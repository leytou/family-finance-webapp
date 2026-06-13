# 数据导出与导入功能设计

## 概述

为家庭财务规划应用添加数据导出和导入功能，主要场景是**数据备份与恢复**。用户可以将完整的财务规划数据导出为 JSON 文件保存，并在需要时导入恢复。

## 方案选择

**纯前端 JSON 下载/上传方案**——利用浏览器的 `<a download>` 和 `<input type="file">` 实现导出下载与导入上传，完全在客户端完成，零外部依赖。

选择理由：
- 与现有 localStorage 架构完美契合
- 财务数据量小（通常 < 50KB），无需压缩
- 实现简单可靠，兼容所有现代浏览器

## 数据流设计

### 导出流程

```
用户点击「导出数据」
  → 从 localStorage 读取完整 Workspace JSON
  → 包装为导出格式（添加元信息）
  → 创建 Blob + 临时 <a download> 链接触发下载
  → 文件名：family-finance-plan-YYYYMMDD.json
```

### 导入流程

```
用户点击「导入数据」
  → 触发隐藏的 <input type="file" accept=".json">
  → 用户选择文件
  → FileReader 读取 JSON 内容
  → 数据校验（JSON 格式、结构完整性、版本兼容）
  → 校验通过 → 确认对话框（提示将替换当前所有数据）
  → 用户确认 → 写入 localStorage → 刷新页面状态
  → 校验失败 → 显示错误提示
```

### 导出文件格式

导出的 JSON 在 Workspace 外包装一层元信息，与 localStorage 内部格式解耦：

```json
{
  "exportVersion": 1,
  "exportTime": "2026-06-13T10:30:00.000Z",
  "data": {
    "version": 1,
    "scenarios": [
      {
        "id": "...",
        "name": "默认方案",
        "plan": {
          "version": 2,
          "systemParams": { ... },
          "columns": [ ... ],
          "anchors": [ ... ],
          "snapshots": [ ... ]
        }
      }
    ],
    "activeId": "..."
  }
}
```

包装层的好处：未来内部格式变化时，导入可以根据 `exportVersion` 做版本迁移。

## UI 设计

### 「更多」下拉菜单

在标题栏添加一个「⋯」按钮，点击展开下拉菜单：

```
┌─────────────────────────────────┐
│  ⋯                              │  ← 更多按钮
├─────────────────────────────────┤
│  📤 导出数据                    │
│  📥 导入数据                    │
│  ───────────────                │
│  🔄 重置数据                    │
└─────────────────────────────────┘
```

### 交互细节

- **导出**：点击后直接下载，给简短成功提示
- **导入**：选择文件后弹出确认对话框「导入将替换当前所有数据，确定继续吗？」
- **重置**：保持现有确认对话框行为，从原位置迁移到此菜单
- 点击菜单项后自动关闭菜单
- 点击菜单外部区域自动关闭（复用 `useClickOutside`）

## 组件与代码结构

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/composables/useFileIO.ts` | 文件导入导出逻辑 composable |
| `src/components/ToolsMenu.vue` | 更多菜单组件 |
| `tests/useFileIO.test.ts` | 导入导出单元测试 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `src/App.vue` | 集成 ToolsMenu 组件，移除现有的重置逻辑到菜单中 |

### useFileIO.ts API 设计

```typescript
interface ExportResult {
  success: boolean
  error?: string
}

interface ImportResult {
  success: boolean
  error?: string
}

function useFileIO() {
  // 导出：生成 JSON 并触发下载
  function exportData(): ExportResult

  // 导入：校验并导入文件内容
  async function importData(file: File): Promise<ImportResult>

  return { exportData, importData }
}
```

### 数据校验逻辑

导入时执行以下校验：
1. 文件是否为 JSON 格式（JSON.parse 成功）
2. 是否包含 `exportVersion` 和 `data` 字段
3. `data` 是否包含有效的 Workspace 结构（`version`、`scenarios`、`activeId`）
4. 每个方案是否包含 `id`、`name`、`plan` 字段

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 选择非 JSON 文件 | 提示「请选择有效的 JSON 文件」 |
| JSON 解析失败 | 提示「文件内容无法解析」 |
| 缺少必需字段 | 提示「文件格式不正确，缺少必需数据」 |
| 版本号不匹配 | 尝试兼容迁移，失败则提示版本过旧/过新 |
| 导入确认取消 | 无操作，关闭对话框 |

## 测试策略

### 单元测试（tests/useFileIO.test.ts）

- `exportData()` 生成正确的 JSON 结构（含 exportVersion、exportTime、data）
- `importData()` 正确解析有效导出文件并返回 workspace 数据
- `importData()` 拒绝非 JSON 文件
- `importData()` 拒绝格式错误的 JSON（缺少 exportVersion 或 data）
- `importData()` 拒绝 data 内部结构不完整的文件
- `importData()` 接受合法的最小化 workspace

### 手动验证

导出 → 清空 localStorage → 导入 → 确认数据完整恢复（所有方案、列、锚点、快照均保留）
