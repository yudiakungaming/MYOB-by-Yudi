/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobAccount, MyobJournal, JournalLine, MyobCard, JournalSource } from '../types';
import { CreditCard, DollarSign, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface SpendReceiveModalProps {
  userId: string;
  companyId: string;
  accounts: MyobAccount[];
  cards: MyobCard[];
  onClose: () => void;
  onRefresh: () => void;
  defaultMode: 'Spend' | 'Receive';
}

interface AllocationLine {
  accountId: string;
  amount: string; // string for editing
  memo: string;
  taxCode: 'PPN' | 'N-T';
}

export default function SpendReceiveModal({ userId, companyId, accounts, cards, onClose, onRefresh, defaultMode }: SpendReceiveModalProps) {
  const [mode, setMode] = useState<'Spend' | 'Receive'>(defaultMode);
  const [cashAccount, setCashAccount] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [totalAmount, setTotalAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [allocations, setAllocations] = useState<AllocationLine[]>([
    { accountId: '', amount: '', memo: '', taxCode: 'N-T' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-filter Cash & Cash Equivalent (Assets starting with "1-11" or containing Kas/Bank)
  const bankAccounts = accounts.filter(
    a => a.classification === 'Detail' && a.type === 'Asset' && 
    (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))
  );

  useEffect(() => {
    // Set default bank account
    if (bankAccounts.length > 0 && !cashAccount) {
      setCashAccount(bankAccounts[0].id);
    }
  }, [bankAccounts, cashAccount]);

  // Handle adding allocation line
  const handleAddLine = () => {
    setAllocations([...allocations, { accountId: '', amount: '', memo: '', taxCode: 'N-T' }]);
  };

  const handleRemoveLine = (idx: number) => {
    const list = [...allocations];
    list.splice(idx, 1);
    setAllocations(list);
  };

  const handleLineChange = (idx: number, field: keyof AllocationLine, val: string) => {
    const list = [...allocations];
    list[idx][field] = val;
    setAllocations(list);
  };

  // Math totals calculation
  const totalAllocated = allocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const leftToAllocate = (Number(totalAmount) || 0) - totalAllocated;

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Form Validations
    if (!cashAccount) {
      setError('Harap tentukan rekening Kas / Bank penampung dana!');
      return;
    }
    if (!selectedCardId) {
      setError('Harap tentukan entitas kontak (Card/Sipenerima) pembukuan!');
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      setError('Nominal nominal transaksi harus bernilai lebih besar dari 0!');
      return;
    }
    if (Math.abs(leftToAllocate) > 0.01) {
      setError(`Jumlah alokasi dana tidak berimbang dengan nilai transaksi utama (Selisih: Rp ${leftToAllocate}).`);
      return;
    }

    // Filter valid allocation lines
    const validLines: AllocationLine[] = [];
    for (let i = 0; i < allocations.length; i++) {
      const line = allocations[i];
      if (!line.accountId) {
        setError(`Alokasi pada baris #${i + 1} tidak memiliki pilihan akun.`);
        return;
      }
      const amt = Number(line.amount) || 0;
      if (amt <= 0) {
        setError(`Nominal alokasi baris #${i + 1} harus bernilai di atas Rp 0.`);
        return;
      }
      validLines.push(line);
    }

    if (validLines.length === 0) {
      setError('Minimal memerlukan 1 baris pembagian akun alokasi.');
      return;
    }

    setLoading(true);
    const journalId = 'jr_' + Math.random().toString(36).substring(2, 15);
    const path = `users/${userId}/companies/${companyId}/journals/${journalId}`;

    // Get Account info for Kas/Bank
    const bankAccountInfo = accounts.find(a => a.id === cashAccount);
    const bankName = bankAccountInfo ? bankAccountInfo.name : 'Kas/Bank';

    // Generate balanced double entry lines
    const journalLines: JournalLine[] = [];
    const mainAmt = Number(totalAmount);
    let totalTaxCollected = 0;

    const distributionLines: { accountId: string; accountName: string; netAmount: number; taxAmount: number }[] = [];

    validLines.forEach(line => {
      const acc = accounts.find(a => a.id === line.accountId);
      const accName = acc ? acc.name : 'Distribution';
      const grossAmt = Number(line.amount);
      let netAmt = grossAmt;
      let taxAmt = 0;

      if (line.taxCode === 'PPN') {
        netAmt = Math.round((grossAmt / 1.11) * 100) / 100;
        taxAmt = Math.round((grossAmt - netAmt) * 100) / 100;
        totalTaxCollected += taxAmt;
      }

      distributionLines.push({
        accountId: line.accountId,
        accountName: accName,
        netAmount: netAmt,
        taxAmount: taxAmt
      });
    });

    // Resolve PPN Tax account code (e.g. 2-1200 or any other with PPN name)
    const taxAccountInfo = accounts.find(a => a.id === '2-1200' || a.name.toLowerCase().includes('ppn') || a.name.toLowerCase().includes('pajak')) 
      || accounts.find(a => a.id.startsWith('2-')) 
      || accounts.find(a => a.id.startsWith('1-')) 
      || accounts[0];

    if (mode === 'Spend') {
      // SPEND MONEY JOURNAL:
      // Debit: Allocation Accounts with Net Amounts
      distributionLines.forEach(line => {
        journalLines.push({
          accountId: line.accountId,
          accountName: line.accountName,
          debit: line.netAmount,
          credit: 0
        });
      });

      // Debit: Tax Account with total tax amount
      if (totalTaxCollected > 0) {
        journalLines.push({
          accountId: taxAccountInfo.id,
          accountName: `${taxAccountInfo.name} (PPN)`,
          debit: Math.round(totalTaxCollected * 100) / 100,
          credit: 0
        });
      }

      // Credit: Cash/Bank Account with gross full amount
      journalLines.push({
        accountId: cashAccount,
        accountName: bankName,
        debit: 0,
        credit: mainAmt
      });
    } else {
      // RECEIVE MONEY JOURNAL:
      // Debit: Cash/Bank Account with gross full amount
      journalLines.push({
        accountId: cashAccount,
        accountName: bankName,
        debit: mainAmt,
        credit: 0
      });

      // Credit: Allocation Accounts with Net Amounts
      distributionLines.forEach(line => {
        journalLines.push({
          accountId: line.accountId,
          accountName: line.accountName,
          debit: 0,
          credit: line.netAmount
        });
      });

      // Credit: Tax Account with total tax amount
      if (totalTaxCollected > 0) {
        journalLines.push({
          accountId: taxAccountInfo.id,
          accountName: `${taxAccountInfo.name} (PPN)`,
          debit: 0,
          credit: Math.round(totalTaxCollected * 100) / 100
        });
      }
    }

    // Identify memo or build default explanation
    const cardInfo = cards.find(c => c.id === selectedCardId);
    const contactName = cardInfo ? cardInfo.name : 'Kontak';
    const finalExplanation = memo.trim() || `${mode === 'Spend' ? 'Spend Money to' : 'Receive Money from'} ${contactName}`;

    // Source mapping
    const source: JournalSource = mode === 'Spend' ? 'Spend Money' : 'Receive Money';
    const prefix = mode === 'Spend' ? 'CD' : 'CR'; // Cash Disbursement / Cash Receipt
    const referenceNum = prefix + Math.floor(1000 + Math.random() * 9000);

    try {
      const journalData: MyobJournal = {
        id: journalId,
        referenceNum,
        date,
        explanation: finalExplanation,
        source,
        lines: journalLines,
        totalAmount: mainAmt,
        createdAt: new Date().toISOString()
      };

      // Save journal write
      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'journals', journalId), journalData);

      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Error saving cash transaction:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (logErr) {
        setError('Gagal membukukan voucher kas. Harap cek sambungan cloud Firestore database.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Format currencies
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div id="spend_receive_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-none">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800">
        
        {/* Title bar resembling MYOB visual style */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center border-b border-stone-500 font-bold text-sm">
          <span className="flex items-center gap-2">
            🏦 Modul Transaksi Perbankan (Spend & Receive Money)
          </span>
          <button id="close_banking_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs">✕</button>
        </div>

        {/* Action Toggle Tab Row */}
        <div className="flex bg-[#d7d7d2] px-4 pt-2.5 pb-0 border-b border-stone-300 gap-1.5 text-xs font-bold leading-normal">
          <button 
            type="button"
            id="toggle_spend_tab"
            onClick={() => setMode('Spend')}
            className={`px-4 py-2 rounded-t-lg transition flex items-center gap-1 cursor-pointer ${mode === 'Spend' ? 'bg-[#e5e5e0] text-[#1e4682]' : 'bg-[#c5c5be] text-stone-600 hover:bg-[#b5b5ad]'}`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Spend Money (Keluar Kas)
          </button>
          <button 
            type="button"
            id="toggle_receive_tab"
            onClick={() => setMode('Receive')}
            className={`px-4 py-2 rounded-t-lg transition flex items-center gap-1 cursor-pointer ${mode === 'Receive' ? 'bg-[#e5e5e0] text-emerald-800' : 'bg-[#c5c5be] text-stone-600 hover:bg-[#b5b5ad]'}`}
          >
            <DollarSign className="w-3.5 h-3.5" /> Receive Money (Terima Kas)
          </button>
        </div>

        {/* Content Container */}
        <form onSubmit={handleRecordTransaction} className="flex-1 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4 text-xs font-sans">
            {error && (
              <div id="banking_error_msg" className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded">
                {error}
              </div>
            )}

            {/* Billing fields panel */}
            <div className="bg-[#eaeae6] border border-stone-300 rounded p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column Fields */}
              <div className="space-y-3">
                {/* Cash penampung */}
                <div>
                  <label className="block font-bold text-stone-600 uppercase mb-1">
                    {mode === 'Spend' ? 'Dibayarkan Dari (Account Kas/Bank)' : 'Setor Ke Rekening (Account Kas/Bank)'} *
                  </label>
                  <select
                    id="banking_cash_account_select"
                    value={cashAccount}
                    onChange={(e) => setCashAccount(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800 text-sm font-semibold"
                    required
                  >
                    <option value="">-- Pilih Buku Rekening Finansial --</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.id} &nbsp; {acc.name} ({formatIDR(acc.openingBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card Contact (Customers / Payee) */}
                <div>
                  <label className="block font-bold text-stone-600 uppercase mb-1">
                    {mode === 'Spend' ? 'Penerima Pembayaran (Card / Supplier)' : 'Sipenyetor Pembayaran (Card / Customer)'} *
                  </label>
                  <select
                    id="banking_card_select"
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800 text-sm"
                    required
                  >
                    <option value="">-- Pilih Kontak dalam Directory --</option>
                    {cards.map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.type}] &nbsp; {c.name} ({c.cardIdCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Column Fields */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Date */}
                  <div>
                    <label className="block font-bold text-stone-600 uppercase mb-1">Tanggal Bayar</label>
                    <input 
                      id="banking_date_input"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-stone-800 font-mono"
                      required
                    />
                  </div>

                  {/* Principal Sum */}
                  <div>
                    <label className="block font-bold text-stone-600 uppercase mb-1">Jumlah Nominal (Rp) *</label>
                    <input 
                      id="banking_amount_input"
                      type="number"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="e.g. 5000000"
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-stone-800 font-mono font-bold text-sm text-right"
                      min={1}
                      required
                    />
                  </div>
                </div>

                {/* Central Memo */}
                <div>
                  <label className="block font-bold text-stone-600 uppercase mb-1">Memorandum / Penjelasan Akuntansi</label>
                  <input 
                    id="banking_memo_input"
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Contoh: Bayar tagihan internet Megacity"
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-stone-800"
                  />
                </div>
              </div>
            </div>

            {/* Distribution Accounts Allocation Board */}
            <div className="bg-white border border-stone-300 rounded overflow-hidden shadow-inner">
              <div className="bg-[#eaeae6] border-b border-stone-300 grid grid-cols-12 text-[10px] uppercase font-bold text-stone-600 font-mono py-1.5 px-3">
                <span className="col-span-1 text-center font-mono">Baris</span>
                <span className="col-span-4 pl-2 font-mono">Alokasi Rekening Akun (Distribution Account)</span>
                <span className="col-span-2 text-right pr-6 font-mono">Jumlah (Rp)</span>
                <span className="col-span-2 pl-2 font-mono">Memo Line</span>
                <span className="col-span-2 text-center font-mono">Pajak (Tax)</span>
                <span className="col-span-1 text-center font-mono">Aksi</span>
              </div>

              <div className="divide-y divide-stone-150 min-h-[150px]">
                {allocations.map((alloc, idx) => (
                  <div key={idx} id={`banking_alloc_row_${idx}`} className="grid grid-cols-12 py-2 px-3 items-center">
                    <span className="col-span-1 text-center font-mono font-bold text-stone-400">{idx + 1}</span>
                    
                    {/* Select allocation target */}
                    <div className="col-span-4 px-1">
                      <select
                        id={`banking_alloc_account_${idx}`}
                        value={alloc.accountId}
                        onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-1.5 py-1 text-stone-800"
                        required
                      >
                        <option value="">-- Pilih Rekening Alokasi --</option>
                        {accounts
                          .filter(a => a.classification === 'Detail' && a.id !== cashAccount)
                          .map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.id} &nbsp; {acc.name} ({acc.type})
                            </option>
                          ))
                        }
                      </select>
                    </div>

                    {/* Numeric amount */}
                    <div className="col-span-2 px-1">
                      <input 
                        id={`banking_alloc_amount_${idx}`}
                        type="number"
                        value={alloc.amount}
                        placeholder="0"
                        onChange={(e) => handleLineChange(idx, 'amount', e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-1.5 py-1 text-right font-mono"
                        min={1}
                        required
                      />
                    </div>

                    {/* Optional Line memo */}
                    <div className="col-span-2 px-1">
                      <input 
                        id={`banking_alloc_memo_${idx}`}
                        type="text"
                        value={alloc.memo}
                        placeholder="Memo opsional"
                        onChange={(e) => handleLineChange(idx, 'memo', e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-1.5 py-1 text-stone-800"
                      />
                    </div>

                    {/* Tax select */}
                    <div className="col-span-2 px-1">
                      <select
                        id={`banking_alloc_tax_${idx}`}
                        value={alloc.taxCode}
                        onChange={(e) => handleLineChange(idx, 'taxCode', e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-1.5 py-1 text-center font-bold text-stone-800"
                      >
                        <option value="N-T font-mono">N-T (0%)</option>
                        <option value="PPN font-mono">PPN (11%)</option>
                      </select>
                    </div>

                    {/* Line remover */}
                    <div className="col-span-1 text-center">
                      <button
                        id={`banking_delete_row_btn_${idx}`}
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={allocations.length <= 1}
                        className="text-stone-400 hover:text-red-700 disabled:opacity-30 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add row */}
              <div className="bg-[#fbfcfa] border-t border-stone-200 p-2">
                <button
                  id="banking_add_alloc_row_btn"
                  type="button"
                  onClick={handleAddLine}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold px-3 py-1 border border-stone-300 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#1e4682]" /> Tambah Alokasi Baru
                </button>
              </div>
            </div>

            {/* Check allocation balancing */}
            <div className="bg-[#e0e0da] border border-stone-300 rounded p-4 flex justify-between font-mono text-xs items-center select-none">
              <div className="space-y-0.5">
                <div>Total Dana Terpotong: <strong>{formatIDR(Number(totalAmount) || 0)}</strong></div>
                <div>Jumlah Alokasi Terdistribusi: <strong>{formatIDR(totalAllocated)}</strong></div>
              </div>

              <div className="text-right">
                <span className="block text-[9px] uppercase font-bold text-stone-500 tracking-wider">Sisa Saldo Alokasi</span>
                {leftToAllocate === 0 ? (
                  <span id="banking_balanced_badge" className="inline-block bg-green-100 border border-green-400 text-green-800 font-bold px-3 py-1 rounded mt-1 shadow-sm font-mono">
                    ✓ TERBAGI RATA (Rp 0)
                  </span>
                ) : (
                  <span id="banking_unbalanced_badge" className="inline-block bg-red-100 border border-red-400 text-red-800 font-bold px-3 py-1 rounded mt-1 shadow-sm font-mono">
                    ⚠ Sisa: Rp {leftToAllocate.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions controllers */}
          <div className="bg-[#eaeae6] border-t border-stone-300 p-4 flex justify-end gap-2 text-xs mt-auto">
            <button
              id="banking_cancel_btn"
              type="button"
              onClick={onClose}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold px-4 py-2 border border-stone-400 rounded cursor-pointer"
            >
              Batal
            </button>
            <button
              id="banking_post_btn"
              type="submit"
              disabled={loading || Math.abs(leftToAllocate) > 0.01}
              className="bg-[#1e4682] disabled:bg-[#1e4682]/40 disabled:cursor-not-allowed hover:bg-[#153460] text-white font-bold px-6 py-2 border border-[#143460] rounded cursor-pointer flex items-center gap-1 active:translate-y-0.5 shadow-md animate-none"
            >
              {loading ? 'Posting Transaksi Kas...' : 'Post Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
