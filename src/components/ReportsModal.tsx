/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MyobAccount, MyobJournal, TrialBalanceRow, AccountType } from '../types';
import { BarChart, DollarSign, BookOpen, Layers, Printer, Download } from 'lucide-react';

interface ReportsModalProps {
  companyName: string;
  fiscalYear: number;
  accounts: MyobAccount[];
  journals: MyobJournal[];
  onClose: () => void;
}

export default function ReportsModal({ companyName, fiscalYear, accounts, journals, onClose }: ReportsModalProps) {
  const [activeReport, setActiveReport] = useState<'Trial' | 'ProfitLoss' | 'BalanceSheet'>('Trial');

  // Math engine: Dynamically calculate adjusted balances for COA based on logged transaction journals
  const getTrialBalanceRows = (): TrialBalanceRow[] => {
    // 1. Initialize balances map from opening balances
    const map: { [id: string]: { debits: number; credits: number } } = {};
    accounts.forEach(acc => {
      map[acc.id] = { debits: 0, credits: 0 };
    });

    // 2. Accumulate Debits & Credits from journal lines
    journals.forEach(j => {
      j.lines.forEach(line => {
        if (map[line.accountId]) {
          map[line.accountId].debits += line.debit;
          map[line.accountId].credits += line.credit;
        }
      });
    });

    // 3. Form rows with final balance computations
    return accounts.map(acc => {
      const changes = map[acc.id] || { debits: 0, credits: 0 };
      const dChange = changes.debits;
      const cChange = changes.credits;

      let currentBalance = acc.openingBalance;
      if (acc.balanceType === 'Debit') {
        currentBalance = acc.openingBalance + dChange - cChange;
      } else {
        currentBalance = acc.openingBalance + cChange - dChange;
      }

      return {
        accountCode: acc.id,
        accountName: acc.name,
        accountType: acc.type,
        classification: acc.classification,
        openingBalance: acc.openingBalance,
        debitChange: dChange,
        creditChange: cChange,
        currentBalance,
        balanceType: acc.balanceType
      };
    }).sort((a,b) => a.accountCode.localeCompare(b.accountCode));
  };

  const trialRows = getTrialBalanceRows();

  // Deduce Profit and Loss Metrics
  const revenueRows = trialRows.filter(r => r.accountType === 'Revenue' && r.classification === 'Detail');
  const cogsRows = trialRows.filter(r => r.accountType === 'Cost Of Sales' && r.classification === 'Detail');
  const expenseRows = trialRows.filter(r => r.accountType === 'Expense' && r.classification === 'Detail');
  const otherIncomeRows = trialRows.filter(r => r.accountType === 'Other Income' && r.classification === 'Detail');
  const otherExpenseRows = trialRows.filter(r => r.accountType === 'Other Expense' && r.classification === 'Detail');

  const totalRevenue = revenueRows.reduce((sum, r) => sum + r.currentBalance, 0);
  const totalCogs = cogsRows.reduce((sum, r) => sum + r.currentBalance, 0);
  const grossProfit = totalRevenue - totalCogs;

  const totalExpenses = expenseRows.reduce((sum, r) => sum + r.currentBalance, 0);
  const totalOtherIncome = otherIncomeRows.reduce((sum, r) => sum + r.currentBalance, 0);
  const totalOtherExpense = otherExpenseRows.reduce((sum, r) => sum + r.currentBalance, 0);

  const netProfitLoss = grossProfit - totalExpenses + totalOtherIncome - totalOtherExpense;

  // Deduce Balance Sheet classification totals
  const assetRows = trialRows.filter(r => r.accountType === 'Asset' && r.classification === 'Detail');
  const liabilityRows = trialRows.filter(r => r.accountType === 'Liability' && r.classification === 'Detail');
  const equityRows = trialRows.filter(r => r.accountType === 'Equity' && r.classification === 'Detail');

  const totalAssets = assetRows.reduce((sum, r) => sum + r.currentBalance, 0);
  const totalLiabilities = liabilityRows.reduce((sum, r) => sum + r.currentBalance, 0);
  // Add net profit/loss to equity for balanced sheets (Current Earnings adjustment)
  const baseEquity = equityRows.reduce((sum, r) => {
    // MYOB double entry balancing normal direction rule
    if (r.balanceType === 'Debit') {
      return sum - r.currentBalance; // Drawing or Prives subtract standard credit equity
    }
    return sum + r.currentBalance;
  }, 0);
  const adjustedEquity = baseEquity + netProfitLoss;
  const totalLiabilitiesAndEquity = totalLiabilities + adjustedEquity;

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csv = '';
    const dateStr = new Date().toLocaleDateString('id-ID');

    if (activeReport === 'Trial') {
      csv += `NAMA PERUSAHAAN,${companyName}\n`;
      csv += `JENIS LAPORAN,NERACA SALDO (TRIAL BALANCE)\n`;
      csv += `TANGGAL EKSPOR,${dateStr}\n`;
      csv += `TAHUN BUKU,${fiscalYear}\n\n`;
      csv += `Kode Akun,Nama Akun,Debit normal,Saldo Debet,Saldo Kredit\n`;

      trialRows.forEach(row => {
        const isHeader = row.classification === 'Header';
        const debitVal = !isHeader && row.balanceType === 'Debit' ? row.currentBalance : 0;
        const creditVal = !isHeader && row.balanceType === 'Credit' ? row.currentBalance : 0;
        csv += `"${row.accountCode}","${row.accountName}","${row.classification === 'Header' ? 'HDR' : row.balanceType}",${debitVal},${creditVal}\n`;
      });

      const totalD = trialRows.filter(r => r.classification === 'Detail' && r.balanceType === 'Debit').reduce((sum, r) => sum + r.currentBalance, 0);
      const totalC = trialRows.filter(r => r.classification === 'Detail' && r.balanceType === 'Credit').reduce((sum, r) => sum + r.currentBalance, 0);
      csv += `TOTAL,,,${totalD},${totalC}\n`;

    } else if (activeReport === 'ProfitLoss') {
      csv += `NAMA PERUSAHAAN,${companyName}\n`;
      csv += `JENIS LAPORAN,LAPORAN LABA RUGI (PROFIT & LOSS STATEMENT)\n`;
      csv += `TANGGAL EKSPOR,${dateStr}\n`;
      csv += `TAHUN BUKU,${fiscalYear}\n\n`;
      csv += `Kategori,Kode Akun,Nama Akun,Nilai Saldo\n`;

      csv += `1. PENDAPATAN JASA\n`;
      revenueRows.forEach(r => csv += `Pendapatan,${r.accountCode},"${r.accountName}",${r.currentBalance}\n`);
      csv += `,,Total Pendapatan,${totalRevenue}\n\n`;

      csv += `2. HARGA POKOK PENJUALAN\n`;
      cogsRows.forEach(r => csv += `HPP,${r.accountCode},"${r.accountName}",${r.currentBalance}\n`);
      csv += `,,Total HPP,${totalCogs}\n\n`;

      csv += `LABA KOTOR,,,${grossProfit}\n\n`;

      csv += `3. BEBAN OPERASIONAL\n`;
      expenseRows.forEach(r => csv += `Beban,${r.accountCode},"${r.accountName}",${r.currentBalance}\n`);
      csv += `,,Total Beban,${totalExpenses}\n\n`;

      csv += `LABA / RUGI BERSIH,,,${netProfitLoss}\n`;

    } else {
      csv += `NAMA PERUSAHAAN,${companyName}\n`;
      csv += `JENIS LAPORAN,LAPORAN NERACA (BALANCE SHEET)\n`;
      csv += `TANGGAL EKSPOR,${dateStr}\n`;
      csv += `TAHUN BUKU,${fiscalYear}\n\n`;
      csv += `BAGIAN AKTIVA (ASSETS)\n`;
      csv += `Kode Akun,Nama Akun,Saldo\n`;
      assetRows.forEach(r => csv += `"${r.accountCode}","${r.accountName}",${r.currentBalance}\n`);
      csv += `TOTAL AKTIVA,,${totalAssets}\n\n`;

      csv += `BAGIAN KEWAJIBAN & EKUITAS (LIABILITIES & EQUITY)\n`;
      csv += `Kode Akun,Nama Akun,Saldo\n`;
      liabilityRows.forEach(r => csv += `"${r.accountCode}","${r.accountName}",${r.currentBalance}\n`);
      csv += `Total Kewajiban Jangka Pendek,,${totalLiabilities}\n\n`;

      equityRows.forEach(r => {
        const val = r.balanceType === 'Debit' ? -r.currentBalance : r.currentBalance;
        csv += `"${r.accountCode}","${r.accountName}",${val}\n`;
      });
      csv += `3-2900,Laba Tahun Berjalan,${netProfitLoss}\n`;
      csv += `Total Ekuitas Penyesuaian,,${adjustedEquity}\n`;
      csv += `TOTAL PASIVA (KEWAJIBAN + EKUITAS),,${totalLiabilitiesAndEquity}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${companyName.replace(/\s+/g, '_')}_${activeReport}_${fiscalYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="reports_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:bg-white print:p-0 select-none">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800 print:w-full print:max-h-full print:border-none print:shadow-none print:bg-white">
        
        {/* Title bar emulating classic Windows */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500 select-none print:hidden">
          <span>
            📊 Laporan Keuangan Akhir Siklus (MYOB Reporting Centre)
          </span>
          <button id="close_reports_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs select-none">✕</button>
        </div>

        {/* Print & Selector Dashboard */}
        <div className="bg-[#f2f2ef] border-b border-stone-300 p-4 flex flex-wrap justify-between items-center gap-3 print:hidden text-xs select-none">
          {/* Controls */}
          <div className="flex gap-2 font-bold leading-normal">
            <button 
              id="report_tab_trial"
              onClick={() => setActiveReport('Trial')}
              className={`px-3 py-1.5 rounded transition flex items-center gap-1 cursor-pointer ${activeReport === 'Trial' ? 'bg-[#1e4682] text-white' : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'}`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Neraca Saldo (Trial Balance)
            </button>
            <button 
              id="report_tab_pandl"
              onClick={() => setActiveReport('ProfitLoss')}
              className={`px-3 py-1.5 rounded transition flex items-center gap-1 cursor-pointer ${activeReport === 'ProfitLoss' ? 'bg-[#1e4682] text-white' : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'}`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Laporan Laba Rugi (P&L)
            </button>
            <button 
              id="report_tab_balance"
              onClick={() => setActiveReport('BalanceSheet')}
              className={`px-3 py-1.5 rounded transition flex items-center gap-1 cursor-pointer ${activeReport === 'BalanceSheet' ? 'bg-[#1e4682] text-white' : 'bg-white border border-stone-300 text-[#1e4682] hover:bg-stone-50'}`}
            >
              <Layers className="w-3.5 h-3.5" /> Neraca Keuangan (Balance Sheet)
            </button>
          </div>

          <div className="flex gap-2 select-none">
            <button 
              id="report_export_csv_btn"
              onClick={handleExportCSV}
              className="bg-sky-700 hover:bg-sky-800 text-white font-bold px-4 py-1.5 rounded flex items-center gap-1 cursor-pointer shadow-sm active:translate-y-0.5"
            >
              <Download className="w-4 h-4" /> Ekspor ke Excel (CSV)
            </button>

            <button 
              id="report_print_btn"
              onClick={handlePrint}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-1.5 rounded flex items-center gap-1 cursor-pointer shadow-sm active:translate-y-0.5"
            >
              <Printer className="w-4 h-4" /> Cetak Laporan (Print)
            </button>
          </div>
        </div>

        {/* Ledger canvas */}
        <div className="p-6 flex-1 overflow-y-auto bg-white print:p-0 print:overflow-visible text-stone-900 font-sans">
          
          {/* Kop Surat (Financial cop) emulating professional accounting layouts */}
          <div className="text-center space-y-1 pb-6 border-b border-stone-300 select-text mb-6">
            <h2 className="text-xl uppercase font-bold tracking-wider text-stone-950 font-serif">{companyName}</h2>
            <h1 className="text-lg font-bold text-stone-800">
              {activeReport === 'Trial' && 'NERACA SALDO (TRIAL BALANCE)'}
              {activeReport === 'ProfitLoss' && 'LAPORAN LABA RUGI (PROFIT & LOSS STATEMENT)'}
              {activeReport === 'BalanceSheet' && 'LAPORAN NERACA (BALANCE SHEET / FINANCIAL RECONCILE)'}
            </h1>
            <p className="text-xs font-mono text-stone-500">
              {activeReport === 'Trial' && `Per Hari Ini Tahun Buku Akuntansi ${fiscalYear}`}
              {activeReport === 'ProfitLoss' && `Untuk Periode Buku Berakhir Desember ${fiscalYear}`}
              {activeReport === 'BalanceSheet' && `Per 31 Desember ${fiscalYear}`}
            </p>
          </div>

          {/* REPORT VIEW 1: TRIAL BALANCE (NERACA SALDO) */}
          {activeReport === 'Trial' && (
            <div id="report_content_trial" className="space-y-4">
              <table className="w-full text-xs font-mono select-text">
                <thead>
                  <tr className="bg-stone-100 uppercase text-stone-600 font-bold border-y border-stone-300">
                    <th className="py-2.5 text-left px-3">Kode Akun</th>
                    <th className="py-2.5 text-left">Nama Akun Ledger</th>
                    <th className="py-2.5 text-center">Indeks Normal</th>
                    <th className="py-2.5 text-right px-3">Saldo Debet (Rp)</th>
                    <th className="py-2.5 text-right px-3">Saldo Kredit (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {trialRows.map((row) => {
                    const isHeader = row.classification === 'Header';
                    
                    // Filter out header balances visually representing sum aggregations
                    const debitText = !isHeader && row.balanceType === 'Debit' ? formatIDR(row.currentBalance) : '-';
                    const creditText = !isHeader && row.balanceType === 'Credit' ? formatIDR(row.currentBalance) : '-';

                    return (
                      <tr 
                        key={row.accountCode} 
                        className={`${isHeader ? 'font-bold bg-amber-50/10 text-stone-950' : 'text-stone-700'}`}
                      >
                        <td className="py-2 px-3 font-semibold">{row.accountCode}</td>
                        <td className={`py-2 ${isHeader ? 'pl-0' : 'pl-6 border-l border-stone-150'}`}>{row.accountName}</td>
                        <td className="py-2 text-center text-stone-400 text-[10px]">{row.classification === 'Header' ? 'HDR' : row.balanceType}</td>
                        <td className="py-2 text-right px-3 font-medium">{debitText}</td>
                        <td className="py-2 text-right px-3 font-medium">{creditText}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 border-y-2 border-stone-400 font-bold text-stone-950">
                    <td colSpan={3} className="py-3 text-center uppercase tracking-wide">Total Saldo Seimbang (Balanced Check)</td>
                    <td className="py-3 text-right px-3 text-[#1e4682] font-mono font-bold">
                      {formatIDR(
                        trialRows
                          .filter(r => r.classification === 'Detail' && r.balanceType === 'Debit')
                          .reduce((sum, r) => sum + r.currentBalance, 0)
                      )}
                    </td>
                    <td className="py-3 text-right px-3 text-stone-950 font-mono font-bold">
                      {formatIDR(
                        trialRows
                          .filter(r => r.classification === 'Detail' && r.balanceType === 'Credit')
                          .reduce((sum, r) => sum + r.currentBalance, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* REPORT VIEW 2: PROFIT & LOSS (LABA RUGI) */}
          {activeReport === 'ProfitLoss' && (
            <div id="report_content_pandl" className="space-y-6 max-w-2xl mx-auto text-sm select-text">
              {/* REVENUE */}
              <div className="space-y-2">
                <h4 className="font-bold border-b border-stone-200 pb-1 uppercase text-stone-950">1. Pendapatan Usaha (Revenues)</h4>
                <div className="space-y-1 text-xs font-mono ml-4">
                  {revenueRows.map(r => (
                    <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-stone-700">
                      <span>{r.accountCode} &nbsp; {r.accountName}</span>
                      <span>{formatIDR(r.currentBalance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 font-bold text-stone-950 border-t border-stone-200 text-sm">
                    <span>Total Pendapatan Kotor</span>
                    <span>{formatIDR(totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* COST OF GOODS SOLD */}
              {totalCogs > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold border-b border-stone-200 pb-1 uppercase text-stone-950">2. Harga Pokok Penjualan (COGS / HPP)</h4>
                  <div className="space-y-1 text-xs font-mono ml-4">
                    {cogsRows.map(r => (
                      <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-stone-700">
                        <span>{r.accountCode} &nbsp; {r.accountName}</span>
                        <span>{formatIDR(r.currentBalance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1.5 font-bold text-stone-900 border-t border-stone-200 text-sm">
                      <span>Total Beban Pokok</span>
                      <span>{formatIDR(totalCogs)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* GROSS MARGIN */}
              <div className="flex justify-between border-y border-stone-300 py-2.5 font-bold text-stone-950 text-sm bg-stone-50 px-2 mt-2">
                <span>LABA KOTOR (Gross Profit Margin)</span>
                <span>{formatIDR(grossProfit)}</span>
              </div>

              {/* OPERATIONAL EXPENSES */}
              <div className="space-y-2">
                <h4 className="font-bold border-b border-stone-200 pb-1 uppercase text-stone-950">3. Beban Operasional Usaha (Operating Expenses)</h4>
                <div className="space-y-1 text-xs font-mono ml-4">
                  {expenseRows.map(r => (
                    <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-stone-700">
                      <span>{r.accountCode} &nbsp; {r.accountName}</span>
                      <span>{formatIDR(r.currentBalance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 font-bold text-stone-900 border-t border-stone-200 text-sm">
                    <span>Total Pengeluaran Beban Usaha</span>
                    <span>{formatIDR(totalExpenses)}</span>
                  </div>
                </div>
              </div>

              {/* NON-OPERATING INCOME & EXPENSE */}
              {(totalOtherIncome > 0 || totalOtherExpense > 0) && (
                <div className="space-y-2">
                  <h4 className="font-bold border-b border-stone-200 pb-1 uppercase text-stone-950">4. Pendapatan & Beban Lain-Lain</h4>
                  <div className="space-y-1 text-xs font-mono ml-4">
                    {otherIncomeRows.map(r => (
                      <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-emerald-800">
                        <span>{r.accountCode} &nbsp; {r.accountName} (Dr)</span>
                        <span>{formatIDR(r.currentBalance)}</span>
                      </div>
                    ))}
                    {otherExpenseRows.map(r => (
                      <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-red-800">
                        <span>{r.accountCode} &nbsp; {r.accountName} (Cr)</span>
                        <span>({formatIDR(r.currentBalance)})</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1.5 font-bold text-stone-900 border-t border-stone-200 text-sm">
                      <span>Selisih Keuangan Non-Operasional</span>
                      <span>{formatIDR(totalOtherIncome - totalOtherExpense)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* FINAL NET REVENUE BOTTOM TALLY */}
              <div className="border-t-2 border-stone-400 border-b-4 border-double border-stone-950 py-3 font-bold text-[#1e4682] text-base flex justify-between bg-stone-100/50 px-3 mt-6">
                <span>LABA / RUGI BERSIH (Net Income / Loss)</span>
                <span className={netProfitLoss >= 0 ? 'text-green-800' : 'text-red-800'}>
                  {netProfitLoss >= 0 ? formatIDR(netProfitLoss) : `(${formatIDR(Math.abs(netProfitLoss))})`}
                </span>
              </div>
            </div>
          )}

          {/* REPORT VIEW 3: BALANCE SHEET (NERACA) */}
          {activeReport === 'BalanceSheet' && (
            <div id="report_content_balancesheet" className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm select-text">
              {/* LEFT Column: ASSETS */}
              <div className="space-y-4">
                <h3 className="font-bold border-b-2 border-stone-400 pb-1 uppercase text-stone-950 flex justify-between text-base">
                  <span>SISI AKTIVA (ASSETS)</span>
                  <span className="text-stone-400">AKTIVA</span>
                </h3>

                <div className="space-y-1.5 text-xs font-mono ml-2">
                  {assetRows.length === 0 ? (
                    <div className="text-stone-400 font-serif">Belum ada rincian aktiva terdaftar.</div>
                  ) : (
                    assetRows.map(r => (
                      <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-stone-800">
                        <span>{r.accountCode} &nbsp; {r.accountName}</span>
                        {/* Under standard contra assets, accumulated depreciation values are stored as negative and reduce assets */}
                        <span>{formatIDR(r.currentBalance)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between py-3 font-bold text-stone-950 border-t border-stone-300 text-sm mt-3 bg-stone-50 px-2 font-sans/95">
                    <span>JUMLAH AKTIVA (Total Assets)</span>
                    <span className="text-[#1e4682]">{formatIDR(totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT Column: LIABILITIES & EQUITY */}
              <div className="space-y-6">
                {/* liabilities */}
                <div className="space-y-3">
                  <h3 className="font-bold border-b-2 border-stone-400 pb-1 uppercase text-stone-950 flex justify-between text-base">
                    <span>KEWAJIBAN & EKUITAS</span>
                    <span className="text-stone-400">PASIVA</span>
                  </h3>

                  <div className="space-y-1 text-xs font-mono ml-2">
                    <span className="block font-bold text-stone-500 uppercase tracking-wide text-[9px] mb-1">Kewajiban Jangka Pendek (Liabilities)</span>
                    {liabilityRows.length === 0 ? (
                      <div className="text-stone-400 py-1 font-serif">Bebas utang usaha.</div>
                    ) : (
                      liabilityRows.map(r => (
                        <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-stone-700">
                          <span>{r.accountCode} &nbsp; {r.accountName}</span>
                          <span>{formatIDR(r.currentBalance)}</span>
                        </div>
                      ))
                    )}
                    <div className="flex justify-between py-1.5 font-bold text-stone-900 border-t border-stone-200 text-xs">
                      <span>Total Kewajiban Utang</span>
                      <span>{formatIDR(totalLiabilities)}</span>
                    </div>
                  </div>
                </div>

                {/* equities */}
                <div className="space-y-3">
                  <div className="space-y-1 text-xs font-mono ml-2">
                    <span className="block font-bold text-stone-500 uppercase tracking-wide text-[9px] mb-1">Sektor Ekuitas Modal (Equity)</span>
                    {equityRows.map(r => (
                      <div key={r.accountCode} className="flex justify-between py-1 border-b border-dashed border-stone-100 text-stone-700">
                        <span>{r.accountCode} &nbsp; {r.accountName}</span>
                        {/* Double entry alignment handling */}
                        <span>
                          {r.balanceType === 'Debit' ? `(${formatIDR(r.currentBalance)})` : formatIDR(r.currentBalance)}
                        </span>
                      </div>
                    ))}
                    
                    {/* Direct P&L dynamic insert */}
                    <div className="flex justify-between py-1 border-b border-dashed border-stone-150 text-sky-800 font-bold bg-sky-50/20">
                      <span>3-2900 &nbsp; Laba Tahun Berjalan (Laba/Rugi Bersih)</span>
                      <span>{formatIDR(netProfitLoss)}</span>
                    </div>

                    <div className="flex justify-between py-1.5 font-bold text-stone-900 border-t border-stone-200 text-xs">
                      <span>Total Ekuitas Penyesuaian</span>
                      <span>{formatIDR(adjustedEquity)}</span>
                    </div>
                  </div>
                </div>

                {/* Pasiva Total aggregation */}
                <div className="flex justify-between py-3 font-bold text-stone-950 border-t border-stone-300 text-sm bg-stone-50 px-2 mt-3 font-sans/95">
                  <span>JUMLAH PASIVA (Total Liabilities + Equity)</span>
                  <span>{formatIDR(totalLiabilitiesAndEquity)}</span>
                </div>
              </div>

              {/* Absolute Balance Indicator */}
              <div className="col-span-1 md:col-span-2 pt-4 border-t border-stone-200 text-center select-none print:hidden">
                {Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01 ? (
                  <div id="balance_sheet_status_badge" className="inline-block bg-green-100 border-2 border-green-400 text-green-800 px-6 py-2 rounded-full font-bold">
                    ✓ PERSAMAAN AKUNTANSI SEIMBANG (BALANCE) • Aktiva = Pasiva ({formatIDR(totalAssets)})
                  </div>
                ) : (
                  <div id="balance_sheet_status_badge" className="inline-block bg-red-100 border-2 border-red-400 text-red-800 px-6 py-2 rounded-full font-bold animate-pulse">
                    ⚠ LAPORAN NERACA TIDAK SEIMBANG! Selisih Aktiva & Pasiva: Rp {Math.abs(totalAssets - totalLiabilitiesAndEquity).toLocaleString('id-ID')}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer print action */}
        <div className="bg-[#eaeae6] border-t border-stone-300 p-3.5 flex justify-between items-center text-xs print:hidden select-none">
          <span className="text-stone-500 font-mono">Formulasi otomatis berdasarkan real-time database queries & penyesuaian.</span>
          <button 
            id="close_reports_footer_btn"
            onClick={onClose}
            className="bg-stone-300 hover:bg-stone-400 border border-stone-400 text-stone-700 font-bold px-4 py-1.5 rounded cursor-pointer shadow-sm active:translate-y-0.5 select-none"
          >
            Tutup Laporan
          </button>
        </div>

      </div>
    </div>
  );
}
