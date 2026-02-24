# 买房 vs 不买房 财务规划对比 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有五年财务规划 Excel 中增加买房场景对比，包括买房假设参数、买房版月度现金流表、总览表并排对比。

**Architecture:** 将现有月度现金流生成逻辑提取为可复用函数，新增买房假设参数区域（row 16-25），新增"月度现金流（买房）"工作表（18列），总览表五年收支总览下移并扩展为左右并排对比。

**Tech Stack:** Python 3 + openpyxl，Excel PMT 公式

---

### Task 1: 提取月度现金流生成函数

将现有 `create_plan.py:89-174` 的月度现金流生成逻辑提取为函数 `create_monthly_sheet(wb, sheet_name, extra_cols_fn=None)`，使买房表和不买房表可以共用。

**Files:**
- Modify: `create_plan.py:89-174`

**Step 1: 定义函数签名和参数**

在 `create_plan.py` 的 `get_row_data` 函数之后（约 line 85），添加：

```python
def create_monthly_sheet(wb, sheet_name, is_first_sheet=True, housing_cfg=None):
    """
    生成月度现金流工作表。
    wb: Workbook 对象
    sheet_name: 工作表名称
    is_first_sheet: 是否为第一个工作表（使用 wb.active）
    housing_cfg: 买房配置 dict，None 表示不买房方案
        {'buy_time_row': 18, 'price_row': 19, 'down_pct_row': 20,
         'loan_years_row': 21, 'loan_rate_row': 22,
         'down_amount_row': 23, 'loan_amount_row': 24, 'monthly_payment_row': 25}
    """
```

**Step 2: 将现有 line 89-174 的代码移入函数体**

把现有的月度现金流生成代码（从 `ws2 = wb.active` 到图例行）整体移入 `create_monthly_sheet` 函数内。关键调整：

- 不买房表（`housing_cfg=None`）：列结构不变，15列，与现有完全一致
- 买房表（`housing_cfg` 有值）：在 K/L 列（特殊支出/说明）之后插入 M（首付支出）、N（房贷月供）列，总支出/净储蓄/累计储蓄列号后移，末尾增加 R（房贷剩余）列

列号映射用变量管理：

```python
    if housing_cfg:
        # 买房表：18列
        COL_IDX, COL_YEAR, COL_MONTH = 1, 2, 3
        COL_INCOME, COL_BONUS, COL_INVEST, COL_TOTAL_IN = 4, 5, 6, 7
        COL_RENT, COL_DAILY, COL_CHILD = 8, 9, 10
        COL_SPECIAL, COL_NOTE = 11, 12
        COL_DOWN, COL_MORTGAGE = 13, 14       # 新增
        COL_TOTAL_OUT, COL_NET, COL_CUM = 15, 16, 17
        COL_LOAN_BAL = 18                      # 新增
        all_hdrs = ['序号','年份','月份','月收入(元)','年终奖(元)','理财收益(元)','总收入(元)',
                    '房租(元)','日常开销(元)','孩子开销(元)',
                    '特殊支出(元)','特殊说明',
                    '首付支出(元)','房贷月供(元)',
                    '总支出(元)','当月净储蓄(元)','累计储蓄(元)','房贷剩余(元)']
        all_col_w = [5,7,6,13,13,13,13,10,13,13,13,14,13,13,13,15,15,15]
    else:
        # 不买房表：15列（与现有完全一致）
        COL_IDX, COL_YEAR, COL_MONTH = 1, 2, 3
        COL_INCOME, COL_BONUS, COL_INVEST, COL_TOTAL_IN = 4, 5, 6, 7
        COL_RENT, COL_DAILY, COL_CHILD = 8, 9, 10
        COL_SPECIAL, COL_NOTE = 11, 12
        COL_DOWN, COL_MORTGAGE = None, None
        COL_TOTAL_OUT, COL_NET, COL_CUM = 13, 14, 15
        COL_LOAN_BAL = None
        all_hdrs = ['序号','年份','月份','月收入(元)','年终奖(元)','理财收益(元)','总收入(元)',
                    '房租(元)','日常开销(元)','孩子开销(元)',
                    '特殊支出(元)','特殊说明','总支出(元)','当月净储蓄(元)','累计储蓄(元)']
        all_col_w = [5,7,6,13,13,13,13,10,13,13,13,14,13,15,15]
```

