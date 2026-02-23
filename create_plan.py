from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = Workbook()

# Colors
BLUE = "0000FF"
BLACK = "000000"
GREEN = "008000"
DARK_BG = "1F4E79"
MED_BG = "2E75B6"
LIGHT_BG = "DEEAF1"
WHITE = "FFFFFF"
YELLOW_BG = "FFFF00"
GREEN_BG = "E2EFDA"
RED_BG = "FCE4D6"
AMBER_BG = "FFF2CC"
GRAY_BG = "F2F2F2"
ORANGE_BG = "FCE4D6"

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
    sc(4,'=总览!$B$5',fml,YUAN)
    sc(5,f'=IF(C{r}="12月",总览!$B$6,0)',fml,YUAN)
    # 理财收益：上月累计储蓄 × 年利率 / 12
    if idx==1:
        sc(6,f'=ROUND(总览!$B$7*总览!$B$13/12,0)',fml,YUAN)
    else:
        sc(6,f'=ROUND(O{r-1}*总览!$B$13/12,0)',fml,YUAN)
    sc(7,f'=D{r}+E{r}+F{r}',fml,YUAN)
    sc(8,f'=IF({after_child_cond},总览!$B$9,总览!$B$8)',fml,YUAN)
    sc(9,'=总览!$B$10',fml,YUAN)
    sc(10,f'=IF({after_child_cond},总览!$B$11,0)',fml,YUAN)
    sc(11,f'=IF(AND(B{r}=2026,C{r}="5月"),120000,IF(AND(B{r}=2027,C{r}="9月"),30000,IF(C{r}="10月",总览!$B$12,0)))',fml,YUAN)
    nc = ws2.cell(row=r,column=12,value=notes)
    nc.alignment = Alignment(horizontal='center',vertical='center')
    if bg: nc.fill = PatternFill("solid",start_color=bg)
    sc(13,f'=SUM(H{r}:K{r})',fml,YUAN)
    sc(14,f'=G{r}-M{r}',fml,YUAN)
    if idx==1:
        sc(15,f'=总览!$B$7+N{r}',fml,YUAN)
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
ws1['A2'].font = Font(size=10, color="595959")
ws1['A2'].alignment = Alignment(horizontal='center', vertical='center')
ws1.row_dimensions[2].height = 22

# Section: 基本假设
ws1.merge_cells('A4:D4')
ws1['A4'] = '📋 基本财务假设'
hdr(ws1['A4'], bg=MED_BG, sz=12)
ws1.row_dimensions[4].height = 28

assumptions = [
    ('双方月可支配收入合计', 26000, YUAN, '每月税后可支配收入'),
    ('年终奖（合计）', 46000, YUAN, ''),
    ('当前存款', 380000, YUAN, '截至2026年2月'),
    ('婚前月租金', 2400, YUAN, '生育前，含停车费'),
    ('生育后月租金', 3900, YUAN, '孩子出生后搬入更大住所，含停车费'),
    ('月日常开销', 1500, YUAN, '餐饮/交通/娱乐等'),
    ('孩子月开销', 3000, YUAN, '奶粉/纸尿裤/早教等（出生后）'),
    ('年度旅游支出', 15000, YUAN, ''),
    ('存款年利率', 0.025, '0.0%', '按年初余额计算，保守型理财参考收益率'),
]

for i,(label,val,fmt,note) in enumerate(assumptions,5):
    ws1.row_dimensions[i].height = 22
    c_label = ws1.cell(row=i,column=1,value=label)
    c_label.font = Font(bold=True)
    c_label.fill = PatternFill("solid",start_color=LIGHT_BG)
    c_label.alignment = Alignment(horizontal='left',vertical='center',indent=1)
    c_val = ws1.cell(row=i,column=2,value=val)
    inp(c_val)
    c_val.number_format = fmt
    c_val.alignment = Alignment(horizontal='right',vertical='center')
    c_val.fill = PatternFill("solid",start_color=YELLOW_BG)
    c_note = ws1.cell(row=i,column=3,value=note)
    c_note.font = Font(color="595959",italic=False,size=9)
    c_note.alignment = Alignment(horizontal='left',vertical='center',indent=1)

ws1.column_dimensions['A'].width = 22
ws1.column_dimensions['B'].width = 16
ws1.column_dimensions['C'].width = 22
ws1.column_dimensions['D'].width = 18
ws1.column_dimensions['E'].width = 18
ws1.column_dimensions['F'].width = 18
ws1.column_dimensions['G'].width = 18
ws1.column_dimensions['H'].width = 18

# Section: 五年收支总览
ws1.merge_cells('A14:F14')
ws1['A14'] = '📊 五年收支总览（2026—2030）'
hdr(ws1['A14'], bg=MED_BG, sz=12)
ws1.row_dimensions[14].height = 28

