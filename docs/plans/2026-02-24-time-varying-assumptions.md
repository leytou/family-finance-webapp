# 时间变化假设 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 改造 create_plan.py，使总览表的基本财务假设支持最多 5 次时间变更，月度现金流自动查找当月适用值。

**Architecture:** 在总览表假设区域插入列标题行，向右扩展至 L 列（5次变更 × 2列），假设数据行下移一行；月度现金流中所有引用总览固定值的公式改为嵌套 IF 时间查找公式；五年收支总览的旅游支出改为 SUMIFS 汇总。

**Tech Stack:** Python 3, openpyxl, LibreOffice (recalc.py)

---

### Task 1: 更新总览表假设区域列结构

**Files:**
- Modify: `create_plan.py:152-193`

**Step 1: 明确新列布局**

列映射（A=1 … L=12）：
- A(1): 参数名
- B(2): 初始值（黄底蓝字）
- C(3): 备注
- D(4): 变更1生效(YYYYMM)
- E(5): 变更1值
- F(6): 变更2生效(YYYYMM)
- G(7): 变更2值
- H(8): 变更3生效(YYYYMM)
- I(9): 变更3值
- J(10): 变更4生效(YYYYMM)
- K(11): 变更4值
- L(12): 变更5生效(YYYYMM)
- M(13): 变更5值

**Step 2: 修改 create_plan.py — 假设区域**

找到 `# Section: 基本假设` 块（约第152行），替换为以下代码：

```python
# Section: 基本假设
ws1.merge_cells('A4:M4')
ws1['A4'] = '📋 基本财务假设'
hdr(ws1['A4'], bg=MED_BG, sz=12)
ws1.row_dimensions[4].height = 28

# 子标题行 row 5
sub_hdrs = [
    '参数名', '初始值', '备注',
    '变更1生效\n(YYYYMM)', '变更1值',
    '变更2生效\n(YYYYMM)', '变更2值',
    '变更3生效\n(YYYYMM)', '变更3值',
    '变更4生效\n(YYYYMM)', '变更4值',
    '变更5生效\n(YYYYMM)', '变更5值',
]
sub_col_w = [22, 16, 22, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14]
for i, (h, w) in enumerate(zip(sub_hdrs, sub_col_w), 1):
    c = ws1.cell(row=5, column=i, value=h)
    hdr(c, bg='4472C4', sz=9)
    ws1.column_dimensions[get_column_letter(i)].width = w
ws1.row_dimensions[5].height = 30

# 假设数据从 row 6 开始（原 row 5）
assumptions = [
    ('双方月可支配收入合计', 26000, YUAN, '每月税后可支配收入'),
    ('年终奖（合计）',       46000, YUAN, ''),
    ('当前存款',             380000, YUAN, '截至2026年2月'),
    ('婚前月租金',           2400,  YUAN, '生育前，含停车费'),
    ('生育后月租金',         3900,  YUAN, '孩子出生后搬入更大住所，含停车费'),
    ('月日常开销',           1500,  YUAN, '餐饮/交通/娱乐等'),
    ('孩子月开销',           3000,  YUAN, '奶粉/纸尿裤/早教等（出生后）'),
    ('年度旅游支出',         15000, YUAN, ''),
    ('存款年利率',           0.025, '0.0%', '按年初余额计算，保守型理财参考收益率'),
]

for i, (label, val, fmt, note) in enumerate(assumptions, 6):
    ws1.row_dimensions[i].height = 22
    c_label = ws1.cell(row=i, column=1, value=label)
    c_label.font = Font(bold=True)
    c_label.fill = PatternFill('solid', start_color=LIGHT_BG)
    c_label.alignment = Alignment(horizontal='left', vertical='center', indent=1)

    c_val = ws1.cell(row=i, column=2, value=val)
    inp(c_val)
    c_val.number_format = fmt
    c_val.alignment = Alignment(horizontal='right', vertical='center')
    c_val.fill = PatternFill('solid', start_color=YELLOW_BG)

    c_note = ws1.cell(row=i, column=3, value=note)
    c_note.font = Font(color='595959', size=9)
    c_note.alignment = Alignment(horizontal='left', vertical='center', indent=1)

    # 变更列 D-M：黄底蓝字输入格（空值）
    for col in range(4, 14):
        c = ws1.cell(row=i, column=col, value=None)
        c.fill = PatternFill('solid', start_color=YELLOW_BG)
        inp(c)
        c.alignment = Alignment(horizontal='right', vertical='center')
        # 奇数列（生效年月）用整数格式，偶数列（值）用对应 fmt
        if col % 2 == 0:  # 偶数列 = 值列 (E,G,I,K,M)
            c.number_format = fmt
        else:             # 奇数列 = 年月列 (D,F,H,J,L)
            c.number_format = '0'
```

