import assert from "node:assert/strict";
import test from "node:test";
import { parseStatementText } from "../lib/parser";

test("Emirates NBD signed debit/credit column", () => {
  const result = parseStatementText(`
EMIRATES NBD ACCOUNTS ACCOUNT DETAILS
Account Statement Currency AED Opening Balance AED 576.00
Date Description Debit/Credit Account Balance
09 Nov 2019 UAE SWITCH WDL 721817412985 AED -100.00 AED 576.00
05 Nov 2019 TRANSFER From 1011447974501 DAWOOD KHAN AED 15,000.00 AED 15,780.00
02 Nov 2019 SALARY CREDIT Salary AED 9,000.00 AED 10,583.00
`);
  assert.equal(result.profile.bank, "Emirates NBD");
  assert.equal(result.profile.currency, "AED");
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[0].direction, "expense");
  assert.equal(result.transactions[0].amount, 100);
  assert.equal(result.transactions[1].direction, "income");
  assert.equal(result.transactions[1].amount, 15000);
});

test("Emirates Islamic credit then debit columns", () => {
  const result = parseStatementText(`
EMIRATES ISLAMIC Account Statement
From Date 08.09.2020 To Date 08.03.2021 Currency AED Opening Balance 48,483.58
STATEMENT DATE NARRATION CREDIT AMOUNT DEBIT AMOUNT BALANCE
07-03-2021 BANKNET TRANSFER TO - 3707350687701 0.00 800.00 77,167.29
04-03-2021 UAE SWITCH ATM WITHDRAWAL 0.00 200.00 78,642.64
01-03-2021 TRANSFER SALARY 10,000.00 0.00 78,842.64
`);
  assert.equal(result.profile.bank, "Emirates Islamic");
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[0].direction, "expense");
  assert.equal(result.transactions[0].amount, 800);
  assert.equal(result.transactions[2].direction, "income");
  assert.equal(result.transactions[2].amount, 10000);
});

test("ADCB IN and OUT columns infer omitted zero cells from running balance", () => {
  const result = parseStatementText(`
ADCB Abu Dhabi Commercial Bank Business Account Statement Currency GBP
Opening Balance GBP 500.00
Date Description Type IN (£) Out (£) Balance (£)
04 Aug 23 DUTC ALEXANDRU TRANCPORT FPO 50.00 450.00
08 Aug 23 DOREL SCHNTEE SALARY FPO 280.00 730.00
10 Aug 23 PC SIMPLY BUSINESS DD 63.39 666.61
`);
  assert.equal(result.profile.bank, "ADCB");
  assert.equal(result.profile.layout, "in-out-balance");
  assert.equal(result.transactions.length, 3);
  assert.deepEqual(result.transactions.map((row) => row.direction), ["expense", "income", "expense"]);
  assert.deepEqual(result.transactions.map((row) => row.amount), [50, 280, 63.39]);
});

test("QIB bilingual debit and credit statement", () => {
  const result = parseStatementText(`
QIB Qatar Islamic Bank Digitally Stamped Statement of Account
Currency Qatari Riyal (QAR) Opening Balance 5,000.00
Date Description Debit Credit Balance
03 Jul 2024 ATM Cash Withdrawal COMM BANK OF QATAR DOHA 5,000.00 0.00 0.00
30 Jul 2024 WPS Salary Payment Jul-2024 0.00 15,000.00 15,000.00
31 Jul 2024 ATM Cash Withdrawal SALWA BRANCH 2 DOHA 1,000.00 0.00 14,000.00
`);
  assert.equal(result.profile.bank, "Qatar Islamic Bank");
  assert.equal(result.profile.currency, "QAR");
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[0].category, "Cash Withdrawal");
  assert.equal(result.transactions[1].direction, "income");
});

test("QNB negative debit values and separate credit column", () => {
  const result = parseStatementText(`
QNB Qatar National Bank Bank Statement Currency QATARI RIYAL QAR
Opening Balance 25,681.23
Date Description Debit Credit Balance
11/11/2024 CHGS-COPY STATEMENT -60.00 0.00 25,621.23
11/11/2024 NAPS-PURCHASE POS HABIB QATAR INTERNATIONAL -5,020.00 0.00 20,601.23
13/11/2024 SALARY CREDIT 0.00 20,323.00 40,924.23
`);
  assert.equal(result.profile.bank, "QNB");
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[0].direction, "expense");
  assert.equal(result.transactions[1].amount, 5020);
  assert.equal(result.transactions[2].direction, "income");
});

test("ADCB signed amount account statement", () => {
  const result = parseStatementText(`
ADCB Abu Dhabi Commercial Bank PSC Account Statement
Statement From 01 Nov 2021 To 30 Nov 2021 Currency AED Opening Balance AED 18,240.00
Date Description Debit/Credit Account Balance
30-Nov-2021 UAE SWITCH FDI 721817412358 -AED 350.00 AED 32,080.00
28-Nov-2021 SERVICE CHGS-ATM CARD NO. AED 1,350.00 AED 32,430.00
03-Nov-2021 SALARY CREDIT Salary AED 6,000.00 AED 24,195.00
`);
  assert.equal(result.profile.bank, "ADCB");
  assert.equal(result.profile.layout, "signed-amount-balance");
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[0].direction, "expense");
  assert.equal(result.transactions[1].direction, "income");
});

test("summary balances and account identifiers never become transactions", () => {
  const result = parseStatementText(`
QNB Bank Statement QAR
Account Number 0055-263385-001 IBAN QA49QNBA000000000055263385001
Date Description Debit Credit Balance
11/11/2024 OPENING BALANCE 0.00 0.00 25,681.23
11/11/2024 POS-PURCHASE COFFEE SHOP -15.00 0.00 25,666.23
Total Debit -15.00 Total Credit 0.00 Closing Balance 25,666.23
`);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amount, 15);
});