**Step 3: 调整函数内的列引用**

将所有硬编码列号替换为变量。关键映射：

| 现有硬编码 | 替换为 | 说明 |
|-----------|--------|------|
| `column=4` (月收入) | `column=COL_INCOME` | |
| `column=5` (年终奖) | `column=COL_BONUS` | |
| `column=6` (理财收益) | `column=COL_INVEST` | |
| `column=7` (总收入) | `column=COL_TOTAL_IN` | |
| `column=8` (房租) | `column=COL_RENT` | |
| `column=9` (日常开销) | `column=COL_DAILY` | |
| `column=10` (孩子开销) | `column=COL_CHILD` | |
| `column=11` (特殊支出) | `column=COL_SPECIAL` | |
| `column=12` (特殊说明) | `column=COL_NOTE` | |
| `column=13` (总支出) | `column=COL_TOTAL_OUT` | |
| `column=14` (净储蓄) | `column=COL_NET` | |
| `column=15` (累计储蓄) | `column=COL_CUM` | |

公式中的列字母引用也需要动态生成：

```python
    cl = lambda c: get_column_letter(c)  # 列号→字母的快捷方式
```

公式中所有 `D{r}`, `E{r}` 等替换为 `{cl(COL_INCOME)}{r}`, `{cl(COL_BONUS)}{r}` 等。

例如现有的 `sc(7, f'=D{r}+E{r}+F{r}', fml, YUAN)` 变为：
```python
    sc(COL_TOTAL_IN, f'={cl(COL_INCOME)}{r}+{cl(COL_BONUS)}{r}+{cl(COL_INVEST)}{r}', fml, YUAN)
```

现有的 `sc(13,f'=SUM(H{r}:K{r})',fml,YUAN)` 变为：
```python
    # 不买房：=SUM(H:K)  买房：=SUM(H:K)+M+N
    if housing_cfg:
        sc(COL_TOTAL_OUT, f'=SUM({cl(COL_RENT)}{r}:{cl(COL_CHILD)}{r})+{cl(COL_SPECIAL)}{r}+{cl(COL_DOWN)}{r}+{cl(COL_MORTGAGE)}{r}', fml, YUAN)
    else:
        sc(COL_TOTAL_OUT, f'=SUM({cl(COL_RENT)}{r}:{cl(COL_SPECIAL)}{r})', fml, YUAN)
```

现有的理财收益公式 `O{r-1}` 替换为 `{cl(COL_CUM)}{r-1}`。

**Step 4: 添加买房专属列的公式逻辑**

在函数内，当 `housing_cfg` 不为 None 时，为每行生成首付、月供、房贷剩余的公式：

```python
    if housing_cfg:
        hc = housing_cfg
        # 当前年月 = B{r}*100 + 月份数字
        yyyymm = f'B{r}*100+{mo_num}'
        buy_time = f'总览!$B${hc["buy_time_row"]}'
        down_amt = f'总览!$B${hc["down_amount_row"]}'
        loan_amt = f'总览!$B${hc["loan_amount_row"]}'
        monthly_pmt = f'总览!$B${hc["monthly_payment_row"]}'

        # 首付支出：仅买房当月
        sc(COL_DOWN, f'=IF({yyyymm}={buy_time},{down_amt},0)', fml, YUAN)

        # 房贷月供：买房次月起
        sc(COL_MORTGAGE, f'=IF({yyyymm}>{buy_time},{monthly_pmt},0)', fml, YUAN)

        # 房贷剩余：贷款总额 - 已还本金累计
        # 等额本息每月本金 = 月供 - 贷款余额×月利率
        # 简化处理：用 PPMT 累计或直接用 FV 计算剩余本金
        # 已还期数 = 当前年月距买房时间的月数
        if idx == 1:
            sc(COL_LOAN_BAL, f'=IF({yyyymm}>={buy_time},{loan_amt}-IF({yyyymm}>{buy_time},PPMT(总览!$B${hc["loan_rate_row"]}/12,1,总览!$B${hc["loan_years_row"]}*12,-{loan_amt}),0),0)', fml, YUAN)
        else:
            prev_bal = f'{cl(COL_LOAN_BAL)}{r-1}'
            # 如果上月有余额，本月还本金 = 月供 - 上月余额×月利率
            sc(COL_LOAN_BAL,
               f'=IF({yyyymm}<{buy_time},0,'
               f'IF({yyyymm}={buy_time},{loan_amt},'
               f'{prev_bal}-({monthly_pmt}-{prev_bal}*总览!$B${hc["loan_rate_row"]}/12)))',
               fml, YUAN)
```

