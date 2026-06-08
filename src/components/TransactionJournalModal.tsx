/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MyobJournal, JournalSource } from '../types';
import { Search, Calendar, RefreshCw, Layers } from 'lucide-react';

interface TransactionJournalModalProps {
  journals: MyobJournal[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function TransactionJournalModal({ journals, onClose, onRefresh }: TransactionJournalModalProps) {
  const [activeTab, setActiveTab] = useState<JournalSource | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);

  const TABS: { value: JournalSource | 'All'; label: string }[] = [
    { value: 'All', label: 'Semua Transaksi' },
    { value: 'General Journal', label: 'Jurnal Umum (GJ)' },
    { value: 'Spend Money', label: 'Keluar Uang (CD)' },
    { value: 'Receive Money', label: 'Terima Uang (CR)' },
  ];

  // Filter journals based on tabs, search keywords and date limits
  const filteredJournals = journals
    .filter(j => {
      // 1. Tab source filter
      if (activeTab !== 'All' && j.source !== activeTab) {
        return false;
      }
      // 2. Search query filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const refMatch = j.referenceNum.toLowerCase().includes(query);
        const explanationMatch = j.explanation.toLowerCase().includes(query);
        const lineAccountMatch = j.lines.some(l => l.accountId.includes(query) || l.accountName.toLowerCase().includes(query));
        if (!refMatch && !explanationMatch && !lineAccountMatch) {
          return false;
        }
      }
      // 3. Date limits
      if (startDate && j.date < startDate) return false;
      if (endDate && j.date > endDate) return false;

      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date)); // Newest first

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const toggleRowExpand = (id: string) => {
    setExpandedJournalId(prev => prev === id ? null : id);
  };