**Step 3: 运行脚本确认不报错**

```bash
cd /c/Users/10204/Desktop/plan
python create_plan.py
```
预期：`Saved: C:/Users/10204/Desktop/plan/五年规划.xlsx`，无异常。

**Step 4: 提交**

```bash
git add create_plan.py
git commit -m "feat: 总览表假设区域扩展至13列，支持5次时间变更"
```

---

### Task 2: 更新总览表行号引用（五年收支总览区域）

**Files:**
- Modify: `create_plan.py:194-306`

**Step 1: 更新所有硬编码行号**

假设数据行整体 +1（原 row 5-13 → 新 row 6-14），需更新以下引用：

| 原引用 | 新引用 | 含义 |
|--------|--------|------|
| `$B$7` | `$B$8` | 当前存款 |
| `$B$13` | `$B$15` | 存款年利率（行号+1，且子标题行占一行，共+2？）|

注意：假设数据共 9 行，原 rows 5-13，新 rows 6-14。子标题在 row 5。所以：
- 原 B5 → 新 B6（月收入）
- 原 B6 → 新 B7（年终奖）
- 原 B7 → 新 B8（当前存款）
- 原 B8 → 新 B9（婚前租金）
- 原 B9 → 新 B10（生育后租金）
- 原 B10 → 新 B11（日常开销）
- 原 B11 → 新 B12（孩子开销）
- 原 B12 → 新 B13（年度旅游）
- 原 B13 → 新 B14（存款年利率）

五年收支总览区域（原 rows 14-34）整体 +1 → 新 rows 15-35。

**Step 2: 修改五年收支总览区域的行号常量**

找到 `# Section: 五年收支总览` 块，将所有行号 +1：

```python
# Section: 五年收支总览
ws1.merge_cells('A15:F15')
ws1['A15'] = '📊 五年收支总览（2026—2030）'
hdr(ws1['A15'], bg=MED_BG, sz=12)
ws1.row_dimensions[15].height = 28

for i, h in enumerate(['项目','2026年','2027年','2028年','2029年','2030年'], 1):
    c = ws1.cell(row=16, column=i, value=h)
    hdr(c, bg='4472C4', sz=10)
ws1.row_dimensions[16].height = 24

ROW_DEFS = [
    (17,'年初余额',True,LIGHT_BG,False),
    (18,'【收入】',True,None,True),
    (19,'  工资收入',False,None,False),
    (20,'  年终奖',False,None,False),
    (21,'  理财收益',False,None,False),
    (22,'收入小计',True,GREEN_BG,False),
    (23,'【支出】',True,None,True),
    (24,'  房租',False,None,False),
    (25,'  日常开销',False,None,False),
    (26,'  育儿开销',False,None,False),
    (27,'  旅游支出',False,None,False),
    (28,'  【特殊支出】',True,'D6E4F0',False),
    (29,'    结婚',False,None,False),
    (30,'    产检及分娩',False,None,False),
    (31,'',False,GRAY_BG,False),
    (32,'支出小计',True,RED_BG,False),
    (33,'',False,None,False),
    (34,'年度结余（收入−支出）',True,AMBER_BG,False),
    (35,'年末累计余额',True,GREEN_BG,False),
]
```

**Step 3: 更新年度数据填充循环中的行号**

找到 `# 填充年度数据` 循环，将所有行号 +1：

