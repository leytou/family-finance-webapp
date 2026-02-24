from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = Workbook()

# Colors
BLUE = "2B6CB0"        # 输入值字体颜色（柔和蓝）
BLACK = "2D3748"       # 公式字体颜色（深灰蓝）
GREEN = "2F855A"       # 链接公式字体颜色（柔和绿）
DARK_BG = "2D3748"     # 深色背景（标题）
MED_BG = "4A90D9"      # 中等背景（章节标题）
LIGHT_BG = "EDF2F7"    # 浅色背景（参数名）
WHITE = "FFFFFF"       # 白色字体
YELLOW_BG = "EBF4FF"   # 淡蓝背景（输入单元格）
GREEN_BG = "E6F4EA"    # 淡绿背景（年终奖月/收入小计）
RED_BG = "FDE8E8"      # 淡红背景（支出小计）
AMBER_BG = "FEF3C7"    # 淡琥珀背景（重大支出月/年度结余）
GRAY_BG = "F7FAFC"     # 极浅灰蓝背景（偶数行/备注）
ORANGE_BG = "FDE8E8"   # 淡红背景（与 RED_BG 统一）

YUAN = '¥#,##0;(¥#,##0);"-"'
MONTH_NAMES = ['','1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

def hdr(cell, bg=DARK_BG, fg=WHITE, bold=True, sz=11):
    cell.font = Font(bold=bold, color=fg, size=sz)
    cell.fill = PatternFill("solid", start_color=bg)
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

def inp(cell, bold=False):
    cell.font = Font(color=BLUE, bold=bold)

def fml(cell):
    cell.font = Font(color=BLACK)

def lnk(cell):
    cell.font = Font(color=GREEN)

def bdr(cell):
    s = Side(style='thin')
    cell.border = Border(left=s, right=s, top=s, bottom=s)

def center(cell):
    cell.alignment = Alignment(horizontal='center', vertical='center')

def right(cell):
    cell.alignment = Alignment(horizontal='right', vertical='center')

months_data = []
for y in range(2026, 2031):
    for m in range(2 if y == 2026 else 1, 13):
        months_data.append((y, m))
months_data.append((2031, 1))

def time_lookup_expr(assumption_row, year_cell, mo_num_expr):
    """
    生成时间查找表达式（不含前导 '='），可嵌入更大公式。
    assumption_row: 总览表假设数据行号（6-14）
    year_cell: 当前行年份单元格引用，如 'B3'
    mo_num_expr: 当前行月份数字表达式，如 'VALUE(LEFT(C3,LEN(C3)-1))'
    日期列存储格式为 YYYYMM 整数（如 202702 = 2027年2月），与 year*100+month 比较。
    变更列对：D/E=变更1, F/G=变更2, H/I=变更3, J/K=变更4, L/M=变更5（最后一次优先）
    """
    r = assumption_row
    yyyymm = f'{year_cell}*100+{mo_num_expr}'
    change_cols = [('D','E'), ('F','G'), ('H','I'), ('J','K'), ('L','M')]
    formula = f'总览!$B${r}'
    for date_col, val_col in change_cols:
        date_ref = f'总览!${date_col}${r}'
        val_ref  = f'总览!${val_col}${r}'
        formula = f'IF(AND({date_ref}<>"",{yyyymm}>={date_ref}),{val_ref},{formula})'
    return formula

def time_lookup(assumption_row, year_cell, mo_num_expr):
    """返回完整 Excel 公式（含前导 '='）。"""
    return '=' + time_lookup_expr(assumption_row, year_cell, mo_num_expr)

def get_row_data(year, month):
    has_special = (year == 2026 and month == 5) or (year == 2027 and month == 9) or (month == 10)
    notes = ""
    if year == 2026 and month == 5: notes = "结婚支出"
    elif year == 2027 and month == 9: notes = "孕产费用"
    elif month == 10: notes = "年度旅游"
    return has_special, notes

# ============================================================
# Sheet 2: 月度现金流
# ============================================================
ws2 = wb.active
ws2.title = "月度现金流"

hdrs = ['序号','年份','月份','月收入(元)','年终奖(元)','理财收益(元)','总收入(元)',
        '房租(元)','日常开销(元)','孩子开销(元)',
        '特殊支出(元)','特殊说明','总支出(元)','当月净储蓄(元)','累计储蓄(元)']
col_w = [5,7,6,13,13,13,13,10,13,13,13,14,13,15,15]

for i,(h,w) in enumerate(zip(hdrs,col_w),1):
    c = ws2.cell(row=1,column=i,value=h)
    hdr(c)
    ws2.column_dimensions[get_column_letter(i)].width = w
ws2.row_dimensions[1].height = 42
ws2.freeze_panes = 'A2'

for idx,(year,month) in enumerate(months_data,1):
    r = idx + 1
    has_special, notes = get_row_data(year, month)

    bg = None
    if has_special: bg = AMBER_BG
    elif month == 12: bg = GREEN_BG
    elif idx % 2 == 0: bg = GRAY_BG

    def sc(col,val,style_fn=None,fmt=None):
        c = ws2.cell(row=r,column=col,value=val)
        if style_fn: style_fn(c)
        if fmt: c.number_format = fmt
        if bg: c.fill = PatternFill("solid",start_color=bg)
        c.alignment = Alignment(horizontal='center' if col<=3 else 'right',vertical='center')
        return c

    # 月份判断辅助：从月份名提取数字，如"9月"→9
    mo_num = f'VALUE(LEFT(C{r},LEN(C{r})-1))'
    after_child_cond = f'OR(B{r}>2027,AND(B{r}=2027,{mo_num}>=9))'

    sc(1,idx); sc(2,year); sc(3,MONTH_NAMES[month])
    # 月收入：时间查找（总览 row 6）
    sc(4, time_lookup(6, f'B{r}', mo_num), fml, YUAN)

    # 年终奖：12月才有，金额时间查找（总览 row 7）
    bonus_lookup = time_lookup_expr(7, f'B{r}', mo_num)
    sc(5, f'=IF(C{r}="12月",{bonus_lookup},0)', fml, YUAN)

    # 理财收益：上月累计储蓄 × 年利率（总览 row 14）/ 12
    if idx == 1:
        sc(6, f'=ROUND(总览!$B$8*总览!$B$14/12,0)', fml, YUAN)
    else:
        sc(6, f'=ROUND(O{r-1}*总览!$B$14/12,0)', fml, YUAN)

    sc(7, f'=D{r}+E{r}+F{r}', fml, YUAN)

    # 房租：生育前用婚前租金(row9)，生育后用生育后租金(row10)，均支持时间查找
    rent_before = time_lookup_expr(9,  f'B{r}', mo_num)
    rent_after  = time_lookup_expr(10, f'B{r}', mo_num)
    sc(8, f'=IF({after_child_cond},{rent_after},{rent_before})', fml, YUAN)

    # 日常开销：时间查找（总览 row 11）
    sc(9, time_lookup(11, f'B{r}', mo_num), fml, YUAN)

    # 孩子月开销：生育后才有，时间查找（总览 row 12）
    child_val = time_lookup_expr(12, f'B{r}', mo_num)
    sc(10, f'=IF({after_child_cond},{child_val},0)', fml, YUAN)

    # 特殊支出：年度旅游引用总览 row 13（时间查找）
    travel_val = time_lookup_expr(13, f'B{r}', mo_num)
    sc(11, f'=IF(AND(B{r}=2026,C{r}="5月"),120000,'
           f'IF(AND(B{r}=2027,C{r}="9月"),30000,'
           f'IF(C{r}="10月",{travel_val},0)))', fml, YUAN)
    nc = ws2.cell(row=r,column=12,value=notes)
    nc.alignment = Alignment(horizontal='center',vertical='center')
    if bg: nc.fill = PatternFill("solid",start_color=bg)
    sc(13,f'=SUM(H{r}:K{r})',fml,YUAN)
    sc(14,f'=G{r}-M{r}',fml,YUAN)
    if idx==1:
        sc(15,f'=总览!$B$8+N{r}',fml,YUAN)
    else:
        sc(15,f'=O{r-1}+N{r}',fml,YUAN)

# Add legend row
lr = len(months_data)+3
ws2.cell(row=lr,column=1,value='图例说明：').font = Font(bold=True)
for col,txt,bg_c in [(2,'蓝色=输入值',LIGHT_BG),(4,'黄底=重大支出月',AMBER_BG),(6,'绿底=年终奖月',GREEN_BG)]:
    c = ws2.cell(row=lr,column=col,value=txt)
    c.fill = PatternFill("solid",start_color=bg_c)
    c.font = Font(color=BLUE if bg_c==LIGHT_BG else BLACK)

# ============================================================
# Sheet 1: 总览 (insert before monthly sheet)
# ============================================================
ws1 = wb.create_sheet("总览", 0)

# Title
ws1.merge_cells('A1:H1')
ws1['A1'] = '家庭5年财务规划（2026-2030）'
ws1['A1'].font = Font(bold=True, size=16, color=WHITE)
ws1['A1'].fill = PatternFill("solid", start_color=DARK_BG)
ws1['A1'].alignment = Alignment(horizontal='center', vertical='center')
ws1.row_dimensions[1].height = 40

ws1.merge_cells('A2:H2')
ws1['A2'] = '制定日期：2026年2月  |  规划周期：2026年2月 - 2030年12月'
ws1['A2'].font = Font(size=10, color="718096")
ws1['A2'].alignment = Alignment(horizontal='center', vertical='center')
ws1.row_dimensions[2].height = 22

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
assert len(sub_hdrs) == len(sub_col_w), "列标题与列宽数量不匹配"
for i, (h, w) in enumerate(zip(sub_hdrs, sub_col_w), 1):
    c = ws1.cell(row=5, column=i, value=h)
    hdr(c, bg='4A90D9', sz=9)
    ws1.column_dimensions[get_column_letter(i)].width = w
ws1.row_dimensions[5].height = 30

# 假设数据从 row 6 开始（row 5 为子标题行）
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
    c_note.font = Font(color='718096', size=9)
    c_note.alignment = Alignment(horizontal='left', vertical='center', indent=1)

    # 变更列 D-M：黄底蓝字输入格（空值）
    for col in range(4, 14):
        c = ws1.cell(row=i, column=col, value=None)
        c.fill = PatternFill('solid', start_color=YELLOW_BG)
        inp(c)
        c.alignment = Alignment(horizontal='right', vertical='center')
        # 偶数列号 = D,F,H,J,L = 年月列，奇数列号 = E,G,I,K,M = 值列
        if col % 2 == 0:  # 偶数列号 = 年月列
            c.number_format = '0'
        else:             # 奇数列号 = 值列
            c.number_format = fmt

# Section: 五年收支总览
ws1.merge_cells('A15:F15')
ws1['A15'] = '📊 五年收支总览（2026—2030）'
hdr(ws1['A15'], bg=MED_BG, sz=12)
ws1.row_dimensions[15].height = 28

for i,h in enumerate(['项目','2026年','2027年','2028年','2029年','2030年'],1):
    c = ws1.cell(row=16,column=i,value=h)
    hdr(c, bg="4A90D9", sz=10)
ws1.row_dimensions[16].height = 24

# 行定义: (row, label, bold, bg, is_section_header)
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
    (28,'  【特殊支出】',True,'E2E8F0',False),
    (29,'    结婚',False,None,False),
    (30,'    产检及分娩',False,None,False),
    (31,'',False,GRAY_BG,False),
    (32,'支出小计',True,RED_BG,False),
    (33,'',False,None,False),
    (34,'年度结余（收入−支出）',True,AMBER_BG,False),
    (35,'年末累计余额',True,GREEN_BG,False),
]