**Step 5: 函数返回工作表引用**

```python
    return ws
```

**Step 6: 替换原有调用**

将原来的 line 89-174 替换为：

```python
ws2 = create_monthly_sheet(wb, "月度现金流", is_first_sheet=True, housing_cfg=None)
```

**Step 7: 运行验证**

Run: `python create_plan.py`
Expected: 生成的 Excel 与修改前完全一致（不买房表结构和公式不变）

**Step 8: 提交**

```bash
git add create_plan.py
git commit -m "refactor: 提取月度现金流生成为可复用函数"
```

---

### Task 2: 总览表新增买房假设参数区域

在现有基本假设区域（row 4-14）下方插入买房假设区域（row 16-25），五年收支总览整体下移。

**Files:**
- Modify: `create_plan.py`（总览表部分，约 line 179 起）

**Step 1: 在基本假设区域之后添加买房假设章节标题**

在现有假设数据循环之后（约 line 259），添加：

```python
# Section: 买房假设
ws1.merge_cells('A16:M16')
ws1['A16'] = '🏠 买房假设'
hdr(ws1['A16'], bg=MED_BG, sz=12)
ws1.row_dimensions[16].height = 28

# 买房假设子标题行 row 17（与 row 5 格式一致）
for i, (h, w) in enumerate(zip(sub_hdrs, sub_col_w), 1):
    c = ws1.cell(row=17, column=i, value=h)
    hdr(c, bg='4A90D9', sz=9)
ws1.row_dimensions[17].height = 30
```

**Step 2: 添加买房假设参数（row 18-22）**

```python
housing_assumptions = [
    ('计划买房时间',   202801, '0',   'YYYYMM格式，如202801=2028年1月'),
    ('总房价',         1500000, YUAN,  ''),
    ('首付比例',       0.3,    '0%',  ''),
    ('贷款年限',       30,     '0',   '年'),
    ('贷款年利率',     0.031,  '0.0%','商贷参考利率'),
]

for i, (label, val, fmt, note) in enumerate(housing_assumptions, 18):
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
    c_note.font = Font(color='718096', size=9)
    c_note.alignment = Alignment(horizontal='left', vertical='center', indent=1)

    # 变更列 D-M（买房时间行不需要变更列，其余参数支持）
    if i > 18:  # row 18 是买房时间，不需要时间变更
        for col in range(4, 14):
            c = ws1.cell(row=i, column=col, value=None)
            c.fill = PatternFill('solid', start_color=YELLOW_BG)
            inp(c)
            c.alignment = Alignment(horizontal='right', vertical='center')
            if col % 2 == 0:
                c.number_format = '0'
            else:
                c.number_format = fmt
```

**Step 3: 添加计算行（row 23-25）**

