/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MyobAccount, MyobJournal } from '../types';
import { CreditCard, Calendar, CheckSquare, Square, AlertCircle, RefreshCw } from 'lucide-react';

interface BankReconciliationModalProps {
  userId: string;
  companyId: string;
  accounts: MyobAccount[];
  journals: MyobJournal[];
  onClose: () => void;
}

export default function BankReconciliationModal({ userId, companyId, accounts, journals, onClose }: BankReconciliationModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().substring(0, 10));
  const [statementEndingBalance, setStatementEndingBalance] = useState('');
  const [clearedTxIds, setClearedTxIds] = useState<Set<string>>(new Set());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter Cash & Cash equivalent accounts
  const cashAccounts = accounts.filter(
    a => a.classification === 'Detail' && a.type === 'Asset' && 
    (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))
  );

  useEffect(() => {
    if (cashAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(cashAccounts[0].id);
    }
  }, [cashAccounts, selectedAccountId]);

  const targetAccount = accounts.find(a => a.id === selectedAccountId);
  
  // Find all postings touching the selected cash account across all recorded journals
  interface CashTxRow {
    id: string; // journal ID + index to ensure uniqueness if multiple lines
    journalId: string;
    referenceNum: string;
    date: string;
    explanation: string;
    source: string;
    deposit: number; // Debit if deposit
    withdrawal: number; // Credit if withdrawal
  }

  const getCashTransactions = (): CashTxRow[] => {
    if (!selectedAccountId) return [];
    
    const list: CashTxRow[] = [];
    journals.forEach(j => {
      j.lines.forEach((line, idx) => {
        if (line.accountId === selectedAccountId) {
          list.push({
            id: `${j.id}_${idx}`,
            journalId: j.id,
            referenceNum: j.referenceNum,
            date: j.date,
            explanation: j.explanation,
            source: j.source,
            deposit: line.debit,
            withdrawal: line.credit
          });
        }
      });
    });

    // Sort by date descending
    return list.sort((a,b) => b.date.localeCompare(a.date));
  };

  const txRows = getCashTransactions();

  // Calculations
  const openingBalance = targetAccount ? targetAccount.openingBalance : 0;
  
  // Totals for clearmarked transactions
  let totalClearedDeposits = 0;
  let totalClearedWithdrawals = 0;

  txRows.forEach(row => {
    if (clearedTxIds.has(row.id)) {
      totalClearedDeposits += row.deposit;
      totalClearedWithdrawals += row.withdrawal;
    }
  });

  const calculatedClearedBalance = openingBalance + totalClearedDeposits - totalClearedWithdrawals;
  const targetEndingStmt = Number(statementEndingBalance) || 0;
  const differenceValue = targetEndingStmt - calculatedClearedBalance;

  const handleToggleClear = (id: string) => {
    const next = new Set(clearedTxIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setClearedTxIds(next);
  };

  const handleClearAll = () => {
    const next = new Set<string>();
    txRows.forEach(row => next.add(row.id));
    setClearedTxIds(next);
  };

  const handleUnclearAll = () => {
    setClearedTxIds(new Set());
  };

  const handleSaveReconciliation = (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(differenceValue) > 0.01) {
      alert('Gagal: Selisih (Out of Balance) harus bernilai Rp 0 sebelum Anda dapat merekonsiliasi akun bank ini.');
      return;
    }

    setSuccessMsg(`Berhasil! Rekonsiliasi Rekening ${targetAccount?.name} (${selectedAccountId}) telah berhasil dibukukan dengan sisa selisih Rp 0 per tanggal ${statementDate}.`);
    
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 4500);
  };

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div id="bank_reconciliation_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-none">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800 font-sans">
        
        {/* Title Bar */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500">
          <span className="flex items-center gap-2">
            🏦 Reconcile Accounts (Rekonsiliasi Rekening Bank & Kas)
          </span>
          <button id="close_bank_recon_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs select-none">✕</button>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div id="recon_success_banner" className="bg-green-100 border-b border-green-400 text-green-850 p-3 text-xs font-bold text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSaveReconciliation} className="flex-1 flex flex-col overflow-hidden">
          {/* Statement Info Board */}
          <div className="bg-[#eaeae6] border-b border-stone-300 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs select-none">
            
            {/* Account Selector */}
            <div>
              <label className="block font-bold text-stone-600 uppercase mb-1">Akun Kas / Bank Untuk Rekonsiliasi *</label>
              <select
                id="recon_account_select"
                value={selectedAccountId}
                onChange={(e) => { setSelectedAccountId(e.target.value); setClearedTxIds(new Set()); }}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-stone-800 font-bold"
                required
              >
                <option value="">-- Silakan Pilih Akun Kas --</option>
                {cashAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.id} &nbsp; {a.name}</option>
                ))}
              </select>
            </div>

            {/* Date input */}
            <div>
              <label className="block font-bold text-stone-600 uppercase mb-1">Tanggal Rekor Rekonsiliasi</label>
              <div className="relative">
                <input 
                  id="recon_statement_date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-stone-800"
                  required
                />
              </div>
            </div>

            {/* Statement Ending Balance input */}
            <div>
              <label className="block font-bold text-stone-600 uppercase mb-1">Saldo Akhir Rekening Koran (Bank Statement) *</label>
              <input 
                id="recon_statement_balance"
                type="number"
                value={statementEndingBalance}
                onChange={(e) => setStatementEndingBalance(e.target.value)}
                placeholder="Masukkan saldo dari Bank Koran"
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono font-bold text-right text-stone-800"
                required
              />
            </div>
          </div>

          {/* Core spreadsheet comparison view */}
          <div className="p-4 flex-1 overflow-y-auto bg-[#e5e5e0]">
            <div className="bg-white border-2 border-stone-300 rounded shadow-inner overflow-hidden min-h-[220px]">
              
              {/* Header */}
              <div className="grid grid-cols-12 bg-[#eaeae6] border-b border-stone-300 text-[10px] uppercase font-bold font-mono py-2 px-3 tracking-wider text-stone-600">
                <span className="col-span-1 text-center">Cleared</span>
                <span className="col-span-2 text-left">Tanggal</span>
                <span className="col-span-2 text-left">Referensi</span>
                <span className="col-span-3 text-left">Memo Penjelasan</span>
                <span className="col-span-2 text-right pr-4">Setoran (+)</span>
                <span className="col-span-2 text-right pr-4">Penarikan (-)</span>
              </div>

              {/* Body */}
              <div className="divide-y divide-stone-150 text-xs">
                {txRows.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 font-medium font-serif">
                    Belum ada riwayat transaksi debit/kredit yang dipos ke rekening kas/bank terpilih ini.
                  </div>
                ) : (
                  txRows.map((row) => {
                    const isCleared = clearedTxIds.has(row.id);
                    return (
                      <div 
                        key={row.id}
                        id={`recon_row_${row.id}`}
                        onClick={() => handleToggleClear(row.id)}
                        className={`grid grid-cols-12 py-2 px-3 items-center transition cursor-pointer select-none ${isCleared ? 'bg-sky-50/10 font-medium' : 'hover:bg-stone-50'}`}
                      >
                        {/* Checker Cleared */}
                        <div className="col-span-1 text-center flex justify-center">
                          {isCleared ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-300" />
                          )}
                        </div>

                        {/* Date */}
                        <span className="col-span-2 font-mono text-stone-700">{row.date}</span>

                        {/* Ref */}
                        <span className="col-span-2 font-mono font-bold text-[#1e4682]">{row.referenceNum}</span>

                        {/* Memo */}
                        <span className="col-span-3 truncate text-stone-800 pr-2">{row.explanation}</span>

                        {/* Deposit credit */}
                        <span className={`col-span-2 text-right font-mono pr-4 ${row.deposit > 0 ? 'text-green-800 font-bold' : 'text-stone-300'}`}>
                          {row.deposit > 0 ? formatIDR(row.deposit) : '-'}
                        </span>

                        {/* Withdrawal debit */}
                        <span className={`col-span-2 text-right font-mono pr-4 ${row.withdrawal > 0 ? 'text-red-700' : 'text-stone-300'}`}>
                          {row.withdrawal > 0 ? formatIDR(row.withdrawal) : '-'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick selectors triggers */}
            {txRows.length > 0 && (
              <div className="flex gap-2.5 mt-2.5 select-none text-xs">
                <button
                  type="button"
                  id="recon_select_all"
                  onClick={handleClearAll}
                  className="bg-stone-200 border border-stone-400 px-3 py-1 rounded text-stone-700 hover:bg-stone-300 font-semibold cursor-pointer"
                >
                  Tandai Semua Sudah Kliring
                </button>
                <button
                  type="button"
                  id="recon_deselect_all"
                  onClick={handleUnclearAll}
                  className="bg-stone-200 border border-stone-400 px-3 py-1 rounded text-stone-700 hover:bg-stone-300 font-semibold cursor-pointer"
                >
                  Kosongkan Semua
                </button>
              </div>
            )}
          </div>

          {/* Mathematical alignment console */}
          <div className="bg-[#dfdfda] border-t border-stone-300 p-4 gap-4 grid grid-cols-1 md:grid-cols-2 text-xs font-mono select-none">
            {/* Calculation details */}
            <div className="space-y-1.5">
              <div className="flex justify-between border-b border-stone-200 pb-1">
                <span className="text-stone-500">Saldo Awal Buku (Book Opening):</span>
                <span className="font-bold text-stone-900">{formatIDR(openingBalance)}</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-1 text-green-800 font-bold">
                <span>(+) Setoran Terkliring (Cleared Deposits):</span>
                <span>{formatIDR(totalClearedDeposits)}</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-1 text-red-800">
                <span>(-) Penarikan Terkliring (Cleared Withdrawals):</span>
                <span>({formatIDR(totalClearedWithdrawals)})</span>
              </div>
              <div className="flex justify-between font-bold text-stone-950 text-sm bg-stone-100/40 p-1.5 rounded">
                <span>(=) Saldo Buku Terkliring (Calculated Book Balance):</span>
                <span>{formatIDR(calculatedClearedBalance)}</span>
              </div>
            </div>

            {/* Alignments Out of Balance indicator */}
            <div className="flex flex-col justify-center items-center md:items-end text-center md:text-right">
              <span className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider">Out of Balance (Selisih Sisa)</span>
              {Math.abs(differenceValue) === 0 ? (
                <div className="bg-green-100 border border-green-500 text-green-900 px-4 py-2 mt-1.5 rounded font-bold text-sm shadow-sm">
                  ✓ SEIMBANG (Rp 0)
                </div>
              ) : (
                <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-2 mt-1.5 rounded font-bold text-sm shadow-sm animate-pulse flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-700" />
                  <span>{differenceValue < 0 ? '-' : ''}{formatIDR(Math.abs(differenceValue))}</span>
                </div>
              )}
              <span className="text-[10px] text-stone-400 font-sans mt-2">Saldo buku terkliring harus sama persis dengan saldo rekening koran bank.</span>
            </div>
          </div>

          {/* Action Footer Button Drawer */}
          <div className="bg-[#eaeae6] border-t border-stone-300 p-4 flex justify-end gap-2 text-xs">
            <button 
              id="recon_cancel_btn"
              type="button" 
              onClick={onClose}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold px-4 py-2 border border-stone-400 rounded cursor-pointer"
            >
              Batal
            </button>
            <button 
              id="recon_post_btn"
              type="submit"
              disabled={Math.abs(differenceValue) > 0.01}
              className="bg-[#1e4682] disabled:bg-[#1e4682]/40 disabled:cursor-not-allowed hover:bg-[#153460] text-white font-bold px-6 py-2 border border-[#143460] rounded cursor-pointer shadow-md select-none"
            >
              Post Reconciliation
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
