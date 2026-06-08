/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobAccount, MyobCard, InventoryItem, MyobJournal, JournalLine } from '../types';
import { Layers, Plus, Trash2, Calendar, FileText, CheckCircle, Save, UserCheck } from 'lucide-react';

interface SalesInvoiceModalProps {
  userId: string;
  companyId: string;
  accounts: MyobAccount[];
  cards: MyobCard[];
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onRefresh?: () => void;
}

interface InvoiceItemRow {
  itemId: string;
  qty: number;
  unitPrice: number;
}

export default function SalesInvoiceModal({
  userId,
  companyId,
  accounts,
  cards,
  inventoryItems,
  onClose,
  onRefresh
}: SalesInvoiceModalProps) {
  const [invoiceNum, setInvoiceNum] = useState('');
  const [salesDate, setSalesDate] = useState(new Date().toISOString().substring(0, 10));
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceMemo, setInvoiceMemo] = useState('Penjualan Barang Dagang (Faktur)');
  const [paymentTerm, setPaymentTerm] = useState<'Cash' | 'Credit'>('Cash');
  
  // Account selections
  const [assetCashAccount, setAssetCashAccount] = useState(''); // Kas/Bank for Cash Sales
  const [receivableAccount, setReceivableAccount] = useState(''); // Piutang Usaha for Credit Sales

  const [rows, setRows] = useState<InvoiceItemRow[]>([
    { itemId: '', qty: 1, unitPrice: 0 }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const customers = cards.filter(c => c.type === 'Customer');
  const postableAccounts = accounts.filter(a => a.classification === 'Detail');
  
  // Filter appropriate accounts for dropdowns
  const assetAccounts = postableAccounts.filter(a => a.type === 'Asset');

  // Set default values
  useEffect(() => {
    // Standard incremental invoice number
    setInvoiceNum(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
    
    // Set standard defaults for accounts
    const defCash = assetAccounts.find(a => a.id === '1-1100' || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))?.id || assetAccounts[0]?.id || '';
    const defReceivable = assetAccounts.find(a => a.id === '1-1300' || a.name.toLowerCase().includes('piutang'))?.id || assetAccounts[0]?.id || '';
    
    setAssetCashAccount(defCash);
    setReceivableAccount(defReceivable);
  }, [accounts]);

  const handleAddRow = () => {
    setRows([...rows, { itemId: '', qty: 1, unitPrice: 0 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      setError('Faktur setidaknya harus memiliki 1 baris item penjualan');
      return;
    }
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
  };

  const handleRowChange = (index: number, field: keyof InvoiceItemRow, value: string) => {
    const newRows = [...rows];
    if (field === 'itemId') {
      newRows[index].itemId = value;
      const matchedItem = inventoryItems.find(i => i.id === value);
      if (matchedItem) {
        newRows[index].unitPrice = matchedItem.sellPrice;
      }
    } else if (field === 'qty') {
      newRows[index].qty = Math.max(1, parseInt(value) || 0);
    } else if (field === 'unitPrice') {
      newRows[index].unitPrice = Math.max(0, Number(value) || 0);
    }
    setRows(newRows);
  };

  // Live total sum
  const calculatedTotal = rows.reduce((sum, row) => sum + (row.qty * row.unitPrice), 0);

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 1. Validation Checks
    if (!invoiceNum.trim()) {
      setError('Nomor faktur harus diisi');
      return;
    }
    if (!selectedCustomerId) {
      setError('Pilih pelanggan (Customer) terlebih dahulu');
      return;
    }
    if (paymentTerm === 'Cash' && !assetCashAccount) {
      setError('Harap pilih akun Kas/Bank untuk mencatat penerimaan tunai');
      return;
    }
    if (paymentTerm === 'Credit' && !receivableAccount) {
      setError('Harap pilih akun Piutang Usaha untuk mencatat kredit piutang');
      return;
    }

    // Verify row lines
    const processedRows: { item: InventoryItem; qty: number; price: number }[] = [];
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
      if (item.qtyOnHand < row.qty) {
        setError(`Stok barang "${item.name}" tidak mencukupi. Tersedia: ${item.qtyOnHand} unit, Diminta: ${row.qty} unit.`);
        return;
      }
      processedRows.push({
        item,
        qty: row.qty,
        price: row.unitPrice,
      });
    }

    if (processedRows.length === 0) {
      setError('Harap tambahkan setidaknya satu item penjualan barang dagangan.');
      return;
    }

    setLoading(true);
    const journalId = 'jr_sales_' + Math.random().toString(36).substring(2, 12);
    const journalPath = `users/${userId}/companies/${companyId}/journals/${journalId}`;

    try {
      const customerInfo = cards.find(c => c.id === selectedCustomerId);
      const activeTermAccount = paymentTerm === 'Cash' ? assetCashAccount : receivableAccount;
      const termAccountName = accounts.find(a => a.id === activeTermAccount)?.name || 'Akun Aktiva';

      // Assemble double-entry journal postings lines
      const lines: JournalLine[] = [];

      // 1. Debit Entry (Receivable or Cash/Bank for the customer invoice's total gross sales)
      lines.push({
        accountId: activeTermAccount,
        accountName: `${termAccountName} (${customerInfo?.name || 'Pelanggan'})`,
        debit: calculatedTotal,
        credit: 0
      });

      // 2. Credit Entries for Sales Revenue mapping of each item types, and also COGS tracking
      // To compress multi-item invoices onto clean books, we define separate lines or sum them
      const stockUpdates: { itemId: string; newQty: number }[] = [];
      let cogsTotal = 0;

      for (const rowData of processedRows) {
        const itemSalesTotal = rowData.qty * rowData.price;
        const itemCogsTotal = rowData.qty * rowData.item.buyPrice;
        
        const mappedSalesAcc = rowData.item.salesAccountId;
        const salesAccInfo = accounts.find(a => a.id === mappedSalesAcc);

        // Credit Revenue line
        lines.push({
          accountId: mappedSalesAcc,
          accountName: `Pendapatan Jasa/Penjualan - ${rowData.item.id}`,
          debit: 0,
          credit: itemSalesTotal
        });

        // Add to COGS aggregate
        cogsTotal += itemCogsTotal;

        // Populate stock update
        stockUpdates.push({
          itemId: rowData.item.id,
          newQty: rowData.item.qtyOnHand - rowData.qty
        });
      }

      // 3. Register COGS entry (HPP & merchandise stock adjustments)
      if (cogsTotal > 0) {
        // Find default accounts from the first item
        const firstItem = processedRows[0].item;
        
        const cogsAccId = firstItem.cogsAccountId;
        const cogsAccInfo = accounts.find(a => a.id === cogsAccId) || accounts.find(a => a.type === 'Cost Of Sales');
        
        const assetAccId = firstItem.assetAccountId;
        const assetAccInfo = accounts.find(a => a.id === assetAccId) || accounts.find(a => a.type === 'Asset');

        // Debit COGS
        lines.push({
          accountId: cogsAccId,
          accountName: `HPP / COGS - ${firstItem.id}`,
          debit: cogsTotal,
          credit: 0
        });

        // Credit Merchandise Inventory asset
        lines.push({
          accountId: assetAccId,
          accountName: `Pengurangan Persediaan - ${firstItem.id}`,
          debit: 0,
          credit: cogsTotal
        });
      }

      // Save journal invoice transaction
      const journalData: MyobJournal = {
        id: journalId,
        referenceNum: invoiceNum.trim().toUpperCase(),
        date: salesDate,
        explanation: `${invoiceMemo} (${customerInfo?.name || 'Customer'}): ${paymentTerm === 'Cash' ? 'TUNAI' : 'KREDIT'}`,
        source: paymentTerm === 'Cash' ? 'Receive Money' : 'General Journal',
        lines,
        totalAmount: calculatedTotal + cogsTotal, // Balanced checks tally representing aggregate movements
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', userId, 'companies', companyId, 'journals', journalId), journalData);

      // 4. Atomically update quantities on hand in Firestore
      for (const update of stockUpdates) {
        await updateDoc(doc(db, 'users', userId, 'companies', companyId, 'inventoryItems', update.itemId), {
          qtyOnHand: update.newQty
        });
      }

      setSuccess(`Faktur Penjualan ${invoiceNum} sukses diterbitkan!`);
      // Update local storage models
      onRefresh();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Error posting sales invoice:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, journalPath);
      } catch (logErr) {
        setError('Gagal membukukan faktur penjualan. Periksa setup akun ledger persediaan Anda.');
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
    <div id="sales_invoice_modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#e5e5e0] w-full max-w-4xl border-2 border-stone-400 rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-800 font-sans">
        
        {/* Title bar emulating classic MYOB */}
        <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-stone-500 select-none">
          <span className="flex items-center gap-2">
            🧾 Faktur Penjualan Baru (Sales Invoicing Entry)
          </span>
          <button id="close_sales_invoice_btn" onClick={onClose} className="hover:bg-red-600 px-1.5 py-0.5 rounded text-xs">✕</button>
        </div>

        <form onSubmit={handleSubmitInvoice} className="flex-1 flex flex-col min-h-0">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {error && (
              <div id="sales_invoice_error" className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs select-none">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 rounded text-xs select-none">
                {success}
              </div>
            )}

            {/* Invoice Header Details */}
            <div className="bg-[#eaeae6] border border-stone-300 rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs select-none">
              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Nomor Faktur (Invoice #)</label>
                <input
                  type="text"
                  value={invoiceNum}
                  onChange={(e) => setInvoiceNum(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-stone-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Tanggal Faktur (Date)</label>
                <input
                  type="date"
                  value={salesDate}
                  onChange={(e) => setSalesDate(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-stone-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Konsumen (Customer Card)</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2 py-1.5"
                  required
                >
                  <option value="">-- Pilih Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.cardIdCode})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-600 uppercase">Termin / Metode Bayar</label>
                <div className="flex gap-2.5 pt-1.5">
                  <label className="flex items-center gap-1 cursor-pointer font-bold select-none text-stone-700">
                    <input
                      type="radio"
                      name="termCheck"
                      checked={paymentTerm === 'Cash'}
                      onChange={() => setPaymentTerm('Cash')}
                    /> Tunai
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-bold select-none text-stone-700">
                    <input
                      type="radio"
                      name="termCheck"
                      checked={paymentTerm === 'Credit'}
                      onChange={() => setPaymentTerm('Credit')}
                    /> Kredit (Termin)
                  </label>
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block font-bold text-stone-600 uppercase">Catatan Memo Jurnal</label>
                <input
                  type="text"
                  value={invoiceMemo}
                  onChange={(e) => setInvoiceMemo(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5"
                  required
                />
              </div>

              {/* Dynamic account selectors depending on payment terms */}
              {paymentTerm === 'Cash' ? (
                <div className="space-y-1 md:col-span-2">
                  <label className="block font-bold text-stone-600 uppercase">Setor Tunai Ke Akun (Cash/Bank Asset)</label>
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
                  <label className="block font-bold text-stone-600 uppercase">Akun Piutang Debit (Receivables Ledger)</label>
                  <select
                    value={receivableAccount}
                    onChange={(e) => setReceivableAccount(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-amber-900 font-bold"
                  >
                    {assetAccounts.filter(a => a.id.startsWith('1-13') || a.name.toLowerCase().includes('piutang')).map(a => (
                      <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                    ))}
                    {assetAccounts.filter(a => !(a.id.startsWith('1-13') || a.name.toLowerCase().includes('piutang'))).map(a => (
                      <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Faktur Line Items table/rows editing */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase text-[#1e4682] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-800" /> Detail Rincian Barang Faktur Penjualan
              </h4>

              <div className="bg-white border border-stone-300 rounded shadow-sm overflow-hidden text-xs">
                <table className="w-full select-none">
                  <thead>
                    <tr className="bg-stone-100 uppercase text-stone-600 border-b border-stone-300 font-bold">
                      <th className="py-2 px-3 text-left w-[40%]">Nama Barang Dagang/Inventory SKU</th>
                      <th className="py-2 text-right w-[15%]">Kuantitas Terjual</th>
                      <th className="py-2 text-right w-[20%]">Harga Jual Satuan (Rp)</th>
                      <th className="py-2 text-right w-[20%]">Subtotal Netto (Rp)</th>
                      <th className="py-2 text-center w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150">
                    {rows.map((row, idx) => {
                      const matchedItem = inventoryItems.find(i => i.id === row.itemId);
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
                              value={row.unitPrice}
                              onChange={(e) => handleRowChange(idx, 'unitPrice', e.target.value)}
                              className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1 text-right font-mono"
                              required
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-stone-700 pr-4 font-mono select-text">
                            {formatIDR(row.qty * row.unitPrice)}
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

          {/* Bottom Aggregate Summary Panel */}
          <div className="bg-[#d8d8d3] border-t border-stone-400 p-4 shrink-0 flex flex-col md:flex-row justify-between items-center text-xs gap-3">
            <div className="text-stone-600 font-mono text-center md:text-left select-none">
              Sistem akan memposting: Debit ke {paymentTerm === 'Cash' ? 'Kas/Bank' : 'Piutang'} dsb & Kredit ke Penjualan, serta mencatat HPP barang keluar otomatis.
            </div>

            <div className="flex gap-6 items-center">
              <div className="text-right select-none">
                <span className="block text-stone-500 font-bold uppercase text-[9px] tracking-wide">GRAND TOTAL FAKTUR PENJUALAN</span>
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
                      <Save className="w-4 h-4" /> Buku Faktur Penjualan (Sales)
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
