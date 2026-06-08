/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobAccount, MyobCard, InventoryItem, MyobJournal, JournalLine } from '../types';
import { Layers, Plus, Trash2, Calendar, FileText, CheckCircle, Save } from 'lucide-react';

interface PurchaseBillModalProps {
  userId: string;
  companyId: string;
  accounts: MyobAccount[];
  cards: MyobCard[];
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onRefresh?: () => void;
}

interface BillItemRow {
  itemId: string;
  qty: number;
  unitCost: number;
}

export default function PurchaseBillModal({
  userId,
  companyId,
  accounts,
  cards,
  inventoryItems,
  onClose,
  onRefresh
}: PurchaseBillModalProps) {
  const [billNum, setBillNum] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [billMemo, setBillMemo] = useState('Pembelian Barang Dagang (Faktur)');
  const [paymentTerm, setPaymentTerm] = useState<'Cash' | 'Credit'>('Cash');

  // Account selections
  const [assetCashAccount, setAssetCashAccount] = useState(''); // Kas/Bank for Cash Purchase
  const [payableAccount, setPayableAccount] = useState(''); // Utang Dagang for Credit Purchase

  const [rows, setRows] = useState<BillItemRow[]>([
    { itemId: '', qty: 1, unitCost: 0 }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const suppliers = cards.filter(c => c.type === 'Supplier');
  const postableAccounts = accounts.filter(a => a.classification === 'Detail');

  // Filter appropriate accounts
  const assetAccounts = postableAccounts.filter(a => a.type === 'Asset');
  const liabilityAccounts = postableAccounts.filter(a => a.type === 'Liability');

  useEffect(() => {
    // Standard incremental bill number
    setBillNum(`BILL-${Math.floor(1000 + Math.random() * 9000)}`);

    // Default accounts
    const defCash = assetAccounts.find(a => a.id === '1-1100' || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))?.id || assetAccounts[0]?.id || '';
    const defPayable = liabilityAccounts.find(a => a.id === '2-1100' || a.name.toLowerCase().includes('utang') || a.name.toLowerCase().includes('payable'))?.id || liabilityAccounts[0]?.id || '';

    setAssetCashAccount(defCash);
    setPayableAccount(defPayable);
  }, [accounts]);

  const handleAddRow = () => {
    setRows([...rows, { itemId: '', qty: 1, unitCost: 0 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      setError('Faktur pembelian minimal harus memiliki 1 item barang');
      return;
    }
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
  };

  const handleRowChange = (index: number, field: keyof BillItemRow, value: string) => {
    const newRows = [...rows];
    if (field === 'itemId') {
      newRows[index].itemId = value;
      const matchedItem = inventoryItems.find(i => i.id === value);
      if (matchedItem) {
        newRows[index].unitCost = matchedItem.buyPrice;
      }
    } else if (field === 'qty') {
      newRows[index].qty = Math.max(1, parseInt(value) || 0);
    } else if (field === 'unitCost') {
      newRows[index].unitCost = Math.max(0, Number(value) || 0);
    }
    setRows(newRows);
  };

  // Live total sum
  const calculatedTotal = rows.reduce((sum, row) => sum + (row.qty * row.unitCost), 0);

  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 1. Validation Checks
    if (!billNum.trim()) {
      setError('Nomor bukti pembelian harus diisi');
      return;
    }
    if (!selectedSupplierId) {
      setError('Pilih pemasok (Supplier) terlebih dahulu');
      return;
    }
    if (paymentTerm === 'Cash' && !assetCashAccount) {
      setError('Harap pilih akun Kas/Bank untuk mencatat pembayaran tunai');
      return;
    }
    if (paymentTerm === 'Credit' && !payableAccount) {
      setError('Harap pilih akun Utang Dagang untuk mencatat kredit utang');
      return;
    }

    // Verify row lines
    const processedRows: { item: InventoryItem; qty: number; cost: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.itemId) {
        setError(`Pilih jenis barang pada baris #${i + 1}`);
        return;
      }
      const item = inventoryItems.find(item => item.id === row.itemId);
      if (!item) {
        setError(`Baris #${i + 1} mengacu pada barang yang tidak dikenali.`);
        return;
      }
      processedRows.push({
        item,
        qty: row.qty,
        cost: row.unitCost
      });
    }

    if (processedRows.length === 0) {
      setError('Harap tambahkan setidaknya satu item barang.');
      return;
    }

    setLoading(true);
    const journalId = 'jr_purchases_' + Math.random().toString(36).substring(2, 12);
    const journalPath = `users/${userId}/companies/${companyId}/journals/${journalId}`;

    try {
      const supplierInfo = cards.find(c => c.id === selectedSupplierId);
      const activeTermAccount = paymentTerm === 'Cash' ? assetCashAccount : payableAccount;
      const termAccountName = accounts.find(a => a.id === activeTermAccount)?.name || 'Akun Pembayaran';

      // Assemble double-entry journal postings lines
      const lines: JournalLine[] = [];

      // 1. Credit Entry (Payables or Cash/Bank for the manufacturer invoice's total cost)
      lines.push({
        accountId: activeTermAccount,
        accountName: `${termAccountName} (${supplierInfo?.name || 'Pemasok'})`,
        debit: 0,
        credit: calculatedTotal
      });

      // 2. Debit Entries for asset merchandise accounts
      const stockUpdates: { itemId: string; newQty: number; newBuyPrice: number }[] = [];

      for (const rowData of processedRows) {
        const itemCostTotal = rowData.qty * rowData.cost;
        const mappedAssetAcc = rowData.item.assetAccountId;
        const assetAccName = accounts.find(a => a.id === mappedAssetAcc)?.name || 'Persediaan Barang';

        // Debit Asset Line
        lines.push({
          accountId: mappedAssetAcc,
          accountName: `${assetAccName} - ${rowData.item.id}`,
          debit: itemCostTotal,
          credit: 0
        });

        // Populate stock update (including potential update of average buyPrice)
        stockUpdates.push({
          itemId: rowData.item.id,
          newQty: rowData.item.qtyOnHand + rowData.qty,
          newBuyPrice: rowData.cost // Update pricing index to latest purchase price
        });
      }

      // Save journal purchase transaction
      const journalData: MyobJournal = {
        id: journalId,
        referenceNum: billNum.trim().toUpperCase(),
        date: purchaseDate,
        explanation: `${billMemo} (${supplierInfo?.name || 'Supplier'}): ${paymentTerm === 'Cash' ? 'TUNAI' : 'KREDIT'}`,
        source: paymentTerm === 'Cash' ? 'Spend Money' : 'General Journal',
        lines,
        totalAmount: calculatedTotal,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'journals', journalId), journalData);

      // 4. Update quantities and prices in Firestore
      for (const update of stockUpdates) {
        await updateDoc(doc(db, 'users', userId, 'companies', companyId, 'inventoryItems', update.itemId), {
          qtyOnHand: update.newQty,
          buyPrice: update.newBuyPrice
        });
      }

      setSuccess(`Faktur Pembelian ${billNum} sukses dibukukan!`);
      onRefresh();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Error posting purchase bill:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, journalPath);
      } catch (logErr) {
        setError('Gagal membukukan faktur pembelian. Periksa setup akun ledger persediaan Anda.');
      }
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
    <div id="purchase_bill_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800 font-sans">
        
        {/* Title bar emulating classic MYOB */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500 select-none">
          <span className="flex items-center gap-2">
            📥 Faktur Pembelian Baru (Purchase Billing Entry)
          </span>
          <button id="close_purchase_bill_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs">✕</button>
        </div>

        <form onSubmit={handleSubmitBill} className="flex-1 flex flex-col min-h-0">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {error && (
              <div id="purchase_bill_error" className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs select-none">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 rounded text-xs select-none">
                {success}
              </div>
            )}

            {/* Bill Header Details */}
            <div className="bg-[#eaeae6] border border-stone-300 rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs select-none">
              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Nomor Bukti (Bill / Purchase #)</label>
                <input
                  type="text"
                  value={billNum}
                  onChange={(e) => setBillNum(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-stone-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Tanggal Pembelian (Date)</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-stone-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Pemasok (Supplier Card)</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2 py-1.5"
                  required
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.cardIdCode})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Termin / Metode Bayar</label>
                <div className="flex gap-2.5 pt-1.5">
                  <label className="flex items-center gap-1 cursor-pointer font-bold select-none text-stone-700">
                    <input
                      type="radio"
                      name="termCheckBill"
                      checked={paymentTerm === 'Cash'}
                      onChange={() => setPaymentTerm('Cash')}
                    /> Tunai (Cash)
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-bold select-none text-stone-700">
                    <input
                      type="radio"
                      name="termCheckBill"
                      checked={paymentTerm === 'Credit'}
                      onChange={() => setPaymentTerm('Credit')}
                    /> Kredit (Utang)
                  </label>
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block font-bold text-stone-600 uppercase">Catatan Memo Jurnal</label>
                <input
                  type="text"
                  value={billMemo}
                  onChange={(e) => setBillMemo(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5"
                  required
                />
              </div>

              {/* Dynamic account selectors depending on payment terms */}
              {paymentTerm === 'Cash' ? (
                <div className="space-y-1 md:col-span-2">
                  <label className="block font-bold text-stone-600 uppercase">Bayar Dari Akun Kas (Cash/Bank Asset)</label>
                  <select
                    value={assetCashAccount}
                    onChange={(e) => setAssetCashAccount(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-blue-900 font-bold"
                  >
                    {assetAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.id} - {a.name} ({formatIDR(a.openingBalance)})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1 md:col-span-2">
                  <label className="block font-bold text-stone-600 uppercase">Akun Utang Kredit (Accounts Payable liability)</label>
                  <select
                    value={payableAccount}
                    onChange={(e) => setPayableAccount(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-amber-900 font-bold"
                  >
                    {liabilityAccounts.filter(a => a.id.startsWith('2-11') || a.name.toLowerCase().includes('utang') || a.name.toLowerCase().includes('payable')).map(a => (
                      <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                    ))}
                    {liabilityAccounts.filter(a => !(a.id.startsWith('2-11') || a.name.toLowerCase().includes('utang') || a.name.toLowerCase().includes('payable'))).map(a => (
                      <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Faktur Line Items table/rows editing */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase text-[#1e4682] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-800" /> Detail Rincian Barang Faktur Pembelian (Belanja Stok)
              </h4>

              <div className="bg-white border border-stone-300 rounded shadow-sm overflow-hidden text-xs text-stone-850">
                <table className="w-full select-none">
                  <thead>
                    <tr className="bg-stone-100 uppercase text-stone-600 border-b border-stone-300 font-bold">
                      <th className="py-2 px-3 text-left w-[40%]">Nama Barang Dagang/Inventory SKU</th>
                      <th className="py-2 text-right w-[15%]">Kuantitas Dibeli</th>
                      <th className="py-2 text-right w-[20%]">Biaya Beli Satuan (Rp)</th>
                      <th className="py-2 text-right w-[20%]">Subtotal Netto (Rp)</th>
                      <th className="py-2 text-center w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150">
                    {rows.map((row, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-amber-50/10">
                          <td className="p-2">
                            <select
                              value={row.itemId}
                              onChange={(e) => handleRowChange(idx, 'itemId', e.target.value)}
                              className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1"
                              required
                            >
                              <option value="">-- Pilih Barang Dagang --</option>
                              {inventoryItems.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.id} - {item.name} (Stok: {item.qtyOnHand} unit)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={row.qty}
                              onChange={(e) => handleRowChange(idx, 'qty', e.target.value)}
                              className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1 text-right font-mono"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={row.unitCost}
                              onChange={(e) => handleRowChange(idx, 'unitCost', e.target.value)}
                              className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1 text-right font-mono"
                              required
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-stone-700 pr-4 font-mono select-text">
                            {formatIDR(row.qty * row.unitCost)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="text-stone-400 hover:text-red-700 p-1"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Line button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold px-3 py-1.5 rounded text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Baris Pembelian/Penjualan
              </button>
            </div>
          </div>

          {/* Bottom Summary Panel */}
          <div className="bg-[#d8d8d3] border-t border-stone-400 p-4 shrink-0 flex flex-col md:flex-row justify-between items-center text-xs gap-3 font-sans">
            <div className="text-stone-600 font-mono text-center md:text-left select-none">
              Sistem akan memposting: Debit ke Persediaan Barang Dagang & Kredit ke {paymentTerm === 'Cash' ? 'Kas/Bank' : 'Utang Dagang'} serta menambahkan stok barang otomatis.
            </div>

            <div className="flex gap-6 items-center">
              <div className="text-right select-none">
                <span className="block text-stone-500 font-bold uppercase text-[9px] tracking-wide">GRAND TOTAL BELANJA STOK</span>
                <span className="text-xl font-black text-[#1e4682] font-mono select-text">{formatIDR(calculatedTotal)}</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-stone-200 border border-stone-300 font-bold px-4 py-2.5 rounded text-stone-750"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-2.5 rounded flex items-center gap-1.5 hover:shadow-md transition active:translate-y-0.5 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Buku Faktur Pembelian (Purchases)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