```python
for yi, year in enumerate([2026,2027,2028,2029,2030]):
    col = yi + 2
    cl = get_column_letter(col)

    # 年初余额
    if year == 2026:
        cell(17, '=$B$8', fml, bg_c=YELLOW_BG)   # 当前存款 B8
    else:
        pcl = get_column_letter(col-1)
        cell(17, f'={pcl}35', fml)

    cell(19, f'=SUMIF(月度现金流!B:B,{year},月度现金流!D:D)', lnk)
    cell(20, f'=SUMIF(月度现金流!B:B,{year},月度现金流!E:E)', lnk)
    cell(21, f'=SUMIF(月度现金流!B:B,{year},月度现金流!F:F)', lnk)
    cell(22, f'=SUM({cl}19:{cl}21)', fml, bold=True, bg_c=GREEN_BG)

    cell(24, f'=SUMIF(月度现金流!B:B,{year},月度现金流!H:H)', lnk)
    cell(25, f'=SUMIF(月度现金流!B:B,{year},月度现金流!I:I)', lnk)
    cell(26, f'=SUMIF(月度现金流!B:B,{year},月度现金流!J:J)', lnk)
    # 旅游支出改为从月度现金流汇总
    cell(27, f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"年度旅游")', lnk)
    cell(29, f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"结婚支出")', lnk)
    cell(30, f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"孕产费用")', lnk)
    cell(32, f'=SUM({cl}24:{cl}27)+SUM({cl}29:{cl}30)', fml, bold=True, bg_c=RED_BG)

    cell(34, f'={cl}22-{cl}32', fml, bold=True, bg_c=AMBER_BG)
    cell(35, f'={cl}17+{cl}34', fml, bold=True, bg_c=GREEN_BG)
```

**Step 4: 更新备注行和边框范围**

```python
ws1.merge_cells('A31:F31')
c38 = ws1['A31']
c38.value = '* 特殊支出数据来源：月度现金流汇总；结婚（2026年5月）及孕产费用（2027年9月）均为一次性支出'
# ... 同原样式 ...
ws1.row_dimensions[31].height = 28

# 边框范围更新
for row in range(16, 36):
    for col in range(1, 7):
        ws1.cell(row=row, column=col).border = Border(left=thin, right=thin, top=thin, bottom=thin)
```

**Step 5: 运行并确认无报错**

```bash
python create_plan.py
```

**Step 6: 提交**

```bash
git add create_plan.py
git commit -m "feat: 五年收支总览行号+1，旅游支出改为SUMIFS汇总"
```

---

### Task 3: 升级月度现金流公式为时间查找

**Files:**
- Modify: `create_plan.py:81-123`

**Step 1: 定义时间查找公式生成函数**

在 `months_data` 定义之后、月度现金流循环之前，添加辅助函数：

```python
def time_lookup(row_6based, year_cell, mo_num_expr, fmt_is_pct=False):
    """
    生成嵌套IF时间查找公式。
    row_6based: 总览表假设数据行号（6-14）
    year_cell:  当前行年份单元格引用，如 'B3'
    mo_num_expr: 当前行月份数字表达式，如 'VALUE(LEFT(C3,LEN(C3)-1))'
    返回形如 =IF(AND(L{r}<>"", yyyymm>=L{r}), M{r}, IF(..., B{r})) 的公式字符串
    """
    r = row_6based
    yyyymm = f'{year_cell}*100+{mo_num_expr}'
    # 变更列对：(生效列, 值列) D/E, F/G, H/I, J/K, L/M
    change_cols = [
        (get_column_letter(4),  get_column_letter(5)),   # 变更1
        (get_column_letter(6),  get_column_letter(7)),   # 变更2
        (get_column_letter(8),  get_column_letter(9)),   # 变更3
        (get_column_letter(10), get_column_letter(11)),  # 变更4
        (get_column_letter(12), get_column_letter(13)),  # 变更5
    ]
    # 从最后一次变更向前嵌套
    formula = f'总览!$B${r}'
    for date_col, val_col in change_cols:
        date_ref = f'总览!${date_col}${r}'
        val_ref  = f'总览!${val_col}${r}'
        formula = f'IF(AND({date_ref}<>"",{yyyymm}>={date_ref}),{val_ref},{formula})'
    return '=' + formula
```