for i,h in enumerate(['项目','2026年','2027年','2028年','2029年','2030年'],1):
    c = ws1.cell(row=15,column=i,value=h)
    hdr(c, bg="4472C4", sz=10)
ws1.row_dimensions[15].height = 24

# 行定义: (row, label, bold, bg, is_section_header)
ROW_DEFS = [
    (16,'年初余额',True,LIGHT_BG,False),
    (17,'【收入】',True,None,True),
    (18,'  工资收入',False,None,False),
    (19,'  年终奖',False,None,False),
    (20,'  理财收益',False,None,False),
    (21,'收入小计',True,GREEN_BG,False),
    (22,'【支出】',True,None,True),
    (23,'  房租',False,None,False),
    (24,'  日常开销',False,None,False),
    (25,'  育儿开销',False,None,False),
    (26,'  旅游支出',False,None,False),
    (27,'  【特殊支出】',True,'D6E4F0',False),
    (28,'    结婚',False,None,False),
    (29,'    产检及分娩',False,None,False),
    (30,'',False,GRAY_BG,False),
    (31,'支出小计',True,RED_BG,False),
    (32,'',False,None,False),
    (33,'年度结余（收入−支出）',True,AMBER_BG,False),
    (34,'年末累计余额',True,GREEN_BG,False),
]

SECT_HDR_BG = "D6E4F0"
for row,label,bold,bg_c,is_sect in ROW_DEFS:
    ws1.row_dimensions[row].height = 22
    c = ws1.cell(row=row,column=1,value=label)
    if is_sect:
        ws1.merge_cells(f'A{row}:F{row}')
        c.font = Font(bold=True,size=10,color="1F4E79")
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
    mcnt = 11 if year == 2026 else 12

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
        cell(16,'=$B$7',fml,bg_c=YELLOW_BG)
    else:
        pcl = get_column_letter(col-1)
        cell(16,f'={pcl}34',fml)

    # 工资收入
    cell(18,f'=SUMIF(月度现金流!B:B,{year},月度现金流!D:D)',lnk)
    # 年终奖
    cell(19,f'=SUMIF(月度现金流!B:B,{year},月度现金流!E:E)',lnk)
    # 理财收益 (从月度现金流汇总，与月度现金流累计储蓄保持一致)
    cell(20,f'=SUMIF(月度现金流!B:B,{year},月度现金流!F:F)',lnk)
    # 收入小计
    cell(21,f'=SUM({cl}18:{cl}20)',fml,bold=True,bg_c=GREEN_BG)

    # 房租
    cell(23,f'=SUMIF(月度现金流!B:B,{year},月度现金流!H:H)',lnk)
    # 日常开销
    cell(24,f'=SUMIF(月度现金流!B:B,{year},月度现金流!I:I)',lnk)
    # 育儿开销
    cell(25,f'=SUMIF(月度现金流!B:B,{year},月度现金流!J:J)',lnk)
    # 旅游支出 (引用基本假设 B12)
    cell(26,'=$B$12',fml)
    # 结婚 (从月度现金流汇总)
    cell(28,f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"结婚支出")',lnk)
    # 产检及分娩 (从月度现金流汇总)
    cell(29,f'=SUMIFS(月度现金流!K:K,月度现金流!B:B,{year},月度现金流!L:L,"孕产费用")',lnk)
    # 支出小计 (row30 为备注行，不含在求和范围)
    cell(31,f'=SUM({cl}23:{cl}26)+SUM({cl}28:{cl}29)',fml,bold=True,bg_c=RED_BG)

    # 年度结余
    cell(33,f'={cl}21-{cl}31',fml,bold=True,bg_c=AMBER_BG)
    # 年末累计余额
    cell(34,f'={cl}16+{cl}33',fml,bold=True,bg_c=GREEN_BG)

# 备注行 row30：合并 A:F，写注释文字
ws1.merge_cells('A30:F30')
c38 = ws1['A30']
c38.value = '* 特殊支出数据来源：月度现金流汇总；结婚（2026年5月）及孕产费用（2027年9月）均为一次性支出'
c38.font = Font(size=9, color="595959", italic=True)
c38.fill = PatternFill("solid", start_color=GRAY_BG)
c38.alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
ws1.row_dimensions[30].height = 28

# 添加边框
thin = Side(style='thin')
for row in range(15,35):
    for col in range(1,7):
        ws1.cell(row=row,column=col).border = Border(left=thin,right=thin,top=thin,bottom=thin)

# ============================================================
# Sheet 3: 理财建议
# ============================================================
ws3 = wb.create_sheet("理财建议")

