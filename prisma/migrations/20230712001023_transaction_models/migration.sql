/*
  Warnings:

  - A unique constraint covering the columns `[previousMonthTransactionId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `originalDescription` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payeeAccountId` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payerAccountId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "accountableDate" TIMESTAMP(3),
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "monthly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalDescription" TEXT NOT NULL,
ADD COLUMN     "payeeAccountId" TEXT NOT NULL,
ADD COLUMN     "payerAccountId" TEXT NOT NULL,
ADD COLUMN     "previousMonthTransactionId" TEXT,
ALTER COLUMN "description" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCategoryId" TEXT,

    CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "debtTransactionId" TEXT NOT NULL,
    "settlementTransactionId" TEXT,
    "debtor" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'CLP',

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_previousMonthTransactionId_key" ON "Transaction"("previousMonthTransactionId");

-- AddForeignKey
ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "TransactionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payerAccountId_fkey" FOREIGN KEY ("payerAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payeeAccountId_fkey" FOREIGN KEY ("payeeAccountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TransactionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_previousMonthTransactionId_fkey" FOREIGN KEY ("previousMonthTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