```python
# 首付金额（row 23）：= 总房价 × 首付比例
ws1.cell(row=23, column=1, value='首付金额').font = Font(bold=True)
ws1.cell(row=23, column=1).fill = PatternFill('solid', start_color=LIGHT_BG)
ws1.cell(row=23, column=1).alignment = Alignment(horizontal='left', vertical='center', indent=1)
c = ws1.cell(row=23, column=2, value='=B19*B20')
fml(c); c.number_format = YUAN
c.alignment = Alignment(horizontal='right', vertical='center')
ws1.cell(row=23, column=3, value='自动计算').font = Font(color='718096', size=9)
ws1.cell(row=23, column=3).alignment = Alignment(horizontal='left', vertical='center', indent=1)
ws1.row_dimensions[23].height = 22

# 贷款总额（row 24）：= 总房价 - 首付金额
ws1.cell(row=24, column=1, value='贷款总额').font = Font(bold=True)
ws1.cell(row=24, column=1).fill = PatternFill('solid', start_color=LIGHT_BG)
ws1.cell(row=24, column=1).alignment = Alignment(horizontal='left', vertical='center', indent=1)
c = ws1.cell(row=24, column=2, value='=B19-B23')
fml(c); c.number_format = YUAN
c.alignment = Alignment(horizontal='right', vertical='center')
ws1.cell(row=24, column=3, value='自动计算').font = Font(color='718096', size=9)
ws1.cell(row=24, column=3).alignment = Alignment(horizontal='left', vertical='center', indent=1)
ws1.row_dimensions[24].height = 22

# 月供金额（row 25）：= -PMT(月利率, 总期数, 贷款总额)
ws1.cell(row=25, column=1, value='月供金额').font = Font(bold=True)
ws1.cell(row=25, column=1).fill = PatternFill('solid', start_color=LIGHT_BG)
ws1.cell(row=25, column=1).alignment = Alignment(horizontal='left', vertical='center', indent=1)
c = ws1.cell(row=25, column=2, value='=-PMT(B22/12,B21*12,B24)')
fml(c); c.number_format = YUAN
c.alignment = Alignment(horizontal='right', vertical='center')
ws1.cell(row=25, column=3, value='等额本息，自动计算').font = Font(color='718096', size=9)
ws1.cell(row=25, column=3).alignment = Alignment(horizontal='left', vertical='center', indent=1)
ws1.row_dimensions[25].height = 22
```

**Step 4: 运行验证**

Run: `python create_plan.py`
Expected: 总览表新增买房假设区域，参数可编辑，计算行公式正确

**Step 5: 提交**

```bash
git add create_plan.py
git commit -m "feat: 总览表新增买房假设参数区域（row 16-25）"
```

---

### Task 3: 五年收支总览下移并扩展为并排对比

将五年收支总览从 row 15 下移到 row 27，并扩展为左右并排对比（不买房 B-F 列 + 买房 H-L 列）。

**Files:**
- Modify: `create_plan.py`（总览表五年收支总览部分，约 line 260 起）

**Step 1: 更新五年收支总览起始行号**

将所有五年收支总览相关的行号从 row 15 起改为 row 27 起。定义行号偏移常量：

```python
# 五年收支总览起始行（原 row 15，现下移到 row 27）
SUMMARY_START = 27
```

**Step 2: 更新章节标题和列标题**

```python
# 不买房方案标题
ws1.merge_cells(f'A{SUMMARY_START}:L{SUMMARY_START}')
ws1.cell(row=SUMMARY_START, column=1, value='📊 五年收支总览（2026—2030）')
hdr(ws1.cell(row=SUMMARY_START, column=1), bg=MED_BG, sz=12)
ws1.row_dimensions[SUMMARY_START].height = 28

# 列标题行
R_HDR = SUMMARY_START + 1  # row 28

# 不买房方案列标题
for i, h in enumerate(['项目','2026年','2027年','2028年','2029年','2030年'], 1):
    c = ws1.cell(row=R_HDR, column=i, value=h)
    hdr(c, bg="4A90D9", sz=10)

# G列间隔（空白）
ws1.column_dimensions['G'].width = 3

# 买房方案列标题
for i, h in enumerate(['2026年','2027年','2028年','2029年','2030年'], 8):
    c = ws1.cell(row=R_HDR, column=i, value=h)
    hdr(c, bg="4A90D9", sz=10)

ws1.row_dimensions[R_HDR].height = 24

# 方案标注行（在列标题上方或合并单元格标注）
# 在 R_HDR 行的 B 列合并标注"📋 不买房方案"
# 在 R_HDR 行的 H 列合并标注"🏠 买房方案"
# （或者在标题行中体现）
```

**Step 3: 更新 ROW_DEFS 行号**

将 ROW_DEFS 中所有行号加上偏移量（+12）。原来 row 17-35 变为 row 29-47。

买房方案的行结构与不买房方案相同，额外增加首付支出和房贷月供行。定义两套 ROW_DEFS：