**Step 2: 更新月度现金流循环中的公式**

找到月度现金流数据填充循环（`for idx,(year,month) in enumerate(months_data,1):`），修改以下行：

```python
mo_num = f'VALUE(LEFT(C{r},LEN(C{r})-1))'
after_child_cond = f'OR(B{r}>2027,AND(B{r}=2027,{mo_num}>=9))'

sc(1, idx); sc(2, year); sc(3, MONTH_NAMES[month])

# 月收入：时间查找（总览 row 6）
sc(4, time_lookup(6, f'B{r}', mo_num), fml, YUAN)

# 年终奖：12月才有，且金额时间查找（总览 row 7）
sc(5, f'=IF(C{r}="12月",{time_lookup(7, f"B{r}", mo_num)[1:]},0)', fml, YUAN)

# 理财收益：不变（引用上月累计储蓄 × 年利率）
# 年利率在总览 row 14（原 row 13）
if idx == 1:
    sc(6, f'=ROUND(总览!$B$8*总览!$B$14/12,0)', fml, YUAN)   # B8=当前存款, B14=年利率
else:
    sc(6, f'=ROUND(O{r-1}*总览!$B$14/12,0)', fml, YUAN)

sc(7, f'=D{r}+E{r}+F{r}', fml, YUAN)

# 房租：生育前用婚前租金(row9)，生育后用生育后租金(row10)，均支持时间查找
rent_before = time_lookup(9,  f'B{r}', mo_num)[1:]   # 去掉前导 '='
rent_after  = time_lookup(10, f'B{r}', mo_num)[1:]
sc(8, f'=IF({after_child_cond},{rent_after},{rent_before})', fml, YUAN)

# 日常开销：时间查找（总览 row 11）
sc(9, time_lookup(11, f'B{r}', mo_num), fml, YUAN)

# 孩子月开销：生育后才有，时间查找（总览 row 12）
child_val = time_lookup(12, f'B{r}', mo_num)[1:]
sc(10, f'=IF({after_child_cond},{child_val},0)', fml, YUAN)

# 特殊支出：年度旅游引用总览 row 13（时间查找）
travel_val = time_lookup(13, f'B{r}', mo_num)[1:]
sc(11, f'=IF(AND(B{r}=2026,C{r}="5月"),120000,'
       f'IF(AND(B{r}=2027,C{r}="9月"),30000,'
       f'IF(C{r}="10月",{travel_val},0)))', fml, YUAN)
```

**Step 3: 运行脚本**

```bash
python create_plan.py
```
预期：无异常，生成 xlsx。

**Step 4: 用 recalc.py 验证公式无错误**

```bash
python recalc.py 五年规划.xlsx
```
预期输出 JSON 中 `"status": "success"`, `"total_errors": 0`。

若有错误，根据 `error_summary` 中的位置修复对应公式后重新运行。

**Step 5: 提交**

```bash
git add create_plan.py
git commit -m "feat: 月度现金流公式升级为时间查找，支持5次假设变更"
```

---

### Task 4: 验证端到端效果

**Step 1: 在总览表填入示例变更数据**

打开 `五年规划.xlsx`，在总览表假设区域手动填入：
- 双方月可支配收入合计（row 6）：D6=202702, E6=30000, F6=202805, G6=32000
- 存款年利率（row 14）：D14=202801, E14=0.03

**Step 2: 验证月度现金流自动更新**

检查月度现金流表：
- 2027年1月（D列）应为 26000
- 2027年2月（D列）应为 30000
- 2028年4月（D列）应为 30000
- 2028年5月（D列）应为 32000

**Step 3: 验证五年收支总览汇总正确**

检查总览表五年收支总览区域，2027年工资收入应反映变更后的月收入。

**Step 4: 最终提交**

```bash
git add create_plan.py
git commit -m "docs: 完成时间变化假设功能验证"
```
