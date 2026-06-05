/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobAccount, AccountType, AccountClassification } from '../types';
import { Plus, Edit2, Trash2, FolderPlus, HelpCircle } from 'lucide-react';

interface AccountsListModalProps {
  userId: string;
  companyId: string;
  accounts: MyobAccount[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function AccountsListModal({ userId, companyId, accounts, onClose, onRefresh }: AccountsListModalProps) {
  const [activeTab, setActiveTab] = useState<AccountType | 'All'>('All');
  const [editingAccount, setEditingAccount] = useState<MyobAccount | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AccountType>('Asset');
  const [formClassification, setFormClassification] = useState<AccountClassification>('Detail');
  const [formParentCode, setFormParentCode] = useState('');
  const [formOpeningBalance, setFormOpeningBalance] = useState(0);
  const [formBalanceType, setFormBalanceType] = useState<'Debit' | 'Credit'>('Debit');

  const ACCOUNT_TYPES: AccountType[] = [
    'Asset',
    'Liability',
    'Equity',
    'Revenue',
    'Cost Of Sales',
    'Expense',
    'Other Income',
    'Other Expense'
  ];

  // Helper map for MYOB standard prefix codes
  const getPrefixForType = (type: AccountType): string => {
    switch(type) {
      case 'Asset': return '1';
      case 'Liability': return '2';
      case 'Equity': return '3';
      case 'Revenue': return '4';
      case 'Cost Of Sales': return '5';
      case 'Expense': return '6';
      case 'Other Income': return '8';
      case 'Other Expense': return '9';
    }
  };

  const getLabelForType = (type: AccountType): string => {
    switch(type) {
      case 'Asset': return 'Aset / Aktiva';
      case 'Liability': return 'Kewajiban / Liabilitas';
      case 'Equity': return 'Ekuitas / Modal';
      case 'Revenue': return 'Pendapatan';
      case 'Cost Of Sales': return 'HPP (Cost of Sales)';
      case 'Expense': return 'Beban Operasional';
      case 'Other Income': return 'Pendapatan Lain';
      case 'Other Expense': return 'Beban Lain-Lain';
    }
  };

  // Switch type and assign proper normal balance direction
  const handleTypeChange = (type: AccountType) => {
    setFormType(type);
    
    // Normal balances in MYOB
    if (type === 'Liability' || type === 'Equity' || type === 'Revenue' || type === 'Other Income') {
      setFormBalanceType('Credit');
    } else {
      setFormBalanceType('Debit');
    }

    // Set sample code prefix if empty or starting with mismatch
    if (!formId || !formId.startsWith(getPrefixForType(type))) {
      setFormId(getPrefixForType(type) + '-' + (formId.split('-')[1] || '1000'));
    }
  };

  const handleOpenCreate = () => {
    setError(null);
    setEditingAccount(null);
    setFormId('1-1000');
    setFormName('');
    setFormType('Asset');
    setFormClassification('Detail');
    setFormParentCode('');
    setFormOpeningBalance(0);
    setFormBalanceType('Debit');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (acc: MyobAccount) => {
    setError(null);
    setEditingAccount(acc);
    setFormId(acc.id);
    setFormName(acc.name);
    setFormType(acc.type);
    setFormClassification(acc.classification);
    setFormParentCode(acc.parentCode || '');
    setFormOpeningBalance(acc.openingBalance);
    setFormBalanceType(acc.balanceType);
    setIsFormOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate code matches standard MYOB format: X-XXXX
    const codeFormat = /^[1-9]-[0-9]{4}$/;
    if (!codeFormat.test(formId)) {
      setError('Kode akun harus disimpan dalam format X-XXXX (Contoh: 1-1120)');
      return;
    }

    // Type matching validation
    const expectedPrefix = getPrefixForType(formType);
    if (!formId.startsWith(expectedPrefix)) {
      setError(`Kode akun kategori ${getLabelForType(formType)} harus diawali dengan angka "${expectedPrefix}-"`);
      return;
    }

    if (!formName.trim()) {
      setError('Nama Akun tidak boleh kosong');
      return;
    }

    setLoading(true);
    const path = `users/${userId}/companies/${companyId}/accounts/${formId}`;
    try {
      const updatedAccount: MyobAccount = {
        id: formId,
        name: formName.trim(),
        type: formType,
        classification: formClassification,
        parentCode: formParentCode ? formParentCode : undefined,
        openingBalance: Number(formOpeningBalance),
        balanceType: formBalanceType
      };

      // Perform write to Firestore
      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'accounts', formId), updatedAccount);
      
      setIsFormOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error('Error saving account:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (logErr) {
        setError('Gagal menyimpan perubahan rekening acuan. Periksa hak akses Firestore.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun ${accountId}? Tindakan ini bersifat permanen.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    const path = `users/${userId}/companies/${companyId}/accounts/${accountId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'companies', companyId, 'accounts', accountId));
      onRefresh();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (logErr) {
        setError('Gagal menghapus akun ledger. Akun mungkin terikat transaksi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter & sort accounts
  const filteredAccounts = accounts
    .filter(acc => activeTab === 'All' || acc.type === activeTab)
    // Sort logically by ID code sequence
    .sort((a, b) => a.id.localeCompare(b.id));

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
    <div id="accounts_list_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800">
        
        {/* Title bar emulating classic MYOB */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500 select-none">
          <span className="flex items-center gap-2">
            📂 Daftar Akun Ledger (Chart of Accounts / COA)
          </span>
          <button id="close_coa_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs">✕</button>
        </div>

        {/* Action Panel */}
        <div className="bg-[#f2f2ef] border-b border-stone-300 p-3 flex justify-between items-center flex-wrap gap-2 text-xs">
          <div className="text-stone-600 flex items-center gap-1.5 font-medium">
            <HelpCircle className="w-4 h-4 text-sky-700" />
            <span>Double click atau pilih akun lalu klik **Edit** untuk mengonfigurasi saldo pembukuan awal.</span>
          </div>
          <div className="flex gap-2">
            <button 
              id="new_account_btn"
              onClick={handleOpenCreate}
              className="bg-[#1e4682] text-white px-3 py-1.5 rounded hover:bg-[#153460] font-bold flex items-center gap-1 cursor-pointer shadow-sm active:translate-y-0.5"
            >
              <Plus className="w-3.5 h-3.5" /> Akun Baru
            </button>
          </div>
        </div>

        {/* Tab Row (classic MYOB file folders system) */}
        <div className="flex bg-[#fbfbfa] border-b border-stone-300 overflow-x-auto select-none pt-2 px-2 gap-1">
          <button 
            id="tab_coa_All"
            onClick={() => setActiveTab('All')}
            className={`px-3 py-1.5 rounded-t border-t border-x text-xs font-semibold cursor-pointer transition ${activeTab === 'All' ? 'bg-[#e5e5e0] border-stone-400 text-[#1e4682] translate-y-[1px] font-bold' : 'bg-[#e1e1db]/60 border-transparent text-stone-600 hover:bg-stone-150'}`}
          >
            Semua Akun
          </button>
          {ACCOUNT_TYPES.map(type => (
            <button 
              key={type}
              id={`tab_coa_${type}`}
              onClick={() => setActiveTab(type)}
              className={`px-3 py-1.5 rounded-t border-t border-x text-xs font-semibold whitespace-nowrap cursor-pointer transition ${activeTab === type ? 'bg-[#e5e5e0] border-stone-400 text-[#1e4682] translate-y-[1px] font-bold' : 'bg-[#e1e1db]/60 border-transparent text-stone-600 hover:bg-stone-150'}`}
            >
              {getLabelForType(type)}
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div id="coa_error_msg" className="mx-4 my-2 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs select-none">
            {error}
          </div>
        )}

        {/* Accounts Folder Container */}
        <div className="p-4 flex-1 overflow-y-auto bg-[#e5e5e0]">
          <div className="bg-white border-2 border-stone-300 rounded shadow-inner overflow-hidden min-h-[350px]">
            {/* Table header */}
            <div className="grid grid-cols-12 bg-[#eaeae6] border-b border-stone-300 text-stone-600 px-4 py-2 text-xs font-bold font-mono tracking-wider">
              <span className="col-span-3">Nomor Rekening</span>
              <span className="col-span-5">Nama Perkiraan</span>
              <span className="col-span-2 text-right">Tipe Saldo</span>
              <span className="col-span-2 text-right">Saldo Saat Ini</span>
            </div>

            {/* Account List Rows */}
            <div className="divide-y divide-stone-150 text-xs">
              {filteredAccounts.length === 0 ? (
                <div className="text-center py-12 text-stone-400 font-medium">
                  Belum ada rekening acuan untuk filter ini. Klik **Akun Baru** untuk menambahkan.
                </div>
              ) : (
                filteredAccounts.map((acc) => {
                  const isHeader = acc.classification === 'Header';
                  const prefixCode = acc.id.split('-')[0];

                  return (
                    <div 
                      key={acc.id}
                      id={`account_row_${acc.id}`}
                      onDoubleClick={() => handleOpenEdit(acc)}
                      className={`grid grid-cols-12 px-4 py-2.5 items-center transition hover:bg-stone-50 select-none cursor-pointer ${isHeader ? 'bg-amber-50/20 font-bold group' : ''}`}
                    >
                      {/* Code */}
                      <span className="col-span-3 font-mono text-[#1e4682] font-semibold">
                        {acc.id}
                      </span>

                      {/* Name - Indented if it has nested parent */}
                      <span className={`col-span-5 flex items-center gap-1.5 ${isHeader ? 'text-stone-900' : 'text-stone-700 pl-4 border-l border-stone-200'}`}>
                        {isHeader ? '📂' : '📄'}
                        {acc.name}
                      </span>

                      {/* Type Norm */}
                      <span className="col-span-2 text-right text-stone-500 font-mono">
                        {acc.classification === 'Header' ? (
                          <span className="text-[10px] bg-stone-200 px-1 py-0.5 rounded text-stone-600 font-bold">HEADER</span>
                        ) : (
                          `${acc.balanceType} (Awal)`
                        )}
                      </span>

                      {/* Currency balance */}
                      <span className={`col-span-2 text-right font-mono font-medium ${isHeader ? 'text-stone-500' : 'text-stone-900 font-semibold'}`}>
                        {formatIDR(acc.openingBalance)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer info buttons */}
        <div className="bg-[#eaeae6] border-t border-stone-300 p-3 flex justify-between items-center text-xs">
          <div className="text-stone-500 font-serif font-medium">
            Jumlah Rekening Tersinkronisasi: <strong>{filteredAccounts.length} Akun</strong>
          </div>
          <button 
            id="close_coa_footer_btn"
            onClick={onClose}
            className="bg-stone-300 hover:bg-stone-400 border border-stone-400 text-stone-700 px-4 py-1.5 rounded cursor-pointer font-semibold shadow-sm active:translate-y-0.5"
          >
            Tutup
          </button>
        </div>

        {/* HOVER EDIT ACCOUNT DIALOG FORM (MODAL IN MODAL) */}
        {isFormOpen && (
          <div id="account_form_dialog" className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
            <form 
              onSubmit={handleSaveAccount} 
              className="bg-[#eaeae6] w-full max-w-md border-2 border-stone-400 rounded shadow-2xl overflow-hidden font-sans text-stone-800"
            >
              {/* Titlebar */}
              <div className="bg-[#1e4682] text-white px-4 py-1.5 flex justify-between items-center text-xs font-bold">
                <span>{editingAccount ? '✏️ Ubah Rekening Akun' : '➕ Tambah Rekening Akun Baru'}</span>
                <button type="button" onClick={() => setIsFormOpen(false)} className="text-white hover:text-red-300 font-bold">✕</button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4 text-xs">
                {/* ID / Code */}
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Nomor Akun (Format: X-XXXX) *</label>
                  <input 
                    id="coa_form_id_input"
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="e.g. 1-1120"
                    disabled={!!editingAccount} // Immutable codes once created in standard MYOB
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-stone-100 disabled:text-stone-500 text-sm font-mono text-stone-800"
                    required
                  />
                  {!editingAccount && <span className="text-[10px] text-stone-400 block mt-0.5">Harus dimulai dengan indeks kategori keuangan Anda</span>}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Nama Akun / Perkiraan *</label>
                  <input 
                    id="coa_form_name_input"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Kas Utama Rupiah"
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm font-medium text-stone-800"
                    required
                  />
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Tipe / Kategori Akun</label>
                  <select
                    id="coa_form_type_select"
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value as AccountType)}
                    disabled={!!editingAccount}
                    className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-stone-100 text-stone-800"
                  >
                    {ACCOUNT_TYPES.map(type => (
                      <option key={type} value={type}>{getLabelForType(type)}</option>
                    ))}
                  </select>
                </div>

                {/* Classification (Header vs Detail) */}
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Klasifikasi Akun</label>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="classification" 
                        value="Detail" 
                        checked={formClassification === 'Detail'}
                        onChange={() => setFormClassification('Detail')}
                        disabled={!!editingAccount}
                      />
                      <span>Detail Account (Postable)</span>
                    </label>
                    <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="classification" 
                        value="Header" 
                        checked={formClassification === 'Header'}
                        onChange={() => setFormClassification('Header')}
                        disabled={!!editingAccount}
                      />
                      <span>Header Account (Summary)</span>
                    </label>
                  </div>
                </div>

                {/* Opening Balance */}
                {formClassification === 'Detail' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Saldo Awal (Opening Balance)</label>
                      <input 
                        id="coa_form_balance_input"
                        type="number"
                        value={formOpeningBalance}
                        onChange={(e) => setFormOpeningBalance(Number(e.target.value))}
                        className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Normal Balance</label>
                      <select
                        id="coa_form_balancetype_select"
                        value={formBalanceType}
                        onChange={(e) => setFormBalanceType(e.target.value as 'Debit' | 'Credit')}
                        className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800"
                      >
                        <option value="Debit">Debit (Pertambahan Aktiva/Dr)</option>
                        <option value="Credit">Credit (Pertambahan Pasiva/Cr)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions panel */}
              <div className="bg-[#dfdfda] border-t border-stone-300 px-4 py-3 flex justify-between">
                <div>
                  {editingAccount && (
                    <button 
                      id="coa_form_delete_btn"
                      type="button" 
                      onClick={() => {
                        setIsFormOpen(false);
                        handleDeleteAccount(editingAccount.id);
                      }}
                      className="bg-red-700 hover:bg-red-800 text-white font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow-sm active:translate-y-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Akun
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    id="coa_form_cancel_btn"
                    type="button" 
                    onClick={() => setIsFormOpen(false)}
                    className="bg-stone-200 hover:bg-stone-300 border border-stone-400 text-stone-700 font-semibold px-4 py-1.5 rounded shadow-sm"
                  >
                    Batal
                  </button>
                  <button 
                    id="coa_form_save_btn"
                    type="submit"
                    disabled={loading}
                    className="bg-[#1e4682] hover:bg-[#153460] text-white font-bold px-5 py-1.5 rounded shadow-md flex items-center gap-1 active:translate-y-0.5"
                  >
                    {loading ? 'Menyimpan...' : 'Simpan Akun'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