ws3.merge_cells('A1:F1')
ws3['A1'] = '家庭理财与风险管理建议'
ws3['A1'].font = Font(bold=True, size=15, color=WHITE)
ws3['A1'].fill = PatternFill("solid", start_color=DARK_BG)
ws3['A1'].alignment = Alignment(horizontal='center', vertical='center')
ws3.row_dimensions[1].height = 38

sections = [
    (3, '一、应急备用金', MED_BG, [
        ('建议金额', '约¥50,000（孩子出生后6个月家庭开销）', YELLOW_BG),
        ('存放方式', '货币基金（如余额宝）或活期存款，随时可取', LIGHT_BG),
        ('当前状态', '存款38万远超应急需求，可将5万单独存入货币基金专户', GREEN_BG),
        ('注意事项', '应急金不参与任何投资，保持流动性第一', LIGHT_BG),
    ]),
    (9, '二、保险规划', MED_BG, [
        ('现状', '目前仅有社保，商业保险保障不足', RED_BG),
        ('建议-双方各购', '百万医疗险：约¥300-500/人/年，覆盖大额医疗', LIGHT_BG),
        ('建议-双方各购', '重疾险（消费型）：约¥1,500-3,000/人/年，保额50万+', LIGHT_BG),
        ('建议-双方各购', '定期寿险：约¥1,000-2,000/人/年，保额100万（有孩子后必备）', AMBER_BG),
        ('孩子保险', '少儿医疗险：约¥200-300/年；重疾险可考虑¥1,000-2,000/年', LIGHT_BG),
        ('年度保险预算', '合计约¥8,000-15,000/年，占年收入约2-4%，合理范围', GREEN_BG),
    ]),
    (17, '三、存款投资建议（保守型）', MED_BG, [
        ('原则', '保守型：以保本为主，追求稳健收益，不炒股不投机', LIGHT_BG),
        ('应急金（5万）', '货币基金，年化约1.5-2.5%，随时可取', LIGHT_BG),
        ('短期备用（10万）', '银行定期存款或大额存单，1-3年期，年化约2-3%', LIGHT_BG),
        ('中期理财（20万）', '国债/储蓄国债，3-5年期，年化约2.5-3.5%，安全性高', GREEN_BG),
        ('长期规划（剩余）', '银行R2级理财产品，年化约3-4%，低风险', LIGHT_BG),
        ('预期综合收益', '约2.5-3.5%/年，38万存款年收益约¥9,500-13,300', AMBER_BG),
    ]),
    (25, '四、孩子教育金规划', MED_BG, [
        ('目标', '为孩子准备大学教育金，目标¥20-30万（18年后）', LIGHT_BG),
        ('建议方式', '每月定投¥500-1,000至货币基金或低风险理财', LIGHT_BG),
        ('18年积累', '每月¥800，年化3%，18年后约¥22万', GREEN_BG),
        ('启动时间', '孩子出生后即开始，越早越好', AMBER_BG),
    ]),
    (31, '五、5年财务目标', MED_BG, [
        ('2026年末目标', '完成结婚，累计储蓄约¥55万', LIGHT_BG),
        ('2027年末目标', '迎接宝宝，累计储蓄约¥82万', LIGHT_BG),
        ('2028年末目标', '家庭稳定运转，累计储蓄约¥107万', GREEN_BG),
        ('2029年末目标', '持续积累，累计储蓄约¥132万', GREEN_BG),
        ('2030年末目标', '5年规划完成，累计储蓄约¥158万', GREEN_BG),
        ('核心建议', '收入稳定、无负债、储蓄率高，财务状况优秀！建议尽早配置保险', AMBER_BG),
    ]),
]

for start_row, title, title_bg, items in sections:
    ws3.merge_cells(f'A{start_row}:F{start_row}')
    c = ws3[f'A{start_row}']
    c.value = title
    hdr(c, bg=title_bg, sz=11)
    ws3.row_dimensions[start_row].height = 26

    for j,(key,val,bg_c) in enumerate(items,1):
        r = start_row + j
        ws3.row_dimensions[r].height = 22
        ck = ws3.cell(row=r,column=1,value=key)
        ck.font = Font(bold=True,size=10)
        ck.fill = PatternFill("solid",start_color=bg_c)
        ck.alignment = Alignment(horizontal='left',vertical='center',indent=1)
        ws3.merge_cells(f'B{r}:F{r}')
        cv = ws3.cell(row=r,column=2,value=val)
        cv.fill = PatternFill("solid",start_color=bg_c)
        cv.alignment = Alignment(horizontal='left',vertical='center',wrap_text=True,indent=1)
        cv.font = Font(size=10)

ws3.column_dimensions['A'].width = 22
for col in 'BCDEF':
    ws3.column_dimensions[col].width = 20

# ============================================================
# Save
# ============================================================
output_path = 'C:/Users/10204/Desktop/plan/五年规划.xlsx'
wb.save(output_path)
print(f"Saved: {output_path}")
