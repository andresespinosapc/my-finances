import type { Page } from 'playwright';
import playwright, { chromium } from 'playwright';
import fs from 'fs';
import { zu } from 'zod_utilz';
import { z } from 'zod';
import { prisma } from '~/server/db';
import type { MoneyAccount, Transaction } from '@prisma/client';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as F from 'fp-ts/function';
import { EXTERNAL_ACCOUNT_NAME } from '~/constants';
import dayjs from 'dayjs';

const COOKIES_FILENAME = 'cookies.json';
const LOGIN_PAGE_URL = 'https://banco.santander.cl/personas';
const INDEX_PAGE_URL = 'https://www.santander.cl/transa/segmentos/Menu/view.asp';

const CookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  url: z.string().optional(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
});

export class SyncSantander {
  async perform(options: {
    rut: string;
    password: string;
  }) {
    await this.syncAccountLastMovements(undefined);
    // const browser = await chromium.launch({ headless: false });
    // const context = await browser.newContext();
    // const page = await context.newPage();
    
    // await this.login(page, options);
    // await this.syncAccountLastMovements(page);

    // await page.waitForTimeout(5000);

    // await browser.close();
  }

  async loadSession(page: Page) {
    if (!fs.existsSync(COOKIES_FILENAME)) return { success: false };

    const cookiesFile = fs.readFileSync(COOKIES_FILENAME);
    const cookies = zu.stringToJSON().pipe(z.array(CookieSchema)).parse(cookiesFile.toString());
    await page.context().addCookies(cookies);
    await page.goto(INDEX_PAGE_URL)
    try {
      await page.waitForURL(LOGIN_PAGE_URL, { timeout: 3000 });

      return { success: false };
    } catch (e) {
      if (e instanceof playwright.errors.TimeoutError) {
        return { success: true };
      }

      throw e;
    }
  }

  async login(page: Page, options: {
    rut: string;
    password: string;
  }) {
    const { success } = await this.loadSession(page);
    console.log('success', success)
    if (success) return;

    await page.goto(LOGIN_PAGE_URL);
    const loginButton = await page.waitForSelector('#btnIngresar');

    await loginButton.click();
    await loginButton.dispose();

    const loginFormSelector = 'form[name="autent"]';

    const rutInput = await page.waitForSelector(loginFormSelector + ' .input.rut');
    await rutInput.type(options.rut);

    const passwordInput = await page.waitForSelector(loginFormSelector + ' .input.pin');
    await passwordInput.type(options.password);

    const submitButton = await page.waitForSelector(loginFormSelector + ' button[type="submit"]');
    await submitButton.click();

    await page.waitForURL(INDEX_PAGE_URL);

    const cookies = await page.context().cookies();
    fs.writeFileSync(COOKIES_FILENAME, JSON.stringify(cookies));
  }

