import { defineConfig, presetUno } from 'unocss'

// 语义色阶：值取自 Tailwind 默认调色板（与 presetUno 内置一致），便于核对
const indigo = {
  50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
  400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
  800: '#3730a3', 900: '#312e81',
}
const red = {
  50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
  400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
  800: '#991b1b', 900: '#7f1d1d',
}
const green = {
  50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
  400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
  800: '#166534', 900: '#14532d',
}
const slate = {
  50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
  400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
  800: '#1e293b', 900: '#0f172a',
}

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      brand: indigo,      // 主色·交互：链接 / 激活 / 累计折线 / 锚点 / 拖拽线
      positive: red,      // 中式正向：收入 / 差额增长 / 图表收入
      negative: green,    // 中式负向：支出 / 差额下降 / 图表支出
      success: green,     // 操作成功（固定，不随中西式变）
      danger: red,        // 操作失败 / 删除（固定）
      neutral: slate,     // 中性：底 / 文字 / 边框 / 表头 / hover
    },
  },
})
