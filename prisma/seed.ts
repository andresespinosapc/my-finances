import { EXTERNAL_ACCOUNT_NAME } from './../src/constants';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.moneyAccount.upsert({
    where: {
      name: EXTERNAL_ACCOUNT_NAME,
    },
    update: {},
    create: {
      name: EXTERNAL_ACCOUNT_NAME,
    }
  });
}

main().then(async () => {
  await prisma.$disconnect();
}).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
