/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MyobAccount } from '../types';

export interface CoaTemplate {
  id: string;
  name: string;
  description: string;
  accounts: MyobAccount[];
}

export const COA_TEMPLATES: CoaTemplate[] = [
  {
    id: 'perusahaan_jasa',
    name: 'Perusahaan Jasa (Service Business Preset)',
    description: 'Cocok untuk kantor pengacara, konsultan, agen, laundry, bengkel, bimbel atau bisnis layanan lainnya.',
    accounts: [
      // ASSETS (1-xxxx)
      { id: '1-0000', name: 'AKTIVA', type: 'Asset', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-1000', name: 'Aktiva Lancar', type: 'Asset', classification: 'Header', parentCode: '1-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-1100', name: 'Kas di Bank', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 50000000, balanceType: 'Debit' },
      { id: '1-1200', name: 'Kas Kecil (Petty Cash)', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 2000000, balanceType: 'Debit' },
      { id: '1-1300', name: 'Piutang Usaha (Accounts Receivable)', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-1400', name: 'Perlengkapan Kantor (Supplies)', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 1500000, balanceType: 'Debit' },
      { id: '1-1500', name: 'Asuransi Dibayar Dimuka', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 6000000, balanceType: 'Debit' },
      
      { id: '1-2000', name: 'Aktiva Tetap', type: 'Asset', classification: 'Header', parentCode: '1-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-2100', name: 'Peralatan Kantor (Equipment)', type: 'Asset', classification: 'Detail', parentCode: '1-2000', openingBalance: 12000000, balanceType: 'Debit' },
      { id: '1-2150', name: 'Akum. Peny. Peralatan Kantor', type: 'Asset', classification: 'Detail', parentCode: '1-2000', openingBalance: -2000000, balanceType: 'Debit' },

      // LIABILITIES (2-xxxx)
      { id: '2-0000', name: 'KEWAJIBAN', type: 'Liability', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1000', name: 'Kewajiban Jangka Pendek', type: 'Liability', classification: 'Header', parentCode: '2-0000', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1100', name: 'Utang Usaha (Accounts Payable)', type: 'Liability', classification: 'Detail', parentCode: '2-1000', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1200', name: 'Utang Gaji (Wages Payable)', type: 'Liability', classification: 'Detail', parentCode: '2-1000', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1300', name: 'Pendapatan Diterima Dimuka', type: 'Liability', classification: 'Detail', parentCode: '2-1000', openingBalance: 0, balanceType: 'Credit' },

      // EQUITY (3-xxxx)
      { id: '3-0000', name: 'EKUITAS', type: 'Equity', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '3-1100', name: 'Modal Pemilik (Owner\'s Capital)', type: 'Equity', classification: 'Detail', parentCode: '3-0000', openingBalance: 69500000, balanceType: 'Credit' },
      { id: '3-1200', name: 'Prive Pemilik (Owner\'s Drawing)', type: 'Equity', classification: 'Detail', parentCode: '3-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '3-1300', name: 'Ikhtisar Laba Rugi', type: 'Equity', classification: 'Detail', parentCode: '3-0000', openingBalance: 0, balanceType: 'Credit' },

      // REVENUE (4-xxxx)
      { id: '4-0000', name: 'PENDAPATAN', type: 'Revenue', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '4-1100', name: 'Pendapatan Jasa (Service Revenue)', type: 'Revenue', classification: 'Detail', parentCode: '4-0000', openingBalance: 0, balanceType: 'Credit' },

      // COST OF SALES (5-xxxx) - Usually empty for Jasa, but we put header to match MYOB layout
      { id: '5-0000', name: 'HARGA POKOK PENJUALAN', type: 'Cost Of Sales', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },

      // EXPENSE (6-xxxx)
      { id: '6-0000', name: 'BEBAN OPERASIONAL', type: 'Expense', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1100', name: 'Beban Gaji & Upah (Wages Expense)', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1200', name: 'Beban Sewa Kantor (Rent Expense)', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1300', name: 'Beban Utilitas (Listrik, Air, Internet)', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1400', name: 'Beban Perlengkapan (Supplies Expense)', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1500', name: 'Beban Asuransi (Insurance Expense)', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1600', name: 'Beban Depresiasi Peralatan', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },

      // OTHER INCOME (8-xxxx)
      { id: '8-0000', name: 'PENDAPATAN LAIN-LAIN', type: 'Other Income', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '8-1100', name: 'Pendapatan Bunga Bank', type: 'Other Income', classification: 'Detail', parentCode: '8-0000', openingBalance: 0, balanceType: 'Credit' },

      // OTHER EXPENSE (9-xxxx)
      { id: '9-0000', name: 'BEBAN LAIN-LAIN', type: 'Other Expense', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },
      { id: '9-1100', name: 'Beban Administrasi Bank', type: 'Other Expense', classification: 'Detail', parentCode: '9-0000', openingBalance: 0, balanceType: 'Debit' }
    ]
  },
  {
    id: 'perusahaan_dagang',
    name: 'Perusahaan Dagang (Trading Business Preset)',
    description: 'Cocok untuk minimarket, toko grosir/eceran, apotek, distributor, butik baju yang memiliki Stok Persediaan Barang Dagang.',
    accounts: [
      // ASSETS (1-xxxx)
      { id: '1-0000', name: 'AKTIVA', type: 'Asset', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-1000', name: 'Aktiva Lancar', type: 'Asset', classification: 'Header', parentCode: '1-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-1100', name: 'Kas di Bank', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 80000000, balanceType: 'Debit' },
      { id: '1-1200', name: 'Kas Kasir / Laci Kas', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 5000000, balanceType: 'Debit' },
      { id: '1-1300', name: 'Piutang Dagang (A/R)', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-1400', name: 'Persediaan Barang Dagang (Inventory)', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 45000000, balanceType: 'Debit' },
      { id: '1-1500', name: 'Perlengkapan Toko', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 3000000, balanceType: 'Debit' },
      { id: '1-1600', name: 'Sewa Dibayar Dimuka', type: 'Asset', classification: 'Detail', parentCode: '1-1000', openingBalance: 12000000, balanceType: 'Debit' },
      
      { id: '1-2000', name: 'Aktiva Tetap', type: 'Asset', classification: 'Header', parentCode: '1-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '1-2100', name: 'Kendaraan Toko', type: 'Asset', classification: 'Detail', parentCode: '1-2000', openingBalance: 40000000, balanceType: 'Debit' },
      { id: '1-2150', name: 'Akum. Peny. Kendaraan', type: 'Asset', classification: 'Detail', parentCode: '1-2000', openingBalance: -5000000, balanceType: 'Debit' },

      // LIABILITIES (2-xxxx)
      { id: '2-0000', name: 'KEWAJIBAN', type: 'Liability', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1000', name: 'Kewajiban Lancar', type: 'Liability', classification: 'Header', parentCode: '2-0000', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1100', name: 'Utang Dagang (Accounts Payable)', type: 'Liability', classification: 'Detail', parentCode: '2-1000', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1200', name: 'Utang PPN (VAT Payable)', type: 'Liability', classification: 'Detail', parentCode: '2-1000', openingBalance: 0, balanceType: 'Credit' },
      { id: '2-1300', name: 'Utang Gaji', type: 'Liability', classification: 'Detail', parentCode: '2-1000', openingBalance: 0, balanceType: 'Credit' },

      // EQUITY (3-xxxx)
      { id: '3-0000', name: 'EKUITAS', type: 'Equity', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '3-1100', name: 'Modal Usaha (Capital)', type: 'Equity', classification: 'Detail', parentCode: '3-0000', openingBalance: 180000000, balanceType: 'Credit' },
      { id: '3-1200', name: 'Prive Saham / Owner Drawing', type: 'Equity', classification: 'Detail', parentCode: '3-0000', openingBalance: 0, balanceType: 'Debit' },

      // REVENUE (4-xxxx)
      { id: '4-0000', name: 'PENDAPATAN DAN PENJUALAN', type: 'Revenue', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '4-1100', name: 'Penjualan Barang Dagang (Sales)', type: 'Revenue', classification: 'Detail', parentCode: '4-0000', openingBalance: 0, balanceType: 'Credit' },
      { id: '4-1200', name: 'Retur Penjualan (Sales Return)', type: 'Revenue', classification: 'Detail', parentCode: '4-0000', openingBalance: 0, balanceType: 'Debit' }, // Contra revenue
      { id: '4-1300', name: 'Potongan Penjualan (Sales Discount)', type: 'Revenue', classification: 'Detail', parentCode: '4-0000', openingBalance: 0, balanceType: 'Debit' },

      // COST OF SALES (5-xxxx)
      { id: '5-0000', name: 'HARGA POKOK PENJUALAN (COGS)', type: 'Cost Of Sales', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },
      { id: '5-1100', name: 'Harga Pokok Penjualan (HPP)', type: 'Cost Of Sales', classification: 'Detail', parentCode: '5-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '5-1200', name: 'Pembelian Barang Dagang', type: 'Cost Of Sales', classification: 'Detail', parentCode: '5-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '5-1300', name: 'Beban Angkut Pembelian (Freight In)', type: 'Cost Of Sales', classification: 'Detail', parentCode: '5-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '5-1400', name: 'Potongan Pembelian (Purchase Discount)', type: 'Cost Of Sales', classification: 'Detail', parentCode: '5-0000', openingBalance: 0, balanceType: 'Credit' },

      // EXPENSE (6-xxxx)
      { id: '6-0000', name: 'BEBAN OPERASIONAL & TOKO', type: 'Expense', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1100', name: 'Beban Gaji Karyawan', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1200', name: 'Beban Sewa Ruko', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1300', name: 'Beban Listrik & Air Toko', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1400', name: 'Beban Angkut Penjualan (Freight Out)', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1500', name: 'Beban Perlengkapan Toko', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },
      { id: '6-1600', name: 'Beban Promosi / Iklan', type: 'Expense', classification: 'Detail', parentCode: '6-0000', openingBalance: 0, balanceType: 'Debit' },

      // OTHER INCOME (8-xxxx)
      { id: '8-0000', name: 'PENDAPATAN LAIN-LAIN', type: 'Other Income', classification: 'Header', openingBalance: 0, balanceType: 'Credit' },
      { id: '8-1100', name: 'Keuntungan Selisih Kurs', type: 'Other Income', classification: 'Detail', parentCode: '8-0000', openingBalance: 0, balanceType: 'Credit' },

      // OTHER EXPENSE (9-xxxx)
      { id: '9-0000', name: 'BEBAN LAIN-LAIN', type: 'Other Expense', classification: 'Header', openingBalance: 0, balanceType: 'Debit' },
      { id: '9-1100', name: 'Beban Pajak PPh', type: 'Other Expense', classification: 'Detail', parentCode: '9-0000', openingBalance: 0, balanceType: 'Debit' }
    ]
  }
];
