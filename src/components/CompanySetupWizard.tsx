/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MyobCompany, MyobAccount } from '../types';
import { COA_TEMPLATES } from '../data/standardAccounts';
import { FileText, Calendar, Database, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface CompanySetupWizardProps {
  userId: string;
  onCompleted: (companyId: string) => void;
  onCancel: () => void;
  hasCancel: boolean;
}

export default function CompanySetupWizard({ userId, onCompleted, onCancel, hasCancel }: CompanySetupWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [conversionMonth, setConversionMonth] = useState(1); // 1 = January
  const [coaTemplateId, setCoaTemplateId] = useState('perusahaan_jasa');

  const MONTHS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const handleNextStep = () => {
    if (step === 1 && !name.trim()) {
      setError('Nama perusahaan harus diisi');
      return;
    }
    setError(null);
    setStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setError(null);
    setStep((prev) => prev - 1);
  };

  const handleCreateCompany = async () => {
    setLoading(true);
    setError(null);
    try {
      const companyId = 'co_' + Math.random().toString(36).substring(2, 15);
      const companyData: MyobCompany = {
        id: companyId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        fiscalYear: Number(fiscalYear),
        conversionMonth,
        accountingPeriods: 12,
        createdAt: new Date().toISOString(),
        ownerId: userId,
      };

      // Get accounts to seed from template
      const selectedTemplate = COA_TEMPLATES.find((t) => t.id === coaTemplateId);
      const accountsList: MyobAccount[] = selectedTemplate ? selectedTemplate.accounts : [];

      // Use Firestore WriteBatch to write everything atomically
      const batch = writeBatch(db);

      // 1. Create Company Doc
      const companyDocRef = doc(db, 'users', userId, 'companies', companyId);
      batch.set(companyDocRef, companyData);

      // 2. Add Accounts List to subcollection
      accountsList.forEach((acc) => {
        const accDocRef = doc(db, 'users', userId, 'companies', companyId, 'accounts', acc.id);
        batch.set(accDocRef, acc);
      });

      await batch.commit();
      onCompleted(companyId);
    } catch (err: any) {
      console.error('Error creating company:', err);
      // Log the error in standard Firestore format
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}/companies`);
      } catch (logErr: any) {
        setError('Gagal membuat data perusahaan. Pastikan koneksi internet stabil & coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="company_setup_wizard" className="w-full max-w-2xl mx-auto bg-[#e5e5e0] border-2 border-stone-400 shadow-xl rounded overflow-hidden font-sans text-stone-800">
      {/* Title Bar styled like Classic Windows/MYOB */}
      <div className="bg-[#1e4682] text-white px-4 py-2 flex justify-between items-center text-sm font-semibold select-none border-b border-stone-500">
        <span className="flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-300" />
          Asisten Pembuatan Data Perusahaan Baru (MYOB New Company Assistant)
        </span>
        {hasCancel && (
          <button 
            id="close_wizard_btn"
            onClick={onCancel} 
            className="hover:bg-red-600 px-1 rounded text-white font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress Steps Header */}
      <div className="flex bg-[#f2f2ef] border-b border-stone-300 text-xs text-stone-500 px-4 py-3 justify-between items-center">
        <div className={`flex items-center gap-1 ${step === 1 ? 'text-[#1e4682] font-semibold' : ''}`}>
          <FileText className="w-4 h-4" /> <span>1. Biodata</span>
        </div>
        <div className="h-0.5 w-12 bg-stone-300"></div>
        <div className={`flex items-center gap-1 ${step === 2 ? 'text-[#1e4682] font-semibold' : ''}`}>
          <Calendar className="w-4 h-4" /> <span>2. Periode Akuntansi</span>
        </div>
        <div className="h-0.5 w-12 bg-stone-300"></div>
        <div className={`flex items-center gap-1 ${step === 3 ? 'text-[#1e4682] font-semibold' : ''}`}>
          <Database className="w-4 h-4" /> <span>3. Struktur Akun</span>
        </div>
        <div className="h-0.5 w-12 bg-stone-300"></div>
        <div className={`flex items-center gap-1 ${step === 4 ? 'text-[#1e4682] font-semibold' : ''}`}>
          <CheckCircle className="w-4 h-4" /> <span>4. Konfirmasi</span>
        </div>
      </div>

      {/* Wizard Content Canvas */}
      <div className="p-6 min-h-[300px]">
        {error && (
          <div id="wizard_error_msg" className="mb-4 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: GENERAL COMPANY INFORMATION */}
        {step === 1 && (
          <div id="wizard_step_1">
            <h3 className="text-lg font-bold text-[#1e4682] mb-3">Informasi Umum Perusahaan</h3>
            <p className="text-sm text-stone-600 mb-5">
              Silakan masukkan rincian data penting mengenai perusahaan Anda. Informasi ini akan tercantum pada kop surat laporan keuangan Anda.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Nama Perusahaan *</label>
                <input 
                  id="company_name_input"
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Contoh: PT. Sumber Makmur Sejahtera"
                  className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Alamat Perusahaan</label>
                <textarea 
                  id="company_address_input"
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  placeholder="Jl. Gajah Mada No. 12, Jakarta Barat"
                  rows={2}
                  className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Nomor Telepon</label>
                  <input 
                    id="company_phone_input"
                    type="tel" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="021-5551234"
                    className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Alamat Email</label>
                  <input 
                    id="company_email_input"
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="kontak@perusahaan.com"
                    className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ACCOUNTING PERIOD */}
        {step === 2 && (
          <div id="wizard_step_2">
            <h3 className="text-lg font-bold text-[#1e4682] mb-3">Tahun & Bulan Transaksi (Periode Buku)</h3>
            <p className="text-sm text-stone-600 mb-5">
              Tentukan tahun buku akuntansi yang ingin Anda catat. Sekali data perusahaan terbuat, periode keuangan ini tidak dapat diubah lagi secara bebas.
            </p>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Tahun Finansial (Financial Year)</label>
                <input 
                  id="fiscal_year_input"
                  type="number" 
                  value={fiscalYear} 
                  onChange={(e) => setFiscalYear(Number(e.target.value))} 
                  min={1990}
                  max={2100}
                  className="w-32 bg-white border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800"
                />
                <span className="text-xs text-stone-500 block mt-1">Tahun penutupan buku (biasanya tahun berjalan)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Bulan Konversi (Conversion Month)</label>
                <select 
                  id="conversion_month_select"
                  value={conversionMonth} 
                  onChange={(e) => setConversionMonth(Number(e.target.value))} 
                  className="w-full max-w-sm bg-white border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-stone-800"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <span className="text-xs text-stone-500 block mt-1">Bulan mulainya pencatatan saldo awal dan jurnal transaksi baru Anda</span>
              </div>

              <div className="bg-[#f0ece1] p-3 rounded border border-stone-300 text-xs space-y-1">
                <p className="font-semibold text-[#1e4682]">Ringkasan Periode Transaksi Anda:</p>
                <p>• Tahun Buku Akuntansi berakhir pada: <strong>Desember {fiscalYear}</strong></p>
                <p>• Transaksi pertama dicatat pada: <strong>{MONTHS.find(m => m.value === conversionMonth)?.label} {fiscalYear}</strong></p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ACCOUNT STRUCTURE DESIGN CHART OF ACCOUNTS */}
        {step === 3 && (
          <div id="wizard_step_3">
            <h3 className="text-lg font-bold text-[#1e4682] mb-3">Model Akuntansi (Daftar Akun)</h3>
            <p className="text-sm text-stone-600 mb-5">
              Pilih daftar akun yang paling mendekati model bisnis Anda. Ini akan menyiapkan kode rekening seperti Kas, Piutang, Perlengkapan, dan Modal secara otomatis.
            </p>

            <div className="space-y-3">
              {COA_TEMPLATES.map((tmpl) => (
                <label 
                  key={tmpl.id} 
                  id={`coa_label_${tmpl.id}`}
                  className={`flex items-start gap-3 p-4 border rounded cursor-pointer transition ${coaTemplateId === tmpl.id ? 'bg-[#d8e3f2] border-sky-600 font-medium' : 'bg-white border-stone-300 hover:bg-[#eaeae6]'}`}
                >
                  <input 
                    type="radio" 
                    name="coa_template_radio" 
                    value={tmpl.id} 
                    checked={coaTemplateId === tmpl.id} 
                    onChange={() => setCoaTemplateId(tmpl.id)} 
                    className="mt-1"
                  />
                  <div>
                    <span className="block text-sm font-bold text-stone-800 pointer-events-none">{tmpl.name}</span>
                    <span className="block text-xs text-stone-500 mt-1 pointer-events-none">{tmpl.description}</span>
                    <span className="inline-block bg-[#1e4682] text-white text-[10px] px-1.5 py-0.5 rounded font-mono mt-2 pointer-events-none">
                      {tmpl.accounts.length} Akun Standar Terpasang
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: FINAL CONFIRMATION */}
        {step === 4 && (
          <div id="wizard_step_4">
            <h3 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Siap untuk Membuat File Perusahaan!
            </h3>
            <p className="text-sm text-stone-600 mb-5">
              Semua info telah dimasukkan dengan lengkap. Silakan tinjau kembali data di bawah ini sebelum membuat pangkalan data di cloud Firebase.
            </p>

            <div className="bg-white border border-stone-300 rounded divide-y divide-stone-150 p-4 text-sm space-y-3">
              <div>
                <span className="text-xs font-semibold text-stone-500 block uppercase">Nama Bisnis / Entitas</span>
                <span className="text-base font-bold text-[#1e4682]">{name}</span>
              </div>
              <div className="pt-2">
                <span className="text-xs font-semibold text-stone-500 block uppercase">Alamat & Kontak</span>
                <span className="text-stone-700 font-medium">{address || '-'}</span>
                <span className="block text-xs text-stone-500">{phone ? `Telp: ${phone}` : ''} {email ? `| Email: ${email}` : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-xs font-semibold text-stone-500 block uppercase">Tahun Buku</span>
                  <span className="font-bold text-stone-700">{fiscalYear}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-stone-500 block uppercase">Awal Pencatatan (Conversion)</span>
                  <span className="font-bold text-stone-700">{MONTHS.find(m => m.value === conversionMonth)?.label}</span>
                </div>
              </div>
              <div className="pt-2">
                <span className="text-xs font-semibold text-stone-500 block uppercase">Pilihan Struktur Akun</span>
                <span className="font-semibold text-sky-700">{COA_TEMPLATES.find(t => t.id === coaTemplateId)?.name}</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-[#e8f5e9] border border-green-200 text-xs text-green-800 rounded">
              Pemberitahuan: Sistem akan menyinkronkan data langsung ke database cloud Firestore secara dinamis agar Anda bisa mengakses ledger akuntansi dari mana saja tanpa takut hilang secara gratis.
            </div>
          </div>
        )}
      </div>

      {/* Button Panel: Classic Windows dialog buttons */}
      <div className="bg-[#f0f0eb] border-t border-stone-300 p-4 flex justify-between items-center">
        <div>
          {hasCancel && step === 1 && (
            <button 
              id="wizard_cancel_btn"
              type="button" 
              onClick={onCancel} 
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold text-sm px-4 py-2 border border-stone-400 rounded cursor-pointer shadow-sm active:translate-y-0.5"
            >
              Batal
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {step > 1 && (
            <button 
              id="wizard_back_btn"
              type="button" 
              onClick={handlePrevStep} 
              disabled={loading}
              className="bg-stone-200 hover:bg-stone-300 disabled:opacity-50 text-stone-700 font-semibold text-sm px-4 py-2 border border-stone-400 rounded flex items-center gap-1 cursor-pointer shadow-sm active:translate-y-0.5"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
          )}

          {step < 4 ? (
            <button 
              id="wizard_next_btn"
              type="button" 
              onClick={handleNextStep} 
              className="bg-[#1e4682] hover:bg-[#1a3d72] text-white font-semibold text-sm px-5 py-2 border border-[#143460] rounded flex items-center gap-1 cursor-pointer shadow-md active:translate-y-0.5"
            >
              Lanjut <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button 
              id="wizard_finish_btn"
              type="button" 
              onClick={handleCreateCompany} 
              disabled={loading}
              className="bg-green-700 hover:bg-green-800 disabled:bg-green-500 text-white font-bold text-sm px-6 py-2 border border-green-800 rounded cursor-pointer shadow-md active:translate-y-0.5 flex items-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Memproses...
                </span>
              ) : 'Selesai & Buat Ledger'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