  return (
    <div id="transaction_journal_modal" className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4 backdrop-blur-sm select-none">
      <div className="bg-[#e5e5e0] w-full max-w-5xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800 font-sans">
        
        {/* Header Title bar */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center border-b border-stone-500 font-bold text-sm">
          <span className="flex items-center gap-2">
            🗒️ Jurnal Transaksi (Transaction Journal Auditor)
          </span>
          <button id="close_transactions_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs text-white">✕</button>
        </div>

        {/* Filter controls panel */}
        <div className="bg-[#eaeae6] border-b border-stone-300 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Search inputs */}
            <div className="flex items-center gap-2 bg-white border border-stone-300 rounded px-2.5 py-1.5 w-64">
              <Search className="w-3.5 h-3.5 text-stone-400" />
              <input 
                id="transactions_search_input"
                type="text"
                placeholder="Cari Ref, Memo, No Akun..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-stone-800 font-medium"
              />
            </div>

            {/* Date picking range */}
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-semibold uppercase">Periode Tanggal:</span>
              <div className="flex items-center gap-1.5 bg-white border border-stone-300 rounded px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <input 
                  id="transactions_start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent outline-none font-mono text-stone-800"
                />
              </div>
              <span className="text-stone-400">-</span>
              <div className="flex items-center gap-1.5 bg-white border border-stone-300 rounded px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <input 
                  id="transactions_end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent outline-none font-mono text-stone-800"
                />
              </div>
              {/* Reset date triggers */}
              {(startDate || endDate) && (
                <button
                  id="transactions_clear_dates_btn"
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-stone-500 hover:text-[#1e4682] underline font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              id="transactions_sync_btn"
              type="button"
              onClick={onRefresh}
              className="bg-stone-200 border border-stone-400 font-bold px-3 py-1.5 rounded hover:bg-stone-350 cursor-pointer flex items-center gap-1 shadow-sm active:translate-y-0.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#1e4682]" /> Segarkan Data
            </button>
          </div>
        </div>

        {/* Tab row resembling classical MYOB file folders */}
        <div className="flex bg-[#fbfbfa] border-b border-stone-300 select-none pt-2 px-2 gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button 
              key={tab.value}
              id={`tab_transactions_${tab.value}`}
              onClick={() => { setActiveTab(tab.value); setExpandedJournalId(null); }}
              className={`px-4 py-1.5 rounded-t-lg border-t border-x text-xs font-semibold whitespace-nowrap cursor-pointer transition ${activeTab === tab.value ? 'bg-[#e5e5e0] border-stone-400 text-[#1e4682] translate-y-[1px] font-bold shadow-xs' : 'bg-[#e1e1db]/60 border-transparent text-stone-600 hover:bg-stone-150'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Journals table container */}
        <div className="p-4 flex-1 overflow-y-auto min-h-[300px]">
          <div className="bg-white border-2 border-stone-300 rounded shadow-inner overflow-hidden">
            {/* Headers */}
            <div className="grid grid-cols-12 bg-[#eaeae6] border-b border-stone-300 text-[10px] uppercase font-bold tracking-wider font-mono py-2 px-3 text-stone-600 text-center select-none">
              <span className="col-span-1">Status</span>
              <span className="col-span-2 text-left pl-2">Tanggal (Date)</span>
              <span className="col-span-2 text-left">Referensi</span>
              <span className="col-span-4 text-left">Memorandum Jurnal</span>
              <span className="col-span-2.5 text-right pr-4">Total Nominal</span>
              <span className="col-span-0.5"></span>
            </div>

            {/* List */}
            <div className="divide-y divide-stone-150 text-xs">
              {filteredJournals.length === 0 ? (
                <div className="text-center py-16 text-stone-400 font-medium font-serif">
                  Tidak ditemukan catatan transaksi untuk filter aktif.
                </div>
              ) : (
                filteredJournals.map((jr) => {
                  const isExpanded = expandedJournalId === jr.id;

                  return (
                    <div key={jr.id} id={`transaction_row_${jr.id}`} className="transition duration-100 hover:bg-amber-50/5">
                      {/* Row view summary */}
                      <div 
                        onClick={() => toggleRowExpand(jr.id)}
                        className={`grid grid-cols-12 py-3 px-3 items-center cursor-pointer hover:bg-stone-50/60 select-none ${isExpanded ? 'bg-[#f4f4f1] font-semibold border-b border-stone-200' : ''}`}
                      >
                        {/* Source Tag mini badge */}
                        <span className="col-span-1 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase ${jr.source === 'General Journal' ? 'bg-sky-700' : jr.source === 'Spend Money' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                            {jr.source === 'General Journal' ? 'GJ' : jr.source === 'Spend Money' ? 'CD' : 'CR'}
                          </span>
                        </span>

                        {/* Date */}
                        <span className="col-span-2 text-left pl-2 font-mono text-stone-700">
                          {jr.date}
                        </span>

                        {/* Ref */}
                        <span className="col-span-2 text-left font-mono font-bold text-[#1e4682]">
                          {jr.referenceNum}
                        </span>

                        {/* Explanation Memo */}
                        <span className="col-span-4 text-left text-stone-900 truncate pr-3">
                          {jr.explanation}
                        </span>

                        {/* Aggregate amount */}
                        <span className="col-span-2.5 text-right font-mono font-bold text-stone-950 pr-4">
                          {formatIDR(jr.totalAmount)}
                        </span>

                        {/* Chevron indicators */}
                        <span className="col-span-0.5 text-stone-400 text-center font-bold">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>

                      {/* Expanded accounting ledger distribution entry detail */}
                      {isExpanded && (
                        <div id={`transaction_detail_${jr.id}`} className="bg-[#fbfcfa] px-12 py-3 border-b border-stone-200 text-xs font-mono space-y-1">
                          {/* Inner double entry grid header */}
                          <div className="grid grid-cols-12 font-bold text-stone-400 border-b border-stone-150 pb-1 text-[9px] uppercase tracking-wider mb-2 select-none">
                            <span className="col-span-4">Kode Perkiraan Akun</span>
                            <span className="col-span-4 text-left">Nama Akun</span>
                            <span className="col-span-2 text-right">Debet (Dr)</span>
                            <span className="col-span-2 text-right">Kredit (Cr)</span>
                          </div>

                          {/* Line entries iterator */}
                          {jr.lines.map((line, lidx) => (
                            <div key={lidx} className="grid grid-cols-12 py-1.5 border-b border-dashed border-stone-100 last:border-b-0">
                              <span className="col-span-4 font-bold text-stone-600">{line.accountId}</span>
                              <span className="col-span-4 text-stone-700 truncate pl-1">{line.accountName}</span>
                              
                              {/* Debit columns */}
                              <span className={`col-span-2 text-right ${line.debit > 0 ? 'text-stone-950 font-bold' : 'text-stone-300'}`}>
                                {line.debit > 0 ? formatIDR(line.debit) : '-'}
                              </span>
                              
                              {/* Credit columns */}
                              <span className={`col-span-2 text-right ${line.credit > 0 ? 'text-green-700 font-bold' : 'text-stone-300'}`}>
                                {line.credit > 0 ? formatIDR(line.credit) : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Audit notes */}
        <div className="bg-[#eaeae6] border-t border-stone-300 p-3.5 flex justify-between items-center text-xs">
          <div className="text-stone-500 font-semibold font-mono">
            Total Ledger: <strong>{filteredJournals.length} Jurnal Tercatat</strong>
          </div>
          <button 
            id="close_transactions_footer_btn"
            onClick={onClose}
            className="bg-stone-300 hover:bg-stone-400 border border-stone-400 text-stone-700 font-bold px-4 py-1.5 rounded cursor-pointer shadow-sm active:translate-y-0.5"
          >
            Tutup Jurnal
          </button>
        </div>

      </div>
    </div>
  );
}