SECT_HDR_BG = "E2E8F0"
for row,label,bold,bg_c,is_sect in ROW_DEFS:
    ws1.row_dimensions[row].height = 22
    c = ws1.cell(row=row,column=1,value=label)
    if is_sect:
        ws1.merge_cells(f'A{row}:F{row}')
        c.font = Font(bold=True,size=10,color="2D3748")
        c.fill = PatternFill("solid",start_color=SECT_HDR_BG)
        c.alignment = Alignment(horizontal='left',vertical='center',indent=1)
    else:
        c.font = Font(bold=bold,size=10)
        if bg_c: c.fill = PatternFill("solid",start_color=bg_c)
        c.alignment = Alignment(horizontal='left',vertical='center',indent=1)

# 填充年度数据 B=2026..F=2030
for yi,year in enumerate([2026,2027,2028,2029,2030]):
    col = yi + 2
    cl = get_column_letter(col)
    def cell(row,val,style_fn=None,fmt=YUAN,bold=False,bg_c=None):
        c = ws1.cell(row=row,column=col,value=val)
        if style_fn: style_fn(c)
        if bold: c.font = Font(bold=True,color=c.font.color if c.font.color else BLACK)
        if fmt: c.number_format = fmt
        if bg_c: c.fill = PatternFill("solid",start_color=bg_c)
        c.alignment = Alignment(horizontal='right',vertical='center')
        return c

    # 年初余额
    if year == 2026:
        cell(17,'=$B$8',fml,bg_c=YELLOW_BG)
    else:
        pcl = get_column_letter(col-1)
        cell(17,f'={pcl}35',fml)

    # 工资收入
    cell(19,f'=SUMIF(月度现金流!B:B,{year},月度现金流!D:D)',lnk)
    # 年终奖
    cell(20,f'=SUMIF(月度现金流!B:B,{year},月度现金流!E:E)',lnk)
    # 理财收益 (从月度现金流汇总，与月度现金流累计储蓄保持一致)
    cell(21,f'=SUMIF(月度现金流!B:B,{year},月度现金流!F:F)',lnk)
    # 收入小计
    cell(22,f'=SUM({cl}19:{cl}21)',fml,bold=True,bg_c=GREEN_BG)

    # 房租
    cell(24,f'=SUMIF(月度现金流!B:B,{year},月度现金流!H:H)',lnk)
    # 日常开销
    cell(25,f'=SUMIF(月度现金流!B:B,{year},月度现金流!I:I)',lnk)
    # 育儿开销
    cell(26,f'=SUMIF(月度现金流!B:B,{year},月度现金流!J:J)',lnk)
    # 旅游支出 (从月度现金流汇总)
    cell(27,f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"年度旅游")',lnk)
    # 结婚 (从月度现金流汇总)
    cell(29,f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"结婚支出")',lnk)
    # 产检及分娩 (从月度现金流汇总)
    cell(30,f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"孕产费用")',lnk)
    # 支出小计 (row31 为备注行，不含在求和范围)
    cell(32,f'=SUM({cl}24:{cl}27)+SUM({cl}29:{cl}30)',fml,bold=True,bg_c=RED_BG)

    # 年度结余
    cell(34,f'={cl}22-{cl}32',fml,bold=True,bg_c=AMBER_BG)
    # 年末累计余额
    cell(35,f'={cl}17+{cl}34',fml,bold=True,bg_c=GREEN_BG)

# 备注行 row31：合并 A:F，写注释文字
ws1.merge_cells('A31:F31')
note_cell = ws1['A31']
note_cell.value = '* 特殊支出数据来源：月度现金流汇总；结婚（2026年5月）及孕产费用（2027年9月）均为一次性支出'
note_cell.font = Font(size=9, color="718096", italic=True)
note_cell.fill = PatternFill("solid", start_color=GRAY_BG)
note_cell.alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
ws1.row_dimensions[31].height = 28

# 添加边框
thin = Side(style='thin')
for row in range(16,36):
    for col in range(1,7):
        ws1.cell(row=row,column=col).border = Border(left=thin,right=thin,top=thin,bottom=thin)

# ============================================================
# Save
# ============================================================
output_path = 'C:/Users/10204/Desktop/plan/五年规划.xlsx'
wb.save(output_path)
print(f"Saved: {output_path}")
