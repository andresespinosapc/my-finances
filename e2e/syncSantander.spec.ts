import { test } from '@playwright/test';

import { SyncSantander } from '~/server/api/commands/SyncSantander';

test('sync santander', async ({ page }) => {
  console.log('rut', process.env.SANTANDER_RUT);
  await new SyncSantander().perform({
    page,
    // rut: process.env.SANTANDER_RUT,
    // password: process.env.SANTANDER_PASSWORD,
  });
});
