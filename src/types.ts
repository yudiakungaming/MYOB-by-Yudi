/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccountType = 
  | 'Asset' 
  | 'Liability' 
  | 'Equity' 
  | 'Revenue' 
  | 'Cost Of Sales' 
  | 'Expense' 
  | 'Other Income' 
  | 'Other Expense';

export type AccountClassification = 'Header' | 'Detail';

export interface MyobUser {
  uid: string;
  email: string;
  displayName?: string | null;
  createdAt: string;
}

export interface MyobCompany {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  fiscalYear: number;
  conversionMonth: number; // 1-12 (e.g. 1 = January, 7 = July)
  accountingPeriods: number; // usually 12 or 13
  createdAt: string;
  ownerId: string;
}

export interface MyobAccount {
  id: string; // Account Code (e.g., "1-1100")
  name: string;
  type: AccountType;
  classification: AccountClassification; // Header (visual category / not postable) or Detail (postable)
  parentCode?: string; // nested level (e.g. general "1-0000" can be parent)
  openingBalance: number;
  balanceType: 'Debit' | 'Credit';
}

export interface JournalLine {
  accountId: string; // Account Code
  accountName: string;
  debit: number;
  credit: number;
}

export type JournalSource = 
  | 'General Journal' 
  | 'Spend Money' 
  | 'Receive Money' 
  | 'Sales Payment' 
  | 'Purchase Payment';

export interface MyobJournal {
  id: string;
  referenceNum: string; // e.g., GJ0001
  date: string; // YYYY-MM-DD
  explanation: string; // Memo
  source: JournalSource;
  lines: JournalLine[];
  totalAmount: number; // sum of debits
  createdAt: string;
}

export type CardType = 'Customer' | 'Supplier' | 'Employee';

export interface MyobCard {
  id: string;
  type: CardType;
  name: string;
  cardIdCode: string; // e.g. CUST-0001
  email?: string;
  phone?: string;
  address?: string;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  classification: AccountClassification;
  openingBalance: number;
  debitChange: number;
  creditChange: number;
  currentBalance: number;
  balanceType: 'Debit' | 'Credit';
}
