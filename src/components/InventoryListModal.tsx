/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobAccount, InventoryItem, MyobJournal, JournalLine } from '../types';
import { Package, Plus, Trash2, Edit2, Hammer, Settings, RefreshCw, Calendar, Save } from 'lucide-react';

interface InventoryListModalProps {
  userId: string;
  companyId: string;
  accounts: MyobAccount[];
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onRefresh?: () => void;
  defaultTab?: 'List' | 'Adjust';
}

export default function InventoryListModal({
  userId,
  companyId,
  accounts,
  inventoryItems,
  onClose,
  onRefresh,
  defaultTab
}: InventoryListModalProps) {
  const [activeTab, setActiveTab] = useState<'List' | 'Adjust'>(defaultTab || 'List');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states for creating/editing item
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [assetAcc, setAssetAcc] = useState('');
  const [salesAcc, setSalesAcc] = useState('');
  const [cogsAcc, setCogsAcc] = useState('');
  const [initialQty, setInitialQty] = useState('0');

  // Adjust Inventory form states
  const [adjustDate, setAdjustDate] = useState(new Date().toISOString().substring(0, 10));
  const [adjustExplanation, setAdjustExplanation] = useState('Penyesuaian Fisik Persediaan');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [adjustType, setAdjustType] = useState<'Increase' | 'Decrease'>('Increase');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustUnitCost, setAdjustUnitCost] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter accounts for dropdown listings
  const assetAccounts = accounts.filter(a => a.type === 'Asset' && a.classification === 'Detail');
  const revenueAccounts = accounts.filter(a => a.type === 'Revenue' && a.classification === 'Detail');
  const cogsAccounts = accounts.filter(a => a.type === 'Cost Of Sales' && a.classification === 'Detail');
  const offsetAccountsSelection = accounts.filter(a => a.classification === 'Detail');

  const handleOpenNewForm = () => {
    setEditingItem(null);
    setItemCode('');
    setItemName('');
    setBuyPrice('');
    setSellPrice('');
    // Auto-select defaults if possible
    setAssetAcc(assetAccounts[0]?.id || '');
    setSalesAcc(revenueAccounts[0]?.id || '');
    setCogsAcc(cogsAccounts[0]?.id || '');
    setInitialQty('0');
    setError(null);
    setSuccess(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: InventoryItem) => {
    setEditingItem(item);
    setItemCode(item.id);
    setItemName(item.name);
    setBuyPrice(item.buyPrice.toString());
    setSellPrice(item.sellPrice.toString());
    setAssetAcc(item.assetAccountId || '');
    setSalesAcc(item.salesAccountId || '');
    setCogsAcc(item.cogsAccountId || '');
    setInitialQty(item.qtyOnHand.toString());
    setError(null);
    setSuccess(null);
    setIsFormOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!itemCode.trim()) {
      setError('Kode Barang / SKU harus diisi');
      return;
    }
    if (!itemName.trim()) {
      setError('Nama Barang harus diisi');
      return;
    }
    if (!assetAcc || !salesAcc || !cogsAcc) {
      setError('Harap hubungkan semua akun ledger yang diperlukan (Persediaan, Penjualan, HPP)');
      return;
    }

    setLoading(true);
    const skuCode = itemCode.trim().toUpperCase();
    const itemPath = `users/${userId}/companies/${companyId}/inventoryItems/${skuCode}`;

    try {
      const isNew = !editingItem;
      const qtyVal = isNew ? (Number(initialQty) || 0) : (editingItem.qtyOnHand);

      const newItemData: InventoryItem = {
        id: skuCode,
        name: itemName.trim(),
        qtyOnHand: qtyVal,
        buyPrice: Number(buyPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        assetAccountId: assetAcc,
        salesAccountId: salesAcc,
        cogsAccountId: cogsAcc,
        createdAt: editingItem?.createdAt || new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'inventoryItems', skuCode), newItemData);

      // If it's a new item and initial quantity is more than zero, log an initial stock journal entry
      if (isNew && qtyVal > 0) {
        const docRefNum = `IN-${Math.floor(1000 + Math.random() * 9000)}`;
        const totalCostVal = qtyVal * (Number(buyPrice) || 0);

        if (totalCostVal > 0) {
          const journalId = 'jr_inv_init_' + Math.random().toString(36).substring(2, 12);
          const journalPath = `users/${userId}/companies/${companyId}/journals/${journalId}`;
          const assetAccInfo = accounts.find(a => a.id === assetAcc);

          const lines: JournalLine[] = [
            {
              accountId: assetAcc,
              accountName: assetAccInfo?.name || 'Persediaan Barang',
              debit: totalCostVal,
              credit: 0
            },
            {
              accountId: '3-1100', // Capital / Modal (fallback or matching)
              accountName: accounts.find(a => a.id === '3-1100')?.name || 'Modal Pemilik',
              debit: 0,
              credit: totalCostVal
            }
          ];

          const journalData: MyobJournal = {
            id: journalId,
            referenceNum: docRefNum,
            date: new Date().toISOString().substring(0, 10),
            explanation: `Saldo Awal Persediaan Barang - ${skuCode}`,
            source: 'General Journal',
            lines,
            totalAmount: totalCostVal,
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'users', userId, 'companies', companyId, 'journals', journalId), journalData);
        }
      }

      setSuccess(`Barang ${skuCode} berhasil disimpan!`);
      setIsFormOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error('Error saving inventory item:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, itemPath);
      } catch (logErr) {
        setError('Gagal menyimpan barang. Pastikan format isian benar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (code: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus barang ${code}?`)) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    const itemPath = `users/${userId}/companies/${companyId}/inventoryItems/${code}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'companies', companyId, 'inventoryItems', code));
      setSuccess(`Barang ${code} berhasil dihapus.`);
      onRefresh();
    } catch (err: any) {
      console.error('Error removing inventory item:', err);
      setError('Gagal menghapus barang ini.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedItemId) {
      setError('Harap pilih barang yang akan disesuaikan');
      return;
    }
    const adjustQtyNum = Number(adjustQty) || 0;
    if (adjustQtyNum <= 0) {
      setError('Quantity penyesuaian harus lebih besar dari 0');
      return;
    }
    if (!offsetAccountId) {
      setError('Pilih akun tandingan (Offset Account) untuk penyeimbang jurnal');
      return;
    }

    const item = inventoryItems.find(i => i.id === selectedItemId);
    if (!item) {
      setError('Barang tidak ditemukan');
      return;
    }

    const costPerUnit = Number(adjustUnitCost) || item.buyPrice;
    if (costPerUnit <= 0) {
      setError('Nilai / harga per unit harus diisi');
      return;
    }

    setLoading(true);
    try {
      const adjustmentTotalCost = adjustQtyNum * costPerUnit;
      const refNum = `IA-${Math.floor(1000 + Math.random() * 9000)}`;
      const journalId = 'jr_inv_adj_' + Math.random().toString(36).substring(2, 12);
      
      const assetAccInfo = accounts.find(a => a.id === item.assetAccountId);
      const offsetAccInfo = accounts.find(a => a.id === offsetAccountId);

      // Debit/Credit depending on Increase / Decrease
      // Increase: Debit Asset Account, Credit Offset Account
      // Decrease: Debit Offset Account, Credit Asset Account
      const isIncrease = adjustType === 'Increase';
      const lines: JournalLine[] = isIncrease ? [
        {
          accountId: item.assetAccountId,
          accountName: assetAccInfo?.name || 'Persediaan',
          debit: adjustmentTotalCost,
          credit: 0
        },
        {
          accountId: offsetAccountId,
          accountName: offsetAccInfo?.name || 'Tandingan',
          debit: 0,
          credit: adjustmentTotalCost
        }
      ] : [
        {
          accountId: offsetAccountId,
          accountName: offsetAccInfo?.name || 'Tandingan',
          debit: adjustmentTotalCost,
          credit: 0
        },
        {
          accountId: item.assetAccountId,
          accountName: assetAccInfo?.name || 'Persediaan',
          debit: 0,
          credit: adjustmentTotalCost
        }
      ];

      // Save journal
      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'journals', journalId), {
        id: journalId,
        referenceNum: refNum,
        date: adjustDate,
        explanation: `${adjustExplanation} - ${item.id} (${isIncrease ? '+' : '-'}${adjustQtyNum} unit)`,
        source: 'General Journal',
        lines,
        totalAmount: adjustmentTotalCost,
        createdAt: new Date().toISOString()
      });

      // Update Qty On Hand in Firestore
      const newQty = isIncrease ? item.qtyOnHand + adjustQtyNum : item.qtyOnHand - adjustQtyNum;
      await updateDoc(doc(db, 'users', userId, 'companies', companyId, 'inventoryItems', item.id), {
        qtyOnHand: newQty
      });

      setSuccess(`Penyesuaian stok ${item.id} berhasil dicatat!`);
      // Reset form
      setAdjustQty('');
      setAdjustUnitCost('');
      setSelectedItemId('');
      onRefresh();
    } catch (err: any) {
      console.error('Error logging inventory adjustment:', err);
      setError('Gagal mencatat penyesuaian inventaris.');
    } finally {
      setLoading(false);
    }
  };

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div id="inventory_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800 font-sans">
        
        {/* Title bar emulating classic MYOB */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500 select-none">
          <span className="flex items-center gap-2">
            📦 Command Centre: Inventory Management (Modul Inventaris)
          </span>
          <button id="close_inventory_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs">✕</button>
        </div>

        {/* Workspace navigation */}
        <div className="bg-[#f2f2ef] border-b border-stone-300 p-2.5 flex justify-between items-center text-xs select-none">
          <div className="flex gap-1.5 font-bold">
            <button
              onClick={() => { setActiveTab('List'); setError(null); }}
              className={`px-4 py-1.5 rounded transition ${activeTab === 'List' ? 'bg-[#1e4682] text-white' : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'}`}
            >
              Daftar Rincian Barang (Item List)
            </button>
            <button
              onClick={() => { setActiveTab('Adjust'); setError(null); }}
              className={`px-4 py-1.5 rounded transition ${activeTab === 'Adjust' ? 'bg-[#1e4682] text-white' : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'}`}
            >
              Penyesuaian Fisik (Adjust Inventory)
            </button>
          </div>
          <span className="text-stone-500 font-mono">Tersedia {inventoryItems.length} barang terdaftar</span>
        </div>

        {/* Message Alert Banner */}
        {(error || success) && (
          <div className="px-4 pt-4 select-none">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 rounded text-xs font-medium">
                {success}
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 flex-1 overflow-y-auto bg-stone-50 min-h-0">
          
          {/* TAB 1: ITEM LIST */}
          {activeTab === 'List' && (
            <div className="space-y-4">
              {!isFormOpen ? (
                <>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-600 font-mono">Klik "Tambah Barang" untuk mendaftarkan barang baru dengan pemetaan perkiraan akuntansi secara otomatis.</span>
                    <button
                      onClick={handleOpenNewForm}
                      className="bg-[#1e4682] hover:bg-sky-800 text-white font-bold px-4 py-2 rounded flex items-center gap-1.5 transition active:translate-y-0.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Tambah Barang Baru (Item)
                    </button>
                  </div>

                  {inventoryItems.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-stone-300 rounded bg-white text-stone-500 font-serif">
                      <Package className="w-12 h-12 text-stone-300 mx-auto mb-2" />
                      Belum ada rincian barang draf atau persediaan terintegrasi.
                    </div>
                  ) : (
                    <div className="bg-white border border-stone-300 rounded overflow-x-auto shadow-sm">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="bg-stone-100 uppercase text-stone-600 font-bold border-b border-stone-300">
                            <th className="py-2.5 px-3 text-left">Kode Barang</th>
                            <th className="py-2.5 text-left">Nama Barang</th>
                            <th className="py-2.5 text-right">Stok Fisik</th>
                            <th className="py-2.5 text-right">Harga Beli</th>
                            <th className="py-2.5 text-right">Harga Jual</th>
                            <th className="py-2.5 text-right px-3">Total Nilai Asset</th>
                            <th className="py-2.5 text-center px-3">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {inventoryItems.map((item) => {
                            const totalVal = item.qtyOnHand * item.buyPrice;
                            return (
                              <tr key={item.id} className="hover:bg-amber-50/10">
                                <td className="py-2.5 px-3 font-semibold text-[#1e4682]">{item.id}</td>
                                <td className="py-2.5 text-stone-800 font-semibold">{item.name}</td>
                                <td className={`py-2.5 text-right font-bold ${item.qtyOnHand <= 2 ? 'text-red-700' : 'text-stone-700'}`}>
                                  {item.qtyOnHand} unit
                                </td>
                                <td className="py-2.5 text-right">{formatIDR(item.buyPrice)}</td>
                                <td className="py-2.5 text-right text-green-700 font-medium">{formatIDR(item.sellPrice)}</td>
                                <td className="py-2.5 text-right px-3 font-bold text-stone-900">{formatIDR(totalVal)}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex gap-2 justify-center">
                                    <button 
                                      onClick={() => handleOpenEditForm(item)}
                                      className="text-stone-500 hover:text-sky-700 p-1"
                                      title="Edit Barang"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="text-stone-400 hover:text-red-700 p-1"
                                      title="Hapus Barang"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                /* ADD / EDIT FORM */
                <form onSubmit={handleSaveItem} className="bg-white border border-stone-300 rounded p-5 space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b border-stone-200 pb-2 mb-2">
                    <h4 className="font-bold text-sm uppercase text-stone-900">
                      {editingItem ? `Edit Rincian Barang: ${editingItem.id}` : 'Tambah Barang Baru'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="text-stone-500 font-bold hover:underline"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Kode SKU / Kode Barang</label>
                      <input
                        type="text"
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        placeholder="e.g. BRG-001"
                        className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-2 font-mono"
                        disabled={!!editingItem}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Nama Barang / Deskripsi</label>
                      <input
                        type="text"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="e.g. Printer Epson L3110"
                        className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-2"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Harga Beli Standar (HPP per unit)</label>
                      <input
                        type="number"
                        value={buyPrice}
                        onChange={(e) => setBuyPrice(e.target.value)}
                        placeholder="0"
                        className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-2"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Harga Jual Standar (Invoice Price)</label>
                      <input
                        type="number"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                        placeholder="0"
                        className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-2 text-green-800 font-semibold"
                      />
                    </div>

                    {!editingItem && (
                      <div className="space-y-1">
                        <label className="block font-bold text-stone-600 uppercase">Kuantitas Stok Awal (Optional)</label>
                        <input
                          type="number"
                          value={initialQty}
                          onChange={(e) => setInitialQty(e.target.value)}
                          placeholder="0"
                          className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 py-2 font-mono text-stone-800"
                        />
                        <span className="block text-[10px] text-stone-500 mt-1 leading-normal">
                          Perhatian: Jika kuanti lebih besar dari 0, system akan mencatat jurnal debet persediaan dan kredit akun modal "3-1100" secara seimbang.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ACCOUNT LINKING SECTION */}
                  <div className="bg-amber-50/20 border border-amber-300/40 rounded p-4 space-y-3.5 mt-2">
                    <h5 className="font-bold text-stone-700 uppercase tracking-wide text-[10px]">🔗 Integrasi Tautan Akun Ledger (MYOB Ledger Mappings)</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="block font-bold text-stone-600 uppercase text-[9px]">Akun Persediaan (Asset Account)</label>
                        <select
                          value={assetAcc}
                          onChange={(e) => setAssetAcc(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1.5"
                          required
                        >
                          <option value="">-- Pilih Akun Asset --</option>
                          {assetAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-stone-600 uppercase text-[9px]">Akun Pendapatan (Sales Account)</label>
                        <select
                          value={salesAcc}
                          onChange={(e) => setSalesAcc(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1.5"
                          required
                        >
                          <option value="">-- Pilih Akun Pendapatan --</option>
                          {revenueAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-stone-600 uppercase text-[9px]">Akun HPP (COGS Account)</label>
                        <select
                          value={cogsAcc}
                          onChange={(e) => setCogsAcc(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1.5"
                          required
                        >
                          <option value="">-- Pilih Akun HPP --</option>
                          {cogsAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end border-t border-stone-150 pt-4 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="bg-stone-200 border border-stone-300 font-bold px-4 py-2 rounded text-stone-700"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 text-white font-bold px-5 py-2 rounded flex items-center gap-1 min-w-[120px] justify-center transition active:translate-y-0.5"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Simpan Barang
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: ADJUST INVENTORY */}
          {activeTab === 'Adjust' && (
            <div className="space-y-4">
              <div className="bg-[#eaeae6] border border-[#cfcfca] rounded p-5 max-w-2xl mx-auto space-y-4 text-xs">
                
                <h4 className="font-bold text-sm uppercase text-[#1e4682] border-b border-stone-300 pb-2 flex items-center gap-2">
                  <Hammer className="w-5 h-5 text-sky-800" /> Catat Penyesuaian Fisik Inventaris
                </h4>
                
                <p className="leading-relaxed text-stone-600">
                  Formulir ini digunakan apabila stock barang aktual di gudang berbeda dengan catatan sistem (misal: barang rusak, hilang, atau penyesuaian stock opname). Sistem akan secara otomatis membukukan transaksi penyesuaian dan mengoreksi kuantitas barang.
                </p>

                <form onSubmit={handleAdjustInventory} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Tanggal Buku (Date)</label>
                      <input
                        type="date"
                        value={adjustDate}
                        onChange={(e) => setAdjustDate(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Uraian / Memo Penjelasan</label>
                      <input
                        type="text"
                        value={adjustExplanation}
                        onChange={(e) => setAdjustExplanation(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Jenis Barang (Item SKU)</label>
                      <select
                        value={selectedItemId}
                        onChange={(e) => {
                          setSelectedItemId(e.target.value);
                          const matched = inventoryItems.find(i => i.id === e.target.value);
                          if (matched) {
                            setAdjustUnitCost(matched.buyPrice.toString());
                          }
                        }}
                        className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5"
                        required
                      >
                        <option value="">-- Pilih Barang --</option>
                        {inventoryItems.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.id} - {item.name} (Tersedia: {item.qtyOnHand} unit)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Arah Penyesuaian</label>
                      <div className="flex gap-3 pt-1">
                        <label className="flex items-center gap-1.5 font-bold cursor-pointer text-stone-700">
                          <input
                            type="radio"
                            name="adjustType"
                            checked={adjustType === 'Increase'}
                            onChange={() => setAdjustType('Increase')}
                            className="scale-110"
                          />
                          Penambahan (+ Stock)
                        </label>
                        <label className="flex items-center gap-1.5 font-bold cursor-pointer text-stone-700">
                          <input
                            type="radio"
                            name="adjustType"
                            checked={adjustType === 'Decrease'}
                            onChange={() => setAdjustType('Decrease')}
                            className="scale-110 text-red-650"
                          />
                          Pengurangan (- Stock)
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Kuantitas Penyesuaian (Qty)</label>
                      <input
                        type="number"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-stone-800"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-stone-600 uppercase">Biaya Pokok per unit (Rp)</label>
                      <input
                        type="number"
                        value={adjustUnitCost}
                        onChange={(e) => setAdjustUnitCost(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-stone-800"
                        required
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="block font-bold text-stone-600 uppercase">Akun Penyeimbang (Offset Account)</label>
                      <select
                        value={offsetAccountId}
                        onChange={(e) => setOffsetAccountId(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-stone-700"
                        required
                      >
                        <option value="">-- Pilih Akun Offset --</option>
                        {offsetAccountsSelection.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.id} - {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                      <span className="block text-[10px] text-stone-500 mt-1 leading-normal font-sans">
                        Misalnya jika "Penambahan", akan di-Dehabit ke akun Persediaan Barang dan di-Kredit ke akun Modal Pemilik (3-1100). Jika "Pengurangan" (misal: barang rusak atau susut), offsetnya bisa berupa Beban Kerusakan Persediaan (6-XXXX).
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-stone-300">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-emerald-700 hover:bg-emerald-800 border-2 border-emerald-800 text-white font-bold px-6 py-2 rounded flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin-slow" /> Buku & Sesuaikan Stok
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer classic grey */}
        <div className="bg-[#eaeae6] border-t border-stone-300 p-3.5 flex justify-between items-center text-xs select-none">
          <span className="text-stone-500 font-mono">Modul Persediaan terintegrasi chart of accounts untuk pelaporan laba kotor & arus kas secara otomatis.</span>
          <button 
            id="close_inventory_footer_btn" 
            onClick={onClose} 
            className="bg-stone-300 hover:bg-stone-400 border border-stone-400 text-stone-700 font-bold px-4 py-1.5 rounded cursor-pointer transition active:translate-y-0.5"
          >
            Tutup Modul
          </button>
        </div>

      </div>
    </div>
  );
}