```python
R_BASE = SUMMARY_START + 2  # row 29，数据起始行

# 不买房方案行定义（与现有结构一致）
ROW_DEFS_NO_HOUSE = [
    (R_BASE+0, '年初余额',True,LIGHT_BG,False),
    (R_BASE+1, '【收入】',True,None,True),
    (R_BASE+2, '  工资收入',False,None,False),
    (R_BASE+3, '  年终奖',False,None,False),
    (R_BASE+4, '  理财收益',False,None,False),
    (R_BASE+5, '收入小计',True,GREEN_BG,False),
    (R_BASE+6, '【支出】',True,None,True),
    (R_BASE+7, '  房租',False,None,False),
    (R_BASE+8, '  日常开销',False,None,False),
    (R_BASE+9, '  育儿开销',False,None,False),
    (R_BASE+10,'  旅游支出',False,None,False),
    (R_BASE+11,'  【特殊支出】',True,'E2E8F0',False),
    (R_BASE+12,'    结婚',False,None,False),
    (R_BASE+13,'    产检及分娩',False,None,False),
    (R_BASE+14,'',False,GRAY_BG,False),  # 备注行
    (R_BASE+15,'支出小计',True,RED_BG,False),
    (R_BASE+16,'',False,None,False),
    (R_BASE+17,'年度结余（收入−支出）',True,AMBER_BG,False),
    (R_BASE+18,'年末累计余额',True,GREEN_BG,False),
]
```

买房方案复用相同的行号（同一行左右并排），但在支出区域增加首付和月供行。由于两个方案共享行号，买房方案的额外行需要在不买房方案的空白行中体现，或者两个方案使用完全相同的行结构（买房方案的首付/月供在不买房方案中显示为0或空）。

**推荐做法：统一行结构**，两个方案使用相同的行定义，买房方案多出的"首付支出"和"房贷月供"行在不买房方案中也存在但值为0/空。

更新后的统一行定义：

```python
ROW_DEFS = [
    (R_BASE+0, '年初余额',True,LIGHT_BG,False),
    (R_BASE+1, '【收入】',True,None,True),
    (R_BASE+2, '  工资收入',False,None,False),
    (R_BASE+3, '  年终奖',False,None,False),
    (R_BASE+4, '  理财收益',False,None,False),
    (R_BASE+5, '收入小计',True,GREEN_BG,False),
    (R_BASE+6, '【支出】',True,None,True),
    (R_BASE+7, '  房租',False,None,False),
    (R_BASE+8, '  日常开销',False,None,False),
    (R_BASE+9, '  育儿开销',False,None,False),
    (R_BASE+10,'  旅游支出',False,None,False),
    (R_BASE+11,'  首付支出',False,None,False),       # 新增
    (R_BASE+12,'  房贷月供',False,None,False),       # 新增
    (R_BASE+13,'  【特殊支出】',True,'E2E8F0',False),
    (R_BASE+14,'    结婚',False,None,False),
    (R_BASE+15,'    产检及分娩',False,None,False),
    (R_BASE+16,'',False,GRAY_BG,False),  # 备注行
    (R_BASE+17,'支出小计',True,RED_BG,False),
    (R_BASE+18,'',False,None,False),
    (R_BASE+19,'年度结余（收入−支出）',True,AMBER_BG,False),
    (R_BASE+20,'年末累计余额',True,GREEN_BG,False),
]
```

用变量记录关键行号：

```python
ROW_BALANCE_START = R_BASE + 0   # 年初余额
ROW_SALARY = R_BASE + 2
ROW_BONUS = R_BASE + 3
ROW_INVEST = R_BASE + 4
ROW_INCOME_TOTAL = R_BASE + 5
ROW_RENT = R_BASE + 7
ROW_DAILY = R_BASE + 8
ROW_CHILD = R_BASE + 9
ROW_TRAVEL = R_BASE + 10
ROW_DOWN_PAYMENT = R_BASE + 11   # 新增
ROW_MORTGAGE = R_BASE + 12       # 新增
ROW_WEDDING = R_BASE + 14
ROW_BABY = R_BASE + 15
ROW_NOTE = R_BASE + 16
ROW_EXPENSE_TOTAL = R_BASE + 17
ROW_ANNUAL_NET = R_BASE + 19
ROW_BALANCE_END = R_BASE + 20
```

**Step 4: 填充不买房方案数据（B-F列）**

与现有逻辑基本一致，引用"月度现金流"表。首付支出和房贷月供行在不买房方案中值为0（不写公式，留空即可）。

关键公式更新（行号变化）：

