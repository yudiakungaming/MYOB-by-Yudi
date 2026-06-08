/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobAccount, MyobJournal, JournalLine } from '../types';
import { Trash2, Plus, Calendar, Disc, CheckSquare, RefreshCw } from 'lucide-react';

interface RecordJournalModalProps {
  userId: string;
  companyId: string;
  accounts: MyobAccount[];
  onClose: () => void;
  onRefresh: () => void;
  lastReferenceNum?: string;
}

interface TempLine {
  accountId: string;
  debit: string; // string for input typing comfort
  credit: string; // string for input typing comfort
}

export default function RecordJournalModal({ userId, companyId, accounts, onClose, onRefresh, lastReferenceNum }: RecordJournalModalProps) {
  const [referenceNum, setReferenceNum] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [explanation, setExplanation] = useState('');
  const [lines, setLines] = useState<TempLine[]>([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate reference number based on timestamp or incremental prefix
  useEffect(() => {
    if (lastReferenceNum) {
      const match = lastReferenceNum.match(/^GJ(-)?(\d+)/i);
      if (match) {
        const nextNum = parseInt(match[2]) + 1;
        const padding = match[2].length;
        setReferenceNum(`GJ${nextNum.toString().padStart(padding, '0')}`);
        return;
      }
    }
    // Default fallback
    const rand = Math.floor(1000 + Math.random() * 9000);
    setReferenceNum(`GJ${rand}`);
  }, [lastReferenceNum]);

  // Only filter out postable (Detail) accounts
  const postableAccounts = accounts.filter(a => a.classification === 'Detail');

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', debit: '', credit: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      setError('Jurnal harus memiliki setidaknya 2 baris pencatatan');
      return;
    }
    const newLines = [...lines];
    newLines.splice(index, 1);
    setLines(newLines);
  };

  const handleLineChange = (index: number, field: keyof TempLine, value: string) => {
    const newLines = [...lines];
    newLines[index][field] = value;

    // MYOB rule: If a user enters a Debit, clear the Credit on that row, and vice-versa
    if (field === 'debit' && Number(value) > 0) {
      newLines[index].credit = '';
    } else if (field === 'credit' && Number(value) > 0) {
      newLines[index].debit = '';
    }

    setLines(newLines);
  };

  // Live Math Computations
  const totalDebits = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const outOfBalance = Math.abs(totalDebits - totalCredits);

  const handleRecordJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validation Checks
    if (!referenceNum.trim()) {
      setError('Nomor referensi / bukti jurnal harus diisi');
      return;
    }
    if (!date) {
      setError('Tanggal transaksi harus diisi');
      return;
    }
    if (!explanation.trim()) {
      setError('Memo / Penjelasan jurnal wajib dimasukkan');
      return;
    }

    // Filter valid lines
    const validLines: JournalLine[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.accountId) {
        // Skip completely empty lines
        if (!line.debit && !line.credit) continue;
        setError(`Baris #${i + 1} tidak memiliki pilihan akun yang valid.`);
        return;
      }

      const debitAmt = Number(line.debit) || 0;
      const creditAmt = Number(line.credit) || 0;

      if (debitAmt === 0 && creditAmt === 0) {
        setError(`Baris #${i + 1} memiliki nominal nol. Harap isi salah satu kolom debit atau kredit.`);
        return;
      }

      const accInfo = postableAccounts.find(a => a.id === line.accountId);
      if (!accInfo) {
        setError(`Akun pada baris #${i + 1} tidak ditemukan.`);
        return;
      }

      validLines.push({
        accountId: line.accountId,
        accountName: accInfo.name,
        debit: debitAmt,
        credit: creditAmt,
      });
    }

    if (validLines.length < 2) {
      setError('Pencatatan akuntansi membutuhkan minimal 2 baris akun terpost.');
      return;
    }

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      setError(`Transaksi TIDAK SEIMBANG (Out of Balance: Rp ${outOfBalance}). Total Debit dan Kredit harus bernilai sama.`);
      return;
    }

    setLoading(true);
    const journalId = 'jr_' + Math.random().toString(36).substring(2, 15);
    const path = `users/${userId}/companies/${companyId}/journals/${journalId}`;

    try {
      const journalData: MyobJournal = {
        id: journalId,
        referenceNum: referenceNum.trim(),
        date,
        explanation: explanation.trim(),
        source: 'General Journal',
        lines: validLines,
        totalAmount: totalDebits,
        createdAt: new Date().toISOString(),
      };

      // Perform write to Firestore
      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'journals', journalId), journalData);
      
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Error recording journal:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (logErr) {
        setError('Gagal membukukan transaksi. Harap periksa koneksi atau Firestore Security Rules.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Format IDR Currency
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div id="record_journal_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800">
        
        {/* Title bar emulating classic MYOB */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500 select-none">
          <span className="flex items-center gap-2">
            🗒️ Record Journal Entry (Pencatatan Jurnal Umum)
          </span>
          <button id="close_journal_entry_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs">✕</button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleRecordJournal} className="flex-1 flex flex-col min-h-0">
          <div className="p-4 space-y-4">
            {error && (
              <div id="journal_error_msg" className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs select-none">
                {error}
              </div>
            )}

            {/* Header info selectors: Ref, Date, Memo */}
            <div className="bg-[#eaeae6] border border-stone-300 rounded p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Nomor Bukti Jurnal (General Journal #)</label>
                <input 
                  id="journal_ref_input"
                  type="text" 
                  value={referenceNum} 
                  onChange={(e) => setReferenceNum(e.target.value)} 
                  placeholder="e.g. GJ00001"
                  className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-stone-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Tanggal Buku (Date)</label>
                <div className="relative">
                  <input 
                    id="journal_date_input"
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-stone-800"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 md:col-span-1">
                <label className="block font-bold text-stone-600 uppercase">Memo / Keterangan Transaksi</label>
                <input 
                  id="journal_memo_input"
                  type="text" 
                  value={explanation} 
                  onChange={(e) => setExplanation(e.target.value)} 
                  placeholder="Contoh: Setoran modal awal atau bayar sewa ruko"
                  className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans text-stone-800"
                  required
                />
              </div>
            </div>

            {/* General Ledger Spreadsheet Grid */}
            <div className="bg-white border border-stone-300 rounded overflow-hidden">
              <div className="grid grid-cols-12 bg-[#eaeae6] border-b border-stone-300 text-[10px] font-bold uppercase tracking-wider text-stone-600 font-mono py-2 px-3 text-center">
                <span className="col-span-1">Baris</span>
                <span className="col-span-5 text-left pl-2">Pilih Rekening Akun (Account Code)</span>
                <span className="col-span-2.5 text-right pr-4">Debet (Rp)</span>
                <span className="col-span-2.5 text-right pr-4">Kredit (Rp)</span>
                <span className="col-span-1">Aksi</span>
              </div>

              <div className="max-h-[300px] overflow-y-auto divide-y divide-stone-150">
                {lines.map((line, idx) => (
                  <div key={idx} id={`journal_line_row_${idx}`} className="grid grid-cols-12 text-xs py-2 px-3 items-center">
                    <span className="col-span-1 text-center font-mono text-stone-400 font-bold">
                      {idx + 1}
                    </span>

                    {/* Account picker */}
                    <div className="col-span-5 px-1">
                      <select
                        id={`journal_account_select_${idx}`}
                        value={line.accountId}
                        onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-1.5 py-1 text-stone-800 focus:outline-none"
                      >
                        <option value="">-- Silakan Pilih Rekening --</option>
                        {postableAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.id} &nbsp; {acc.name} ({acc.balanceType})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Debit text input */}
                    <div className="col-span-2.5 px-1 relative">
                      <input 
                        id={`journal_debit_input_${idx}`}
                        type="number"
                        value={line.debit}
                        placeholder="0"
                        onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                        className="w-full bg-white border border-stone-300 text-right rounded px-1.5 py-1 font-mono text-stone-800"
                        min={0}
                      />
                    </div>

                    {/* Credit text input */}
                    <div className="col-span-2.5 px-1 relative">
                      <input 
                        id={`journal_credit_input_${idx}`}
                        type="number"
                        value={line.credit}
                        placeholder="0"
                        onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                        className="w-full bg-white border border-stone-300 text-right rounded px-1.5 py-1 font-mono text-stone-800"
                        min={0}
                      />
                    </div>

                    {/* Line controls */}
                    <div className="col-span-1 text-center font-bold">
                      <button 
                        id={`journal_delete_row_btn_${idx}`}
                        type="button" 
                        onClick={() => handleRemoveLine(idx)}
                        className="text-stone-400 hover:text-red-700 p-1 rounded hover:bg-stone-100"
                        title="Delete this row"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add row controller */}
              <div className="bg-[#fcfcfa] border-t border-stone-200 p-2 flex justify-start items-center">
                <button
                  id="journal_add_row_btn"
                  type="button"
                  onClick={handleAddLine}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold px-3 py-1 border border-stone-300 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#1e4682]" /> Tambah Baris (Row)
                </button>
              </div>
            </div>

            {/* Balancing Sheet footer section */}
            <div className="bg-[#e0e0da] border border-stone-300 rounded p-4 flex justify-between items-center text-xs font-mono select-none">
              <div className="space-y-1">
                <div className="flex gap-4">
                  <span>Total Debit: <strong className="text-stone-950">{formatIDR(totalDebits)}</strong></span>
                  <span>Total Kredit: <strong className="text-stone-950">{formatIDR(totalCredits)}</strong></span>
                </div>
                <div id="journal_equalizer_notice" className="text-[10px] text-stone-500 font-sans">
                  Sandi Ganda (Double Entry): Jumlah total debet harus sama persis dengan total kredit.
                </div>
              </div>

              {/* Out of Balance visual marker */}
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider">Out of Balance</span>
                {outOfBalance === 0 ? (
                  <span id="journal_balanced_badge" className="inline-block bg-green-100 border border-green-400 text-green-800 text-xs font-bold font-mono px-3 py-1 rounded mt-1 shadow-sm">
                    ✓ BALANCED (Rp 0)
                  </span>
                ) : (
                  <span id="journal_unbalanced_badge" className="inline-block bg-red-100 border border-red-400 text-red-800 text-xs font-bold font-mono px-3 py-1 rounded mt-1 shadow-sm animate-pulse">
                    ⚠ Rp {outOfBalance.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dialog Action controllers */}
          <div className="bg-[#eaeae6] border-t border-stone-300 p-4 flex justify-end gap-2 text-xs mt-auto">
            <button 
              id="journal_entry_cancel_btn"
              type="button" 
              onClick={onClose}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold px-4 py-2 border border-stone-400 rounded cursor-pointer"
            >
              Batal
            </button>
            <button 
              id="journal_entry_record_btn"
              type="submit"
              disabled={loading || outOfBalance > 0.01}
              className="bg-[#1e4682] disabled:bg-[#1a3d72]/40 disabled:cursor-not-allowed hover:bg-[#153460] text-white font-bold px-6 py-2 border border-[#143460] rounded cursor-pointer flex items-center gap-1 active:translate-y-0.5 shadow-md"
            >
              {loading ? 'Merekam Jurnal...' : 'Record (Post Jurnal)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
