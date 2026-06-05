/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobCard, CardType } from '../types';
import { Plus, Users, Mail, Phone, MapPin, Trash2 } from 'lucide-react';

interface CardListModalProps {
  userId: string;
  companyId: string;
  cards: MyobCard[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function CardListModal({ userId, companyId, cards, onClose, onRefresh }: CardListModalProps) {
  const [activeTab, setActiveTab] = useState<CardType | 'All'>('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<MyobCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [formIdCode, setFormIdCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CardType>('Customer');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');

  const TABS: { value: CardType | 'All'; label: string }[] = [
    { value: 'All', label: 'Semua Kontak (All Cards)' },
    { value: 'Customer', label: 'Pelanggan (Customer)' },
    { value: 'Supplier', label: 'Pemasok (Supplier)' },
    { value: 'Employee', label: 'Karyawan (Employee)' }
  ];

  const handleOpenCreate = () => {
    setError(null);
    setEditingCard(null);
    
    // Choose appropriate default prefix code
    const rand = Math.floor(100 + Math.random() * 900);
    setFormIdCode(`CST-${rand}`);
    setFormName('');
    setFormType('Customer');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setIsFormOpen(true);
  };

  const handleTypeChange = (type: CardType) => {
    setFormType(type);
    const rand = Math.floor(100 + Math.random() * 900);
    if (type === 'Customer') setFormIdCode(`CST-${rand}`);
    if (type === 'Supplier') setFormIdCode(`SPL-${rand}`);
    if (type === 'Employee') setFormIdCode(`EMP-${rand}`);
  };

  const handleOpenEdit = (card: MyobCard) => {
    setError(null);
    setEditingCard(card);
    setFormIdCode(card.cardIdCode);
    setFormName(card.name);
    setFormType(card.type);
    setFormEmail(card.email || '');
    setFormPhone(card.phone || '');
    setFormAddress(card.address || '');
    setIsFormOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formName.trim()) {
      setError('Nama kontak tidak boleh kosong');
      return;
    }
    if (!formIdCode.trim()) {
      setError('Kode ID Kartu wajib diisi');
      return;
    }

    setLoading(true);
    const cardId = editingCard ? editingCard.id : 'cd_' + Math.random().toString(36).substring(2, 11);
    const path = `users/${userId}/companies/${companyId}/cards/${cardId}`;

    try {
      const cardData: MyobCard = {
        id: cardId,
        type: formType,
        name: formName.trim(),
        cardIdCode: formIdCode.trim().toUpperCase(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined
      };

      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'cards', cardId), cardData);
      
      setIsFormOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error('Error saving contact card:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (logErr) {
        setError('Gagal menyimpan profil kontak ke Firestore database.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kontak ini dari database bisnis?')) {
      return;
    }

    setLoading(true);
    setError(null);
    const path = `users/${userId}/companies/${companyId}/cards/${cardId}`;

    try {
      await deleteDoc(doc(db, 'users', userId, 'companies', companyId, 'cards', cardId));
      onRefresh();
    } catch (err: any) {
      console.error('Error deleting contact card:', err);
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (logErr) {
        setError('Gagal menghapus dari Firestore.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredCards = cards.filter(c => activeTab === 'All' || c.type === activeTab)
    .sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div id="card_list_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-none">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800 font-sans">
        
        {/* Titlebar bar emulating MYOB classical layouts */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500">
          <span className="flex items-center gap-2">
            📂 Card File Directory (Kartu Relasi Bisnis)
          </span>
          <button id="close_card_file_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs">✕</button>
        </div>

        {/* Action center bar */}
        <div className="bg-[#f2f2ef] border-b border-stone-300 p-3 flex justify-between items-center flex-wrap gap-2 text-xs">
          <span className="text-stone-500 font-semibold font-serif">Membantu mengorganisasi Customer / Supplier untuk mempermudah Spend/Receive Money.</span>
          <button 
            id="new_card_btn"
            onClick={handleOpenCreate}
            className="bg-[#1e4682] hover:bg-[#153460] text-white px-3 py-1.5 rounded font-bold shadow-sm flex items-center gap-1 active:translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Kontak Kartu
          </button>
        </div>

        {/* Tab row */}
        <div className="flex bg-[#fbfbfa] border-b border-stone-300 select-none pt-2 px-2 gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button 
              key={tab.value}
              id={`tab_cards_${tab.value}`}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-1.5 rounded-t-lg border-t border-x text-xs font-semibold whitespace-nowrap cursor-pointer transition ${activeTab === tab.value ? 'bg-[#e5e5e0] border-stone-400 text-[#1e4682] translate-y-[1px] font-bold' : 'bg-[#e1e1db]/60 border-transparent text-stone-600 hover:bg-stone-150'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div id="cards_error_msg" className="mx-4 my-2 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs">
            {error}
          </div>
        )}

        {/* Contact List display area */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="bg-white border-2 border-stone-300 rounded shadow-inner min-h-[300px]">
            {/* Table layout header */}
            <div className="grid grid-cols-12 bg-[#eaeae6] border-b border-stone-300 text-[10px] uppercase font-mono tracking-wider font-bold text-stone-600 py-2 px-3">
              <span className="col-span-2">Card ID</span>
              <span className="col-span-3">Nama Lengkap Relasi</span>
              <span className="col-span-2">Klasifikasi</span>
              <span className="col-span-2">Telepon</span>
              <span className="col-span-3">Alamat Surel (Email)</span>
            </div>

            {/* List */}
            <div className="divide-y divide-stone-150 text-xs">
              {filteredCards.length === 0 ? (
                <div className="text-center py-16 text-stone-400 font-serif font-semibold">
                  Sektor kontak ini masih kosong. Klik **Tambah Kontak Kartu** untuk menyiapkannya.
                </div>
              ) : (
                filteredCards.map(c => (
                  <div 
                    key={c.id} 
                    id={`card_row_${c.id}`}
                    onDoubleClick={() => handleOpenEdit(c)}
                    className="grid grid-cols-12 py-2.5 px-3 items-center hover:bg-stone-50 cursor-pointer text-stone-800"
                  >
                    <span className="col-span-2 font-mono font-bold text-[#1e4682]">{c.cardIdCode}</span>
                    <span className="col-span-3 font-semibold text-stone-900 flex items-center gap-1.5">
                      👤 {c.name}
                    </span>
                    <span className="col-span-2 font-mono">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${c.type === 'Customer' ? 'bg-sky-100 text-sky-800 border border-sky-300' : c.type === 'Supplier' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-purple-100 text-purple-800 border border-purple-300'}`}>
                        {c.type === 'Customer' ? 'PELANGGAN' : c.type === 'Supplier' ? 'PEMASOK' : 'KARYAWAN'}
                      </span>
                    </span>
                    <span className="col-span-2 font-mono text-stone-600">{c.phone || '-'}</span>
                    <span className="col-span-3 text-stone-600 truncate">{c.email || '-'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-[#eaeae6] border-t border-stone-300 p-3 flex justify-between items-center text-xs">
          <div className="text-stone-500 font-mono">
            Total Entitas Kartu: <strong>{filteredCards.length} Kontak Terdaftar</strong>
          </div>
          <button 
            id="close_card_file_footer_btn"
            onClick={onClose}
            className="bg-stone-300 hover:bg-stone-400 border border-stone-400 text-stone-700 font-bold px-4 py-1.5 rounded cursor-pointer shadow-sm active:translate-y-0.5"
          >
            Tutup
          </button>
        </div>

        {/* FORM DRAWER DIALOG BOX FOR ADD/EDIT (MODAL IN MODAL) */}
        {isFormOpen && (
          <div id="card_form_dialog" className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
            <form 
              onSubmit={handleSaveCard} 
              className="bg-[#eaeae6] w-full max-w-md border-2 border-stone-400 rounded shadow-2xl overflow-hidden font-sans text-stone-800"
            >
              <div className="bg-[#1e4682] text-white px-4 py-1.5 flex justify-between items-center border-b border-stone-500 font-bold text-xs select-none">
                <span>{editingCard ? '✏️ Ubah Profil Kartu Relasi' : '➕ Tambah Kartu Relasi Baru'}</span>
                <button type="button" onClick={() => setIsFormOpen(false)} className="text-white hover:text-red-300 font-bold">✕</button>
              </div>

              <div className="p-4 space-y-4 text-xs font-sans">
                {/* Type Choose */}
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Tipe Entitas Hubungan *</label>
                  <select
                    id="card_form_type_select"
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value as CardType)}
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-stone-800 font-medium"
                  >
                    <option value="Customer">Customer (Pelanggan / Pembayar)</option>
                    <option value="Supplier">Supplier (Pemasok / Penjual Vendor)</option>
                    <option value="Employee">Employee (Anggota Karyawan Staff)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Card Code ID */}
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Card ID *</label>
                    <input 
                      id="card_form_idcode_input"
                      type="text" 
                      value={formIdCode}
                      onChange={(e) => setFormIdCode(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-stone-800 text-sm"
                      placeholder="e.g. CST-0001"
                      required
                    />
                  </div>

                  {/* Name */}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Nama Relasi Lengkap *</label>
                    <input 
                      id="card_form_name_input"
                      type="text" 
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none text-stone-800 text-sm"
                      placeholder="e.g. Toko Buku Gramedia"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Email */}
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Email</label>
                    <input 
                      id="card_form_email_input"
                      type="email" 
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-stone-800"
                      placeholder="vendor@mail.com"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Nomor Telepon</label>
                    <input 
                      id="card_form_phone_input"
                      type="tel" 
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-stone-800 font-mono"
                      placeholder="0812-3456-7890"
                    />
                  </div>
                </div>

                {/* Mailing Address */}
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Alamat Domisili Lengkap</label>
                  <textarea 
                    id="card_form_address_input"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-stone-800"
                    placeholder="Alamat penagihan atau pengiriman"
                    rows={2}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="bg-[#dfdfda] border-t border-stone-300 px-4 py-3 flex justify-between">
                <div>
                  {editingCard && (
                    <button 
                      id="card_form_delete_btn"
                      type="button" 
                      onClick={() => {
                        setIsFormOpen(false);
                        handleDeleteCard(editingCard.id);
                      }}
                      className="bg-red-700 hover:bg-red-800 text-white font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow-sm active:translate-y-0.5 pointer-events-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    id="card_form_cancel_btn"
                    type="button" 
                    onClick={() => setIsFormOpen(false)}
                    className="bg-stone-200 hover:bg-stone-300 border border-stone-400 text-stone-700 font-semibold px-4 py-1.5 rounded cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    id="card_form_save_btn"
                    type="submit"
                    disabled={loading}
                    className="bg-[#1e4682] hover:bg-[#153460] text-white font-bold px-5 py-1.5 rounded shadow-md cursor-pointer active:translate-y-0.5 flex items-center gap-1"
                  >
                    {loading ? 'Menyimpan...' : 'Simpan Kontak'}
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
