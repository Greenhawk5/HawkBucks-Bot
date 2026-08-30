import fs from 'node:fs';
import { buildPdfDocument } from '../src/services/pdf.js';

function write(name, bytes) {
  fs.writeFileSync(name, Buffer.from(bytes));
  console.log('wrote', name, bytes.length);
}

const usage = buildPdfDocument({
  title: 'Usage Statistics',
  subtitle: 'Period: Last 12 Months   |   Generated: 2026-08-30 00:00:00 UTC (UTC)',
  blocks: [
    { type: 'cards', items: [
      { label: 'USERS', value: 12 },
      { label: 'GROUPS', value: 4 },
      { label: 'CHANNELS', value: 2 },
      { label: 'TOTAL', value: 18 },
    ] },
    { type: 'heading', text: 'USER ACTIVITY' },
    { type: 'table',
      columns: [{ label: 'Name', width: 3 }, { label: 'ID', width: 2 }, { label: 'Last Used', width: 2, align: 'right' }],
      rows: [
        ['Alice', '1001', '2026-08-29 10:00'],
        ['Bob Longname Example', '1002', '2026-08-28 09:00'],
        ['Carol', '1003', '2026-07-01 12:00']
      ]
    },
  ],
});
write('usage-diagnostic.pdf', usage);

const active = buildPdfDocument({
  title: 'Active Reminders',
  subtitle: 'Generated: 2026-08-30 00:00:00 UTC (UTC)',
  blocks: [
    { type: 'heading', text: 'USERS WITH REMINDER ON' },
    { type: 'table',
      columns: [{ label: 'Name', width: 3 }, { label: 'ID', width: 2 }],
      rows: [['Ж TestCase', '1'], ['Åse Bjørk', '2'], ['Bots', '-1002217455165']]},
  ],
});
write('active-reminders-diagnostic.pdf', active);

console.log('Done.');
