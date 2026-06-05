/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, CreditCard, DollarSign, Users, Award, FileText, CheckCircle, HelpCircle, Layers } from 'lucide-react';

export type SelectedModule = 'Accounts' | 'Banking' | 'CardFile' | 'SalesPurchases';

interface CommandCentreProps {
  onOpenAccountsList: () => void;
  onOpenRecordJournal: () => void;
  onOpenSpendMoney: () => void;
  onOpenReceiveMoney: () => void;
  onOpenTransactionJournal: () => void;
  onOpenCardList: () => void;
  onOpenReports: () => void;
  onOpenBankReconciliation?: () => void;
}

export default function CommandCentre({
  onOpenAccountsList,
  onOpenRecordJournal,
  onOpenSpendMoney,
  onOpenReceiveMoney,
  onOpenTransactionJournal,
  onOpenCardList,
  onOpenReports,
  onOpenBankReconciliation
}: CommandCentreProps) {
  const [activeModule, setActiveModule] = useState<SelectedModule>('Accounts');

  const MODULES = [
    { value: 'Accounts', label: 'Accounts', icon: BookOpen, color: 'border-t-sky-600' },
    { value: 'Banking', label: 'Banking', icon: CreditCard, color: 'border-t-emerald-600' },
    { value: 'CardFile', label: 'Card File', icon: Users, color: 'border-t-purple-600' },
    { value: 'SalesPurchases', label: 'Sales & Purchases', icon: Layers, color: 'border-t-amber-600' },
  ];

  return (
    <div id="myob_command_centre" className="w-full max-w-4xl mx-auto bg-[#eaeae6] border-2 border-stone-400 rounded shadow-xl overflow-hidden font-sans text-stone-800 select-none">
      
      {/* Module folder tabs similar to premier MYOB premier */}
      <div className="flex bg-[#d8d8d3] border-b border-stone-400 p-2 gap-1 overflow-x-auto justify-center select-none">
        {MODULES.map(m => {
          const Icon = m.icon;
          const isActive = activeModule === m.value;
          return (
            <button
              key={m.value}
              id={`nav_module_${m.value}`}
              onClick={() => setActiveModule(m.value as SelectedModule)}
              className={`flex flex-col items-center gap-1.5 px-6 py-2.5 rounded border border-transparent text-xs font-bold leading-none cursor-pointer transition min-w-[124px] ${isActive ? 'bg-[#eaeae6] border-stone-400 text-[#1e4682] shadow-sm scale-102 border-t-4' : 'text-stone-600 hover:bg-[#cfcfca] hover:text-stone-800'}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#1e4682]' : 'text-stone-500'}`} />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main flowchart visual board area */}
      <div className="p-8 min-h-[420px] bg-gradient-to-b from-[#f2f2ef] to-[#eaeae6] relative flex items-center justify-center overflow-hidden border-b border-stone-300">
        
        {/* SVG flowchart arrows connecting background container */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg className="w-full h-full opacity-60">
            {activeModule === 'Accounts' && (
              <>
                {/* Accounts flowchart connection vectors */}
                <line x1="25%" y1="50%" x2="45%" y2="50%" stroke="#1e4682" strokeWidth="2" strokeDasharray="3,3" />
                <line x1="45%" y1="50%" x2="50%" y2="50%" stroke="#1e4682" strokeWidth="2" />
                <line x1="50%" y1="50%" x2="50%" y2="25%" stroke="#1e4682" strokeWidth="2" />
                <line x1="50%" y1="50%" x2="50%" y2="75%" stroke="#1e4682" strokeWidth="2" />
                <line x1="50%" y1="25%" x2="70%" y2="25%" stroke="#1e4682" strokeWidth="2" />
                <line x1="50%" y1="75%" x2="70%" y2="75%" stroke="#1e4682" strokeWidth="2" />
              </>
            )}
            {activeModule === 'Banking' && (
              <>
                {/* Banking flowchart connection vectors */}
                <line x1="30%" y1="35%" x2="50%" y2="50%" stroke="#065f46" strokeWidth="2" />
                <line x1="30%" y1="65%" x2="50%" y2="50%" stroke="#065f46" strokeWidth="2" />
                <line x1="50%" y1="50%" x2="70%" y2="50%" stroke="#065f46" strokeWidth="2" strokeDasharray="3,3" />
              </>
            )}
            {activeModule === 'CardFile' && (
              <>
                {/* Card File connection vectors */}
                <line x1="35%" y1="50%" x2="65%" y2="50%" stroke="#6b21a8" strokeWidth="2" />
              </>
            )}
          </svg>
        </div>

        {/* FLOWCHART MODULE 1: ACCOUNTS */}
        {activeModule === 'Accounts' && (
          <div id="flowchart_accounts" className="grid grid-cols-3 gap-y-16 gap-x-12 max-w-3xl w-full z-10 relative">
            
            {/* Accounts List (Daftar Akun) */}
            <div className="flex flex-col items-center col-span-1 justify-center">
              <button
                id="flow_accounts_list_btn"
                onClick={onOpenAccountsList}
                className="w-20 h-20 bg-sky-900 border-2 border-sky-600 rounded-full flex items-center justify-center text-white hover:bg-sky-850 hover:border-sky-400 cursor-pointer shadow-lg active:scale-95 transition"
              >
                <BookOpen className="w-8 h-8 text-sky-200" />
              </button>
              <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[120px]">
                Chart of Accounts<br />(Daftar Akun)
              </span>
            </div>

            {/* Record Journal Entry */}
            <div className="flex flex-col items-center col-span-1 justify-center">
              <button
                id="flow_record_journal_btn"
                onClick={onOpenRecordJournal}
                className="w-20 h-20 bg-sky-900 border-2 border-sky-600 rounded-full flex items-center justify-center text-white hover:bg-sky-850 hover:border-sky-400 cursor-pointer shadow-lg active:scale-95 transition"
              >
                <FileText className="w-8 h-8 text-sky-200" />
              </button>
              <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[124px]">
                Record Journal<br />(Pencatatan Jurnal)
              </span>
            </div>

            {/* Transaction Journal */}
            <div className="flex flex-col items-center col-span-1 justify-center">
              <button
                id="flow_transaction_journal_btn"
                onClick={onOpenTransactionJournal}
                className="w-20 h-20 bg-[#1e4682] border-2 border-sky-500 rounded-full flex items-center justify-center text-white hover:bg-sky-800 hover:border-sky-400 cursor-pointer shadow-lg active:scale-95 transition"
              >
                <CheckCircle className="w-8 h-8 text-sky-300" />
              </button>
              <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[124px]">
                Transaction Journal<br />(Jurnal Transaksi)
              </span>
            </div>

            {/* Empty center spacing */}
            <div></div>

            {/* Financial Reports */}
            <div className="flex flex-col items-center col-span-1 justify-center">
              <button
                id="flow_accounts_reports_btn"
                onClick={onOpenReports}
                className="w-22 h-22 bg-[#1e4682] border-2 border-yellow-500 rounded-lg flex items-center justify-center text-white hover:bg-sky-850 hover:border-yellow-400 cursor-pointer shadow-xl active:scale-95 transition"
              >
                <div className="flex flex-col items-center">
                  <Layers className="w-8 h-8 text-yellow-300" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-yellow-100 mt-1">Laporan</span>
                </div>
              </button>
              <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[120px]">
                Financial Reports<br />(Neraca & Laba Rugi)
              </span>
            </div>
            
            <div></div>
          </div>
        )}

        {/* FLOWCHART MODULE 2: BANKING */}
        {activeModule === 'Banking' && (
          <div id="flowchart_banking" className="flex items-center justify-between w-full max-w-2xl z-10 relative">
            
            {/* Left nodes */}
            <div className="space-y-12">
              {/* Spend Money */}
              <div className="flex flex-col items-center">
                <button
                  id="flow_spend_money_btn"
                  onClick={onOpenSpendMoney}
                  className="w-20 h-20 bg-emerald-850 border-2 border-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-800 hover:border-emerald-300 cursor-pointer shadow-lg active:scale-95 transition"
                >
                  <CreditCard className="w-8 h-8 text-emerald-200" />
                </button>
                <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[120px]">
                  Spend Money<br />(Keluar Uang Kas)
                </span>
              </div>

              {/* Receive Money */}
              <div className="flex flex-col items-center">
                <button
                  id="flow_receive_money_btn"
                  onClick={onOpenReceiveMoney}
                  className="w-20 h-20 bg-emerald-850 border-2 border-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-800 hover:border-emerald-300 cursor-pointer shadow-lg active:scale-95 transition"
                >
                  <DollarSign className="w-8 h-8 text-emerald-200" />
                </button>
                <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[120px]">
                  Receive Money<br />(Terima Uang Kas)
                </span>
              </div>
            </div>

            {/* Central Auditor Node */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <button
                  id="flow_banking_journal_btn"
                  onClick={onOpenTransactionJournal}
                  className="w-16 h-16 bg-emerald-900 border-2 border-emerald-400 rounded-full flex items-center justify-center text-white hover:bg-emerald-850 hover:border-emerald-300 cursor-pointer shadow-lg active:scale-95 transition"
                >
                  <CheckCircle className="w-6 h-6 text-emerald-300" />
                </button>
                <span className="text-[10px] font-bold text-stone-700 mt-1 text-center max-w-[124px] leading-tight">
                  Transaction Journal<br />(Mutasi Kas Bank)
                </span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  id="flow_bank_reconciliation_btn"
                  onClick={onOpenBankReconciliation}
                  className="w-16 h-16 bg-emerald-950 border-2 border-emerald-300 rounded-full flex items-center justify-center text-white hover:bg-emerald-900 hover:border-emerald-200 cursor-pointer shadow-lg active:scale-95 transition"
                >
                  <CheckCircle className="w-6 h-6 text-teal-300" />
                </button>
                <span className="text-[10px] font-bold text-stone-700 mt-1 text-center max-w-[124px] leading-tight">
                  Reconcile Accounts<br />(Rekonsiliasi Bank)
                </span>
              </div>
            </div>

            {/* Reports */}
            <div className="flex flex-col items-center">
              <button
                id="flow_banking_reports_btn"
                onClick={onOpenReports}
                className="w-20 h-20 bg-stone-100 border-2 border-emerald-600 rounded-lg flex items-center justify-center text-stone-700 hover:bg-stone-50 hover:border-emerald-500 cursor-pointer shadow-lg active:scale-95 transition"
              >
                <FileText className="w-8 h-8 text-emerald-700" />
              </button>
              <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[120px]">
                Banking Reports<br />(Laporan Kas Harian)
              </span>
            </div>

          </div>
        )}

        {/* FLOWCHART MODULE 3: CARD FILE */}
        {activeModule === 'CardFile' && (
          <div id="flowchart_cardfile" className="flex items-center justify-center gap-24 w-full max-w-lg z-10 relative">
            
            {/* Card directory */}
            <div className="flex flex-col items-center">
              <button
                id="flow_card_list_btn"
                onClick={onOpenCardList}
                className="w-22 h-22 bg-purple-900 border-2 border-purple-500 rounded-full flex items-center justify-center text-white hover:bg-purple-800 hover:border-purple-300 cursor-pointer shadow-lg active:scale-95 transition"
              >
                <Users className="w-9 h-9 text-purple-200" />
              </button>
              <span className="text-xs font-bold text-stone-700 mt-2 text-center max-w-[130px]">
                Cards List Directory<br />(Kelola Relasi Bisnis)
              </span>
            </div>

            {/* Sync summary indicator */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-purple-950 border-2 border-purple-600 rounded-lg flex items-center justify-center text-white select-none">
                <div className="text-center">
                  <span className="block text-[8px] uppercase tracking-wider text-purple-300 font-bold">Cloud Synced</span>
                  <span className="text-xs font-bold text-purple-100 mt-1">FIRESTORE</span>
                </div>
              </div>
              <span className="text-xs font-bold text-stone-600 mt-2 text-center max-w-[120px]">
                Securely Saved Offline-ready
              </span>
            </div>

          </div>
        )}

        {/* FLOWCHART MODULE 4: SALES & PURCHASES SHORTCUT BRIEFING */}
        {activeModule === 'SalesPurchases' && (
          <div id="flowchart_sales_purchases" className="w-full max-w-xl bg-amber-50/25 border-2 border-amber-300 rounded p-6 text-xs text-stone-700 space-y-4 shadow-inner z-10 select-none">
            <h3 className="font-bold text-sm text-amber-800 flex items-center gap-1.5 uppercase border-b border-amber-200 pb-1.5">
              💡 Pencatatan Penjualan & Pembelian (Siklus Dagang)
            </h3>
            <p className="leading-relaxed">
              Di dalam sistem MYOB gratis ini, Anda dapat mencatat Penjualan (Sales) dan Pembelian (Purchases) barang secara tunai maupun kredit dengan sangat praktis menggunakan fitur **Record Journal** di modul **Accounts**:
            </p>
            <div className="bg-white border rounded border-amber-100 p-3 space-y-2.5 shadow-xs font-mono text-[11px]">
              <div>
                <p className="font-bold text-stone-900">1. Transaksi Penjualan Jasa/Kredit:</p>
                <p className="text-sky-800 ml-4">• Debit &nbsp; Piutang Usaha (1-1300)</p>
                <p className="text-green-700 ml-4">• Kredit &nbsp; Pendapatan Jasa (4-1100)</p>
              </div>
              <div>
                <p className="font-bold text-stone-900">2. Transaksi Pembelian Inventaris/Alat (Utang):</p>
                <p className="text-sky-800 ml-4">• Debit &nbsp; Peralatan Kantor (1-2100) atau Pembelian (5-1200)</p>
                <p className="text-green-700 ml-4">• Kredit &nbsp; Utang Usaha / Dagang (2-1100)</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                id="sales_purchases_go_journal_btn"
                onClick={onOpenRecordJournal}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 border border-amber-700 rounded cursor-pointer transition shadow-xs active:translate-y-0.5"
              >
                Ke Record Journal Sekarang
              </button>
              <button 
                id="sales_purchases_go_accounts_btn"
                onClick={onOpenAccountsList}
                className="bg-stone-200 hover:bg-stone-300 border border-stone-300 text-stone-700 px-3 py-2 rounded"
              >
                Tinjau Chart of Accounts
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Retro-styled footer panel for command center */}
      <div className="bg-[#f0f0eb] p-3 text-xs text-stone-500 font-bold border-t border-stone-300 flex justify-between tracking-wide select-none">
        <span className="flex items-center gap-1">
          <Award className="w-4 h-4 text-[#1e4682]" />
          <span>MYOB Solusi Akuntansi Cloud Indonesia</span>
        </span>
        <span className="text-stone-400 font-mono">Ver 18.2 Extended Storage System</span>
      </div>

    </div>
  );
}
