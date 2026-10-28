/**
 * Validate the risk model backtest dataset sizes and late rates.
 * Usage: npx tsx scripts/validate-backtest-data.ts
 */
import { executeQuery } from '@/lib/db';

const TRAIN_START = '2026-01-01';
const TRAIN_END   = '2026-06-30';
const TEST_START  = '2026-07-01';
const TEST_END    = '2026-09-09';
const LATE_DAYS   = 13;

async function countPOs(startDate: string, endDate: string, label: string) {
  const rows = await executeQuery<{
    TOTAL_PO: number;
    LATE_PO: number;
    ON_TIME_PO: number;
    LATE_RATE: number;
  }>(`
    SELECT
      COUNT(*)                                                              AS TOTAL_PO,
      COUNT(CASE WHEN days_from_release > ${LATE_DAYS} THEN 1 END)        AS LATE_PO,
      COUNT(CASE WHEN days_from_release <= ${LATE_DAYS} THEN 1 END)       AS ON_TIME_PO,
      ROUND(COUNT(CASE WHEN days_from_release > ${LATE_DAYS} THEN 1 END)
            / COUNT(*) * 100, 1)                                           AS LATE_RATE
    FROM (
      SELECT
        PROCESS_ORDER_FG,
        DATEDIFF('day',
          MAX(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END),
          MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END)
        ) AS days_from_release
      FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
      GROUP BY PROCESS_ORDER_FG
      HAVING
        MAX(CASE WHEN ACTIVITY = 'PO' THEN ACTIVITY_STOP END)
          BETWEEN '${startDate}' AND '${endDate}'
        AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP END) IS NOT NULL
    ) po
  `);

  const r = rows[0];
  console.log(`\n── ${label} (${startDate} → ${endDate}) ──`);
  console.log(`  Total POs  : ${r.TOTAL_PO.toLocaleString()}`);
  console.log(`  Late (>${LATE_DAYS}d): ${r.LATE_PO.toLocaleString()} (${r.LATE_RATE}%)`);
  console.log(`  On-time    : ${r.ON_TIME_PO.toLocaleString()}`);
}

async function main() {
  console.log('Validating backtest dataset against Snowflake…\n');
  console.log('Slide claims:');
  console.log('  Training: 12,601 POs  Jan–Jun 2026');
  console.log('  Test    :  5,228 POs  1 Jul – 9 Sep 2026');

  await countPOs(TRAIN_START, TRAIN_END, 'TRAINING SET (Jan–Jun 2026)');
  await countPOs(TEST_START,  TEST_END,  'TEST SET (1 Jul – 9 Sep 2026)');

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