  async syncAccountLastMovements(page: Page) {
    // const frame2Locator = page.frameLocator('frame[name="frame2"]');
    // await frame2Locator.getByRole('link', { name: 'Últimos Movimientos' }).click();
    // await frame2Locator.getByRole('link', { name: 'Cuenta Vista' }).click();
    // const frameP4Locator = frame2Locator.frameLocator('iframe[name="p4"]');
    // await frameP4Locator.getByLabel('Cuenta Vista 0-070-02-92778-5').check();
    // await frameP4Locator.getByRole('button', { name: 'Aceptar' }).click();

    // await page.waitForTimeout(5000);
    // const tables = await frameP4Locator.locator('form[name="FRMULMOVCM"] table').all();
    // if (tables[2] === undefined) throw new Error('Third table not found');

    // const rows = await tables[2].locator('tr').all();
    // if (rows[0] === undefined) throw new Error('No rows found');

    // const headers = (await rows[0].locator('td').allTextContents()).map(
    //   header => header.trim().replace(/[\s,\t,\n]+/g, ' ')
    // );
    // const rowsData = await Promise.all(
    //   rows.slice(1, rows.length - 1).map(async row => {
    //     const columns = await row.locator('td').allTextContents();

    //     return columns.map(column => column.trim());
    //   })
    // );

    // const movements = rowsData.map((row) => {
    //   return row.reduce((acc, value, index) => {
    //     const header = headers[index];
    //     if (header === undefined) throw new Error('No header found');

    //     acc[header] = value;
    //     return acc;
    //   }, {} as Record<string, string>);
    // });

    // // save movements to a json file
    // fs.writeFileSync('movements.json', JSON.stringify(movements));

    // read movements from a json file
    const santanderTransactions = JSON.parse(fs.readFileSync('movements.json').toString());

    const SantanderTransactionSchema = z.object({
      'Fecha': z.string(),
      'Cargo ($)': z.string(),
      'Abono ($)': z.string(),
      'Descripción': z.string(),
    });
    const SantanderTransactionsSchema = z.array(SantanderTransactionSchema);

    const validatedSantanderTransactions = SantanderTransactionsSchema.parse(santanderTransactions);

    const accountName = 'Cuenta Vista 0-070-02-92778-5';

    const externalMoneyAccount = await prisma.moneyAccount.findFirst({
      where: {
        name: EXTERNAL_ACCOUNT_NAME,
      },
    });
    if (externalMoneyAccount === null) throw new Error('External money account not found');

    const santanderMoneyAccount = await prisma.moneyAccount.upsert({
      where: {
        name: accountName,
      },
      update: {},
      create: {
        name: accountName,
      },
    });

    console.log('bla');
    const newTransactions = await this.checkAndFilterNewTransactions({
      moneyAccount: santanderMoneyAccount,
      transactionsToImport: validatedSantanderTransactions.map(santanderTransaction => {
        if (santanderTransaction['Cargo ($)'] === '' && santanderTransaction['Abono ($)'] === '') {
          throw new Error('No amount found');
        } else if (santanderTransaction['Cargo ($)'] !== '' && santanderTransaction['Abono ($)'] !== '') {
          throw new Error('Both amount found');
        }

        if (santanderTransaction['Cargo ($)'] !== '') {
          return {
            date: dayjs(santanderTransaction.Fecha, 'DD/MM/YYYY').toDate(),
            payerAccountId: santanderMoneyAccount.id,
            payeeAccountId: externalMoneyAccount.id,
            amount: -parseFloat(santanderTransaction['Cargo ($)'].replace(/\./g, '')),
            originalDescription: santanderTransaction['Descripción'],
          };
        } else {
          return {
            date: dayjs(santanderTransaction.Fecha, 'DD/MM/YYYY').toDate(),
            payerAccountId: externalMoneyAccount.id,
            payeeAccountId: santanderMoneyAccount.id,
            amount: parseFloat(santanderTransaction['Abono ($)'].replace(/\./g, '')),
            originalDescription: santanderTransaction['Descripción'],
          };
        }
      })
    });

    await prisma.transaction.createMany({
      data: newTransactions.map(transaction => ({
        ...transaction,
        description: transaction.originalDescription,
        accountableDate: transaction.date,
      })),
    });
  }

  async checkAndFilterNewTransactions(options: {
    moneyAccount: MoneyAccount;
    transactionsToImport: Pick<Transaction, 'date' | 'payerAccountId' | 'payeeAccountId' | 'amount' | 'originalDescription'>[];
  }) {
    console.log('checkAndFilterNewTransactions');
    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          {
            payerAccountId: options.moneyAccount.id,
          },
          {
            payeeAccountId: options.moneyAccount.id,
          }
        ],
      },
      orderBy: {
        date: 'desc',
      },
    });
    if (lastTransaction === null) return options.transactionsToImport;

    const lastTransactionDate = lastTransaction.date;

    const groupedTransactionsToImport = F.pipe(
      options.transactionsToImport,
      NEA.groupBy(transaction => transaction.date.toLocaleDateString()),
    )
  }
}
