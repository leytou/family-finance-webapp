<script setup lang="ts">
import { computed } from 'vue'

import { useCalculator } from '../composables/useCalculator'
import { MORTGAGE_TERMS, calcEqualPayment, calcHousingFund } from '../utils/calculator'
import { formatCurrency } from '../utils/format'

const { state, setLoanAmount, setRate, setFundBase, setPersonalRate, setEmployerRate } =
  useCalculator()

// 房贷：每个期限一行（月供/总利息/还款总额）
const mortgageRows = computed(() =>
  MORTGAGE_TERMS.map(term => ({
    term,
    result: calcEqualPayment(state.value.loanAmount, state.value.rates[term], term),
  })),
)

// 公积金：个人 / 单位 / 合计
const fund = computed(() =>
  calcHousingFund(state.value.fundBase, state.value.personalRate, state.value.employerRate),
)

// 比例合计显示：规避浮点累加误差（如 12.1+12.2），保留至多 2 位小数并去尾零
function fmtPct(v: number): string {
  return String(Math.round(v * 100) / 100)
}
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <div class="flex flex-wrap gap-8">
      <!-- ① 房贷月供 -->
      <section class="min-w-[460px] flex-1">
        <h2 class="text-base font-bold mb-3">房贷月供 · 等额本息</h2>
        <div class="flex items-center gap-2 mb-3">
          <label class="text-[11px] whitespace-nowrap">贷款金额</label>
          <input
            data-testid="calc-loan-amount"
            :value="state.loanAmount || ''"
            @input="(e: Event) => setLoanAmount(Number((e.target as HTMLInputElement).value))"
            type="number"
            class="border rounded px-2 py-0.5 text-[11px] w-36 tabular-nums"
            placeholder="元"
          />
        </div>
        <table class="min-w-full border-collapse text-[11px] leading-tight">
          <thead>
            <tr class="bg-neutral-50">
              <th class="px-2 py-1 border text-left whitespace-nowrap">期限</th>
              <th class="px-2 py-1 border text-right whitespace-nowrap">年利率(%)</th>
              <th class="px-2 py-1 border text-right whitespace-nowrap">月供(元)</th>
              <th class="px-2 py-1 border text-right whitespace-nowrap">总利息(元)</th>
              <th class="px-2 py-1 border text-right whitespace-nowrap">还款总额(元)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in mortgageRows" :key="row.term">
              <td class="px-2 py-1 border whitespace-nowrap">{{ row.term }} 年</td>
              <td class="px-2 py-1 border">
                <input
                  :data-testid="`calc-rate-${row.term}`"
                  :value="state.rates[row.term] || ''"
                  @input="(e: Event) => setRate(row.term, Number((e.target as HTMLInputElement).value))"
                  type="number"
                  step="0.01"
                  class="w-16 text-right border rounded px-1 py-0.5 tabular-nums"
                />
              </td>
              <td :data-testid="`calc-mort-${row.term}-payment`" class="px-2 py-1 border text-right tabular-nums whitespace-nowrap">{{ formatCurrency(row.result.monthlyPayment) }}</td>
              <td :data-testid="`calc-mort-${row.term}-interest`" class="px-2 py-1 border text-right tabular-nums whitespace-nowrap">{{ formatCurrency(row.result.totalInterest) }}</td>
              <td :data-testid="`calc-mort-${row.term}-repayment`" class="px-2 py-1 border text-right tabular-nums whitespace-nowrap">{{ formatCurrency(row.result.totalRepayment) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ② 公积金缴存 -->
      <section class="min-w-[360px] flex-1">
        <h2 class="text-base font-bold mb-3">公积金缴存</h2>
        <div class="flex items-center gap-2 mb-3">
          <label class="text-[11px] whitespace-nowrap">缴存基数</label>
          <input
            data-testid="calc-fund-base"
            :value="state.fundBase || ''"
            @input="(e: Event) => setFundBase(Number((e.target as HTMLInputElement).value))"
            type="number"
            class="border rounded px-2 py-0.5 text-[11px] w-36 tabular-nums"
            placeholder="元"
          />
        </div>
        <table class="min-w-full border-collapse text-[11px] leading-tight">
          <thead>
            <tr class="bg-neutral-50">
              <th class="px-2 py-1 border text-left whitespace-nowrap">项目</th>
              <th class="px-2 py-1 border text-right whitespace-nowrap">缴存比例(%)</th>
              <th class="px-2 py-1 border text-right whitespace-nowrap">每月金额(元)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-2 py-1 border whitespace-nowrap">个人</td>
              <td class="px-2 py-1 border">
                <input
                  data-testid="calc-personal-rate"
                  :value="state.personalRate || ''"
                  @input="(e: Event) => setPersonalRate(Number((e.target as HTMLInputElement).value))"
                  type="number"
                  step="0.1"
                  class="w-16 text-right border rounded px-1 py-0.5 tabular-nums"
                />
              </td>
              <td class="px-2 py-1 border text-right tabular-nums whitespace-nowrap">{{ formatCurrency(fund.personal) }}</td>
            </tr>
            <tr>
              <td class="px-2 py-1 border whitespace-nowrap">单位</td>
              <td class="px-2 py-1 border">
                <input
                  data-testid="calc-employer-rate"
                  :value="state.employerRate || ''"
                  @input="(e: Event) => setEmployerRate(Number((e.target as HTMLInputElement).value))"
                  type="number"
                  step="0.1"
                  class="w-16 text-right border rounded px-1 py-0.5 tabular-nums"
                />
              </td>
              <td class="px-2 py-1 border text-right tabular-nums whitespace-nowrap">{{ formatCurrency(fund.employer) }}</td>
            </tr>
            <tr class="bg-brand-50 font-bold">
              <td class="px-2 py-1 border whitespace-nowrap">合计</td>
              <td class="px-2 py-1 border text-right tabular-nums whitespace-nowrap">{{ fmtPct(fund.personalRate + fund.employerRate) }}%</td>
              <td class="px-2 py-1 border text-right tabular-nums whitespace-nowrap">{{ formatCurrency(fund.total) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
