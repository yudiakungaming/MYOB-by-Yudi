/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { auth, db, logInWithGoogle, logOut, handleFirestoreError, OperationType } from './firebase';
import { MyobCompany, MyobAccount, MyobJournal, MyobCard } from './types';

// Import Custom Modular Components
import CompanySetupWizard from './components/CompanySetupWizard';
import CommandCentre from './components/CommandCentre';
import AccountsListModal from './components/AccountsListModal';
import RecordJournalModal from './components/RecordJournalModal';
import SpendReceiveModal from './components/SpendReceiveModal';
import TransactionJournalModal from './components/TransactionJournalModal';
import CardListModal from './components/CardListModal';
import ReportsModal from './components/ReportsModal';
import BankReconciliationModal from './components/BankReconciliationModal';

import { 
  Building2, 
  LogOut, 
  User as UserIcon, 
  FolderOpen, 
  PlusCircle, 
  HelpCircle, 
  ShieldCheck, 
  Network,
  Cloud 
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Companies listing states
  const [companies, setCompanies] = useState<MyobCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Active loaded company subcollection data states
  const [accounts, setAccounts] = useState<MyobAccount[]>([]);
  const [journals, setJournals] = useState<MyobJournal[]>([]);
  const [cards, setCards] = useState<MyobCard[]>([]);

  // Subcollection load synchronizers
  const [dataLoading, setDataLoading] = useState(false);

  // Modal display controllers
  const [isAccountsListOpen, setIsAccountsListOpen] = useState(false);
  const [isRecordJournalOpen, setIsRecordJournalOpen] = useState(false);
  const [isSpendReceiveOpen, setIsSpendReceiveOpen] = useState(false);
  const [spendReceiveDefaultMode, setSpendReceiveDefaultMode] = useState<'Spend' | 'Receive'>('Spend');
  const [isTransactionJournalOpen, setIsTransactionJournalOpen] = useState(false);
  const [isCardListOpen, setIsCardListOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isBankReconciliationOpen, setIsBankReconciliationOpen] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);

  // Observe Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      setAuthLoading(false);
      setAuthError(null);
      if (!loggedUser) {
        // Clear variables on logout
        setCompanies([]);
        setActiveCompanyId(null);
        setAccounts([]);
        setJournals([]);
        setCards([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync user's companies from Firestore
  useEffect(() => {
    if (!user) return;

    setCompaniesLoading(true);
    const companiesPath = `users/${user.uid}/companies`;
    const q = query(collection(db, 'users', user.uid, 'companies'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: MyobCompany[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as MyobCompany);
        });
        setCompanies(list);
        setCompaniesLoading(false);

        // Auto select first company if none is active
        if (list.length > 0 && !activeCompanyId) {
          setActiveCompanyId(list[0].id);
        } else if (list.length === 0) {
          setActiveCompanyId(null);
          setShowSetupWizard(true);
        }
      },
      (error) => {
        setCompaniesLoading(false);
        console.error('Error fetching companies list:', error);
        handleFirestoreError(error, OperationType.GET, companiesPath);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Sync accounting databases (accounts, journals, cards) for selected active company file
  useEffect(() => {
    if (!user || !activeCompanyId) {
      setAccounts([]);
      setJournals([]);
      setCards([]);
      return;
    }

    setDataLoading(true);

    const accountsPath = `users/${user.uid}/companies/${activeCompanyId}/accounts`;
    const journalsPath = `users/${user.uid}/companies/${activeCompanyId}/journals`;
    const cardsPath = `users/${user.uid}/companies/${activeCompanyId}/cards`;

    // 1. Snapshot Accounts (Chart of Accounts)
    const unsubAccounts = onSnapshot(
      collection(db, 'users', user.uid, 'companies', activeCompanyId, 'accounts'),
      (snapshot) => {
        const list: MyobAccount[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as MyobAccount);
        });
        setAccounts(list);
      },
      (err) => {
        console.error('Error snapshot accounts:', err);
        handleFirestoreError(err, OperationType.GET, accountsPath);
      }
    );

    // 2. Snapshot Journals (General books)
    const unsubJournals = onSnapshot(
      collection(db, 'users', user.uid, 'companies', activeCompanyId, 'journals'),
      (snapshot) => {
        const list: MyobJournal[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as MyobJournal);
        });
        setJournals(list);
      },
      (err) => {
        console.error('Error snapshot journals:', err);
        handleFirestoreError(err, OperationType.GET, journalsPath);
      }
    );

    // 3. Snapshot Cards (Contacts registers)
    const unsubCards = onSnapshot(
      collection(db, 'users', user.uid, 'companies', activeCompanyId, 'cards'),
      (snapshot) => {
        const list: MyobCard[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as MyobCard);
        });
        setCards(list);
        setDataLoading(false);
      },
      (err) => {
        console.error('Error snapshot cards:', err);
        handleFirestoreError(err, OperationType.GET, cardsPath);
      }
    );

    return () => {
      unsubAccounts();
      unsubJournals();
      unsubCards();
    };
  }, [user, activeCompanyId]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await logInWithGoogle();
    } catch (err: any) {
      setAuthError('Gagal melakukan login popup dengan Google Auth. Pastikan Anda memperbolehkan pop-up jendela browser ini.');
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const currentCompany = companies.find(c => c.id === activeCompanyId);

  // Deduce last journal reference to increment
  const getLastReferenceNumber = () => {
    if (journals.length === 0) return undefined;
    const generalJourvals = journals.filter(j => j.source === 'General Journal');
    if (generalJourvals.length === 0) return undefined;
    const sorted = [...generalJourvals].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    return sorted[0].referenceNum;
  };

  // 1. LANDING PAGE FOR NON-AUTHENTICATED VISITORS
  if (authLoading) {
    return (
      <div id="app_loader" className="h-screen w-screen bg-[#d8d8d3] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-[#1e4682] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-bold text-stone-600 mt-4 tracking-wider uppercase font-mono">Inisialisasi MYOB Workspace Cloud...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div id="app_landing_page" className="min-h-screen bg-stone-100 flex flex-col justify-between font-sans leading-relaxed text-stone-800 selection:bg-sky-200">
        
        {/* Simple retro menu header */}
        <header className="bg-[#1e4682] text-white px-6 py-4 flex justify-between items-center shadow-md select-none">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-sky-300" />
            <h1 className="text-base font-bold tracking-wider font-mono">MYOB Accounting Cycle Cloud</h1>
          </div>
          <span className="text-xs font-bold font-mono bg-sky-950 px-3 py-1 rounded text-sky-200">Indonesian Version</span>
        </header>

        {/* Content Showcase */}
        <main className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center space-y-8 select-none">
          
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-stone-900 font-serif leading-none">
              Solusi Siklus Akuntansi <span className="text-[#1e4682] underline decoration-yellow-400">Gratis & Seimbang</span>
            </h2>
            <p className="text-stone-600 text-sm md:text-base leading-relaxed font-sans">
              Selamat datang di replika cloud berbasis web yang 100% didasarkan pada antarmuka diagram alur kerja **MYOB Premier / Accounting**. Catat jurnal transaksi, kelola daftar perkiraan (COA), audit buku kas, dan cetak Laporan Laba Rugi serta Neraca dengan mudah dan gratis.
            </p>
          </div>

          {/* Core Feature Bento Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left pt-4">
            <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-sm space-y-2">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-[#1e4682]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-stone-900 text-sm">Persamaan Akuntansi</h4>
              <p className="text-stone-500 text-xs">Pencatatan double-entry ledger otomatis dengan sistem out-of-balance guard yang memastikan posisi debit-kredit seimbang sebelum disimpan.</p>
            </div>

            <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-sm space-y-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                <Cloud className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-stone-900 text-sm">Penyimpanan di Cloud</h4>
              <p className="text-stone-500 text-xs">Semua file perusahaan tersimpan dengan aman pada database Firebase Firestore, bebas akses di mana saja, tanpa data hilang atau corrupt.</p>
            </div>

            <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-sm space-y-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
                <Network className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-stone-900 text-sm">100% Visual MYOB</h4>
              <p className="text-stone-500 text-xs">Bekerja persis seperti MYOB Command Centre yang sesungguhnya. Navigasi berbasis flowchart Accounts, Banking, dan Card File.</p>
            </div>
          </div>

          {authError && (
            <div id="landing_error_msg" className="bg-red-50 border border-red-300 text-red-700 rounded px-4 py-2 text-xs text-left max-w-md shadow-xs">
              {authError}
            </div>
          )}

          {/* Social login action buttons */}
          <div className="pt-4 flex flex-col items-center">
            <button 
              id="google_login_btn"
              onClick={handleLogin}
              className="bg-[#1e4682] hover:bg-[#1a3d72] text-white font-bold px-8 py-3 rounded-md text-sm border border-sky-800 flex items-center gap-2.5 cursor-pointer shadow-md transform hover:scale-102 transition duration-200 active:translate-y-0.5"
            >
              <Building2 className="w-5 h-5" /> Masuk ke Aplikasi (Google Sign-In)
            </button>
            <span className="text-[10px] text-stone-400 font-mono mt-3 uppercase tracking-wider block">Bebas Akses Tanpa Biaya • Sesuai Standar Akuntansi Indonesia</span>
          </div>

        </main>

        <footer className="bg-stone-200 border-t border-stone-300 text-center py-4 text-[10px] text-stone-500 font-mono select-none">
          Siklus Akuntansi Cloud v18.2. Diaktifkan oleh Firebase Auth & Firestore DB
        </footer>

      </div>
    );
  }

  // 2. ACTIVE APPLICATION WORKSTATION FOR AUTHENTICATED USERS
  return (
    <div id="app_workspace" className="min-h-screen bg-stone-100 flex flex-col justify-between font-sans leading-relaxed text-stone-800">
      
      {/* Top Windows-like Taskbar */}
      <header className="bg-[#1e4682] text-white px-4 py-3 flex flex-wrap justify-between items-center shadow-lg gap-3 select-none">
        
        {/* Left Side: Loaded company status dropdown info */}
        <div className="flex items-center gap-3">
          <Building2 className="w-5.5 h-5.5 text-sky-300" />
          
          {companiesLoading ? (
            <span className="text-xs font-bold text-sky-200 animate-pulse">Menghubungkan Database...</span>
          ) : companies.length > 0 && currentCompany ? (
            <div className="flex items-center gap-2.5">
              <select
                id="workspace_company_selector"
                value={activeCompanyId || ''}
                onChange={(e) => setActiveCompanyId(e.target.value)}
                className="bg-sky-950 border border-sky-600 rounded text-sky-100 font-bold px-2 py-1 text-xs focus:outline-none"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span className="text-[10px] font-mono text-sky-200 bg-sky-900 px-2 py-0.5 rounded">
                Conversion: {currentCompany.conversionMonth}/{currentCompany.fiscalYear}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-yellow-300">Harap buat data perusahaan baru untuk mulai</span>
          )}

          {/* Quick trigger setup wizard info button */}
          {!showSetupWizard && (
            <button
              id="new_firm_trigger_btn"
              onClick={() => setShowSetupWizard(true)}
              className="bg-sky-900 hover:bg-sky-950 text-sky-100 font-bold border border-sky-700 rounded px-2 py-1 text-[10px] uppercase flex items-center gap-1 shadow-inner cursor-pointer"
              title="Buat file database perusahaan baru"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Entitas Baru
            </button>
          )}
        </div>

        {/* Right Side: Logged in profile status */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div id="user_profile_indicator" className="flex items-center gap-1.5 text-sky-300 bg-sky-950/40 px-3 py-1 rounded border border-sky-850 select-none">
            <UserIcon className="w-4 h-4" />
            <span className="font-mono text-sky-200 max-w-[150px] truncate">{user.email}</span>
          </div>
          <button 
            id="workspace_logout_btn"
            onClick={handleLogout}
            className="bg-red-700 hover:bg-red-800 text-white font-bold px-3 py-1.5 rounded flex items-center gap-1 border border-red-800 shadow-sm cursor-pointer active:translate-y-0.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>

      </header>

      {/* Primary Workspace Board */}
      <main className="flex-1 p-6 flex items-center justify-center min-h-[500px]">
        {showSetupWizard ? (
          <CompanySetupWizard 
            userId={user.uid}
            onCompleted={(id) => {
              setActiveCompanyId(id);
              setShowSetupWizard(false);
            }}
            onCancel={() => setShowSetupWizard(false)}
            hasCancel={companies.length > 0}
          />
        ) : activeCompanyId && currentCompany ? (
          <CommandCentre 
            onOpenAccountsList={() => setIsAccountsListOpen(true)}
            onOpenRecordJournal={() => setIsRecordJournalOpen(true)}
            onOpenSpendMoney={() => {
              setSpendReceiveDefaultMode('Spend');
              setIsSpendReceiveOpen(true);
            }}
            onOpenReceiveMoney={() => {
              setSpendReceiveDefaultMode('Receive');
              setIsSpendReceiveOpen(true);
            }}
            onOpenTransactionJournal={() => setIsTransactionJournalOpen(true)}
            onOpenCardList={() => setIsCardListOpen(true)}
            onOpenReports={() => setIsReportsOpen(true)}
            onOpenBankReconciliation={() => setIsBankReconciliationOpen(true)}
          />
        ) : (
          <div id="no_company_state" className="text-center bg-[#eaeae6] border-2 border-stone-400 p-8 rounded shadow-md max-w-sm">
            <Building2 className="w-12 h-12 text-[#1e4682] mx-auto mb-4" />
            <h4 className="font-bold text-stone-800 mb-2">Belum Ada File Perusahaan</h4>
            <p className="text-xs text-stone-500 mb-4">Buat file perusahaan akuntansi pertama Anda untuk memulai siklus pembukuan MYOB.</p>
            <button 
              id="no_company_wizard_btn"
              onClick={() => setShowSetupWizard(true)}
              className="bg-[#1e4682] text-white text-xs font-bold px-4 py-2 rounded border border-sky-850 shadow-md cursor-pointer"
            >
              Buat File Perusahaan Baru
            </button>
          </div>
        )}
      </main>

      {/* Sync indicator Status Dock */}
      <footer className="bg-stone-200 border-t border-stone-300 px-6 py-2.5 text-stone-500 font-bold flex justify-between items-center text-xs select-none">
        <div className="flex items-center gap-1.5 font-mono">
          <Cloud className="w-4 h-4 text-sky-700 shrink-0" />
          <span>Status Cloud: {dataLoading ? 'Singkronisasi...' : 'Tersinkronisasi'}</span>
        </div>
        <span className="text-[10px] text-stone-400 tracking-wide font-mono">
          Firebase DB ID: {activeCompanyId || 'NULL'}
        </span>
      </footer>

      {/* ========================================================= */}
      {/* ================= MODAL DIALOGS OVERLAYS ================= */}
      {/* ========================================================= */}

      {/* 1. Accounts List Modal */}
      {isAccountsListOpen && activeCompanyId && (
        <AccountsListModal 
          userId={user.uid}
          companyId={activeCompanyId}
          accounts={accounts}
          onClose={() => setIsAccountsListOpen(false)}
          onRefresh={() => {}} // snapshot triggers standard updates
        />
      )}

      {/* 2. Record Journal Modal */}
      {isRecordJournalOpen && activeCompanyId && (
        <RecordJournalModal 
          userId={user.uid}
          companyId={activeCompanyId}
          accounts={accounts}
          onClose={() => setIsRecordJournalOpen(false)}
          onRefresh={() => {}}
          lastReferenceNum={getLastReferenceNumber()}
        />
      )}

      {/* 3. Spend / Receive Money Banking Modal */}
      {isSpendReceiveOpen && activeCompanyId && (
        <SpendReceiveModal 
          userId={user.uid}
          companyId={activeCompanyId}
          accounts={accounts}
          cards={cards}
          onClose={() => setIsSpendReceiveOpen(false)}
          onRefresh={() => {}}
          defaultMode={spendReceiveDefaultMode}
        />
      )}

      {/* 4. Transaction Journal Auditor Modal */}
      {isTransactionJournalOpen && activeCompanyId && (
        <TransactionJournalModal 
          journals={journals}
          onClose={() => setIsTransactionJournalOpen(false)}
          onRefresh={() => {}}
        />
      )}

      {/* 5. Card List Modal */}
      {isCardListOpen && activeCompanyId && (
        <CardListModal 
          userId={user.uid}
          companyId={activeCompanyId}
          cards={cards}
          onClose={() => setIsCardListOpen(false)}
          onRefresh={() => {}}
        />
      )}

      {/* 6. Reports Modal */}
      {isReportsOpen && activeCompanyId && currentCompany && (
        <ReportsModal 
          companyName={currentCompany.name}
          fiscalYear={currentCompany.fiscalYear}
          accounts={accounts}
          journals={journals}
          onClose={() => setIsReportsOpen(false)}
        />
      )}

      {/* 7. Bank Reconciliation Modal */}
      {isBankReconciliationOpen && activeCompanyId && (
        <BankReconciliationModal 
          userId={user.uid}
          companyId={activeCompanyId}
          accounts={accounts}
          journals={journals}
          onClose={() => setIsBankReconciliationOpen(false)}
        />
      )}

    </div>
  );
}