```python
for yi, year in enumerate([2026,2027,2028,2029,2030]):
    col = yi + 2  # B=2, C=3, ..., F=6
    cl = get_column_letter(col)

    # 年初余额
    if year == 2026:
        cell(ROW_BALANCE_START, '=$B$8', fml, bg_c=YELLOW_BG)
    else:
        pcl = get_column_letter(col-1)
        cell(ROW_BALANCE_START, f'={pcl}{ROW_BALANCE_END}', fml)

    # 收入（引用月度现金流表）
    cell(ROW_SALARY, f'=SUMIF(月度现金流!B:B,{year},月度现金流!D:D)', lnk)
    cell(ROW_BONUS, f'=SUMIF(月度现金流!B:B,{year},月度现金流!E:E)', lnk)
    cell(ROW_INVEST, f'=SUMIF(月度现金流!B:B,{year},月度现金流!F:F)', lnk)
    cell(ROW_INCOME_TOTAL, f'=SUM({cl}{ROW_SALARY}:{cl}{ROW_INVEST})', fml, bold=True, bg_c=GREEN_BG)

    # 支出
    cell(ROW_RENT, f'=SUMIF(月度现金流!B:B,{year},月度现金流!H:H)', lnk)
    cell(ROW_DAILY, f'=SUMIF(月度现金流!B:B,{year},月度现金流!I:I)', lnk)
    cell(ROW_CHILD, f'=SUMIF(月度现金流!B:B,{year},月度现金流!J:J)', lnk)
    cell(ROW_TRAVEL, f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"年度旅游")', lnk)
    # 首付和月供在不买房方案中留空
    cell(ROW_WEDDING, f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"结婚支出")', lnk)
    cell(ROW_BABY, f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"孕产费用")', lnk)
    cell(ROW_EXPENSE_TOTAL, f'=SUM({cl}{ROW_RENT}:{cl}{ROW_TRAVEL})+SUM({cl}{ROW_WEDDING}:{cl}{ROW_BABY})', fml, bold=True, bg_c=RED_BG)

    cell(ROW_ANNUAL_NET, f'={cl}{ROW_INCOME_TOTAL}-{cl}{ROW_EXPENSE_TOTAL}', fml, bold=True, bg_c=AMBER_BG)
    cell(ROW_BALANCE_END, f'={cl}{ROW_BALANCE_START}+{cl}{ROW_ANNUAL_NET}', fml, bold=True, bg_c=GREEN_BG)
```

**Step 5: 填充买房方案数据（H-L列）**

与不买房方案结构相同，但引用"月度现金流（买房）"表，且首付/月供行有数据：

```python
SHEET_BUY = '月度现金流（买房）'

for yi, year in enumerate([2026,2027,2028,2029,2030]):
    col = yi + 8  # H=8, I=9, ..., L=12
    cl = get_column_letter(col)

    # 年初余额
    if year == 2026:
        cell(ROW_BALANCE_START, '=$B$8', fml, bg_c=YELLOW_BG)
    else:
        pcl = get_column_letter(col-1)
        cell(ROW_BALANCE_START, f'={pcl}{ROW_BALANCE_END}', fml)

    # 收入（引用买房版月度现金流表）
    cell(ROW_SALARY, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!D:D)', lnk)
    cell(ROW_BONUS, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!E:E)', lnk)
    cell(ROW_INVEST, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!F:F)', lnk)
    cell(ROW_INCOME_TOTAL, f'=SUM({cl}{ROW_SALARY}:{cl}{ROW_INVEST})', fml, bold=True, bg_c=GREEN_BG)

    # 支出（买房表列号不同：H=房租, I=日常, J=孩子, K=特殊, M=首付, N=月供）
    cell(ROW_RENT, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!H:H)', lnk)
    cell(ROW_DAILY, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!I:I)', lnk)
    cell(ROW_CHILD, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!J:J)', lnk)
    cell(ROW_TRAVEL, f'=SUMIFS(\'{SHEET_BUY}\'!K:K,\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!L:L,"年度旅游")', lnk)
    # 首付支出（买房表 M 列）
    cell(ROW_DOWN_PAYMENT, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!M:M)', lnk)
    # 房贷月供（买房表 N 列）
    cell(ROW_MORTGAGE, f'=SUMIF(\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!N:N)', lnk)
    cell(ROW_WEDDING, f'=SUMIFS(\'{SHEET_BUY}\'!K:K,\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!L:L,"结婚支出")', lnk)
    cell(ROW_BABY, f'=SUMIFS(\'{SHEET_BUY}\'!K:K,\'{SHEET_BUY}\'!B:B,{year},\'{SHEET_BUY}\'!L:L,"孕产费用")', lnk)
    cell(ROW_EXPENSE_TOTAL,
         f'=SUM({cl}{ROW_RENT}:{cl}{ROW_TRAVEL})+{cl}{ROW_DOWN_PAYMENT}+{cl}{ROW_MORTGAGE}+SUM({cl}{ROW_WEDDING}:{cl}{ROW_BABY})',
         fml, bold=True, bg_c=RED_BG)

    cell(ROW_ANNUAL_NET, f'={cl}{ROW_INCOME_TOTAL}-{cl}{ROW_EXPENSE_TOTAL}', fml, bold=True, bg_c=AMBER_BG)
    cell(ROW_BALANCE_END, f'={cl}{ROW_BALANCE_START}+{cl}{ROW_ANNUAL_NET}', fml, bold=True, bg_c=GREEN_BG)
```

**Step 6: 更新备注行和边框范围**

备注行从 row 31 改为 `ROW_NOTE`，边框范围扩展到 H-L 列。

**Step 7: 运行验证**

Run: `python create_plan.py`
Expected: 总览表显示并排对比，不买房方案数据与之前一致

**Step 8: 提交**

```bash
git add create_plan.py
git commit -m "feat: 五年收支总览下移并扩展为买房/不买房并排对比"
```

---

### Task 4: 生成买房版月度现金流工作表

调用 Task 1 中提取的函数，生成"月度现金流（买房）"工作表。

**Files:**
- Modify: `create_plan.py`（在不买房表生成之后、总览表之前）

**Step 1: 定义买房配置并调用函数**

在不买房表生成之后添加：

```python
HOUSING_CFG = {
    'buy_time_row': 18,
    'price_row': 19,
    'down_pct_row': 20,
    'loan_years_row': 21,
    'loan_rate_row': 22,
    'down_amount_row': 23,
    'loan_amount_row': 24,
    'monthly_payment_row': 25,
}

ws3 = create_monthly_sheet(wb, "月度现金流（买房）", is_first_sheet=False, housing_cfg=HOUSING_CFG)
```

**Step 2: 运行验证**

Run: `python create_plan.py`
Expected: Excel 包含3个工作表：总览、月度现金流、月度现金流（买房）

**Step 3: 在 Excel 中验证买房表公式**

手动检查：
- 买房时间之前：首付=0，月供=0，房贷剩余=0
- 买房当月：首付=总房价×首付比例，月供=0，房贷剩余=贷款总额
- 买房次月起：首付=0，月供=PMT计算值，房贷剩余逐月递减
- 累计储蓄在首付月大幅下降

**Step 4: 提交**

```bash
git add create_plan.py
git commit -m "feat: 新增买房版月度现金流工作表"
```

---

### Task 5: 端到端验证和样式收尾

验证整体功能正确性，修复样式问题。

**Files:**
- Modify: `create_plan.py`

**Step 1: 运行生成并打开 Excel**

Run: `python create_plan.py`
Expected: 生成包含3个工作表的 Excel 文件

**Step 2: 验证清单**

在 Excel 中逐项检查：

1. 总览表：
   - [ ] 基本假设区域（row 4-14）不变
   - [ ] 买房假设区域（row 16-25）参数可编辑
   - [ ] 计算行（row 23-25）公式正确：首付金额、贷款总额、月供
   - [ ] 五年收支总览左侧（B-F）不买房数据正确
   - [ ] 五年收支总览右侧（H-L）买房数据正确
   - [ ] 修改买房时间后，两个方案数据自动更新

2. 月度现金流（不买房）：
   - [ ] 结构和公式与修改前完全一致

3. 月度现金流（买房）：
   - [ ] 首付在正确月份扣除
   - [ ] 月供从买房次月开始
   - [ ] 房贷剩余逐月递减
   - [ ] 累计储蓄在首付月大幅下降

**Step 3: 修复发现的问题**

根据验证结果修复任何公式或样式问题。

**Step 4: 最终提交**

```bash
git add create_plan.py
git commit -m "feat: 买房vs不买房财务规划对比功能完成"
```
