# Query Reference — Control Tower Manufacturing
Source: `lib/queries.ts` · Snowflake schema: `MIGRATION.CONTROL_TOWER` + `DATAMART.MANUFACTURE`

Kalau ada angka yang salah atau mau test di Snowflake langsung, copy query di sini,
ganti `{period_filter}` dan `{plant_filter}` dengan kondisi yang sesuai (lihat bagian Filter).

---

## FILTER

### Period filter
Fungsi `periodDateWhere(kolom, period)` — dipakai di semua query di bawah.

| Period dipilih | SQL yang dihasilkan |
|---|---|
| `YTD`        | `{col}::DATE BETWEEN DATE_TRUNC('year', CURRENT_DATE()) AND CURRENT_DATE()` |
| `30D`        | `{col}::DATE BETWEEN DATEADD('day', -30, CURRENT_DATE()) AND CURRENT_DATE()` |
| `90D`        | `{col}::DATE BETWEEN DATEADD('day', -90, CURRENT_DATE()) AND CURRENT_DATE()` |
| `6M`         | `{col}::DATE BETWEEN DATEADD('month', -6, CURRENT_DATE()) AND CURRENT_DATE()` |
| `Today`      | `{col}::DATE = CURRENT_DATE()` |
| `This Month` | `DATE_TRUNC('month', {col}::DATE) = DATE_TRUNC('month', CURRENT_DATE())` |
| `Last Month` | `DATE_TRUNC('month', {col}::DATE) = DATE_TRUNC('month', DATEADD('month',-1, CURRENT_DATE()))` |
| `This Week`  | Week dari `{col}` sama dengan week dari `CURRENT_DATE()` (pakai `DAYOFWEEKISO`) |
| `Last Week`  | Week dari `{col}` sama dengan week dari `DATEADD('week',-1, CURRENT_DATE())` |
| Custom dates | `{col}::DATE BETWEEN ?::DATE AND ?::DATE` ← dari date picker, pakai bind parameter |

### Plant filter
- **All Plant** → tidak ada filter tambahan, semua pabrik masuk
- **Pabrik tertentu** → `AND PLANT = 'nama_pabrik'`
- ⚠️ Tabel `DATAMART_PRODUCTION_OUTPUT_OLAH` tidak punya kolom PLANT — filter plant tidak diapply di sana

---

## 1. LEAD TIME
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME`
**Kolom tanggal:** `PO_FG_DONE_DATE`

### 1a. Gross Lead Time (hari)
Durasi total dari activity `PO` mulai sampai activity `RECEIVE NDC` selesai, per Process Order FG.

```sql
SELECT AVG(gross_minutes) / 1440.0 AS avg_gross_days
FROM (
  SELECT
    PROCESS_ORDER_FG,
    DATEDIFF('minute',
      MIN(CASE WHEN ACTIVITY = 'PO'          THEN ACTIVITY_START END),
      MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP  END)
    ) AS gross_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()  -- ganti sesuai period
    -- AND PLANT = 'xxx'                                                 -- aktifkan kalau filter plant
  GROUP BY PROCESS_ORDER_FG
  HAVING
    MIN(CASE WHEN ACTIVITY = 'PO'          THEN ACTIVITY_START END) IS NOT NULL
    AND MAX(CASE WHEN ACTIVITY = 'RECEIVE NDC' THEN ACTIVITY_STOP  END) IS NOT NULL
) sub
```

### 1b. Nett Lead Time (hari)
Hanya waktu kerja aktual — baris `ACTIVITY_TYPE = 'ACTUAL'` dan `LINE_CATEGORY IS NOT NULL`.

```sql
SELECT AVG(nett_minutes) / 1440.0 AS avg_nett_days
FROM (
  SELECT
    PROCESS_ORDER_FG,
    SUM(NET_LEADTIME) AS nett_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
    AND ACTIVITY_TYPE = 'ACTUAL'
    AND LINE_CATEGORY IS NOT NULL
    -- AND PLANT = 'xxx'
  GROUP BY PROCESS_ORDER_FG
) sub
```

### 1c. Lead Time by Position (breakdown chart)
Breakdown durasi per posisi produksi, top 10 terlama.

```sql
-- NETT per posisi (jam)
SELECT POSITION, AVG(pos_minutes) / 60.0 AS avg_hours
FROM (
  SELECT PROCESS_ORDER_FG, POSITION, SUM(NET_LEADTIME) AS pos_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
    AND ACTIVITY_TYPE = 'ACTUAL'
    -- AND PLANT = 'xxx'
  GROUP BY PROCESS_ORDER_FG, POSITION
) sub
GROUP BY POSITION
ORDER BY avg_hours DESC
LIMIT 10;

-- GROSS per posisi (jam)
SELECT POSITION, AVG(pos_minutes) / 60.0 AS avg_hours
FROM (
  SELECT PROCESS_ORDER_FG, POSITION,
    DATEDIFF('minute', MIN(ACTIVITY_START), MAX(ACTIVITY_STOP)) AS pos_minutes
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
  WHERE PO_FG_DONE_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
    -- AND PLANT = 'xxx'
  GROUP BY PROCESS_ORDER_FG, POSITION
) sub
GROUP BY POSITION
ORDER BY avg_hours DESC
LIMIT 10
```

---

## 2. RIGHT FIRST TIME (RFT)
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME`
**Kolom tanggal:** `PO_FG_DONE_DATE`

Persentase aktivitas yang langsung benar tanpa rework. `ACTIVITY = 'ADJUST'` = ada koreksi.
Formula Tableau: `SUM(IF ACTIVITY ≠ "ADJUST" THEN 1 ELSE 0) / COUNT(ACTIVITY)`

```sql
SELECT
  COUNT(CASE WHEN ACTIVITY <> 'ADJUST' THEN 1 END) * 100.0
    / NULLIF(COUNT(ACTIVITY), 0) AS rft_pct
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_LEADTIME
WHERE PO_FG_DONE_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
  -- AND PLANT = 'xxx'
```

---

## 3. YIELD / LOSS

### 3a. Pack Loss % (pengemasan)
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS`
**Kolom tanggal:** `KEMAS_COMPLETED_AT`

`QTY_FG_RETUR` = qty reject/dikembalikan. `QTY_TOTAL` = total yang dikemas.

```sql
-- Query ngambil komponen, kalkulasi dilakukan di aplikasi
SELECT
  SUM(QTY_FG_GOOD)  AS total_good,
  SUM(QTY_FG_RETUR) AS total_retur,
  SUM(QTY_TOTAL)    AS total_qty
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
  -- AND PLANT = 'xxx'

-- pack_loss_pct = total_retur / total_qty * 100
```

### 3b. Bulk Loss % & Bulk Loss Kg (pengolahan)
**Tabel:** `DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH`
**Kolom tanggal:** `CORRECTION_DATE`
⚠️ Filter plant TIDAK diapply — tabel ini tidak punya kolom PLANT.

```sql
SELECT
  SUM(REALIZATION_QUANTITY) AS total_realization,
  SUM(THEORETICAL_QUANTITY) AS total_theoretical
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()

-- bulk_loss_pct = ABS((theoretical - realization) / theoretical) * 100
-- bulk_loss_kg  = theoretical - realization  (hanya kalau theoretical > realization)
```

---

## 4. OUTPUT

### 4a. Bulk Output (kg)
**Tabel:** `DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH`
**Kolom tanggal:** `CORRECTION_DATE`

```sql
SELECT SUM(REALIZATION_QUANTITY) AS total_bulk_kg
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_OLAH
WHERE CORRECTION_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
```

### 4b. FG Output (pcs)
**Tabel:** `DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG`
**Kolom tanggal:** `CORRECTION_DATE`

```sql
SELECT SUM(QUANTITY) AS total_fg_pcs
FROM DATAMART.MANUFACTURE.DATAMART_PRODUCTION_OUTPUT_FG
WHERE CORRECTION_DATE::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
```

---

## 5. OEE — Overall Equipment Effectiveness
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS`
**Kolom tanggal:** `KEMAS_COMPLETED_AT`

OEE = Quality × Performance, dihitung per baris lalu di-average per plant.
- **Quality** = QTY_FG_GOOD / QTY_TOTAL
- **Performance** = PRODUCTIVITY / ACTIVITY_PRODUCTIVITY_STD, di-cap max 100% dengan `LEAST(..., 1.0)`
- **OEE** = Quality × Performance per baris → AVG

Angka di card = rata-rata OEE dari semua plant.

```sql
SELECT
  PLANT,

  AVG(
    CASE WHEN QTY_TOTAL > 0
    THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL
    ELSE 0 END
  ) * 100 AS quality,

  AVG(
    CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
    THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
    ELSE 0 END
  ) * 100 AS performance,

  AVG(
    (CASE WHEN QTY_TOTAL > 0
      THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END)
    *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
      THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
      ELSE 0 END)
  ) * 100 AS oee

FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
  -- AND PLANT = 'xxx'
GROUP BY PLANT
```

---

## 6. PRODUCTIVITY

### 6a. E2E Productivity
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_E2E`
**Kolom tanggal:** `KEMAS_COMPLETED_AT`

Kolom `E2E_PRODUCTIVITY` sudah pre-computed di sumber. Kita cukup rata-ratakan.

```sql
SELECT AVG(E2E_PRODUCTIVITY) AS avg_e2e_prod
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
  -- AND PLANT = 'xxx'
```

### 6b. Downstream Productivity (pengemasan)
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS`
**Kolom tanggal:** `KEMAS_COMPLETED_AT`

Formula (setara Tableau LOD `{FIXED [PROCESS_ORDER_FG]: SUM/SUM/MAX}`):
Per PO → `SUM(qty_bagus) / SUM(jam_kerja) / MAX(operator)`, lalu AVG semua PO.

```sql
SELECT AVG(po_prod) AS avg_downstream_prod
FROM (
  SELECT
    PROCESS_ORDER_FG,
    SUM(QTY_FG_GOOD)
      / NULLIF(SUM(LEADTIME_IN_MINUTE) / 60.0, 0)
      / NULLIF(MAX(OPERATOR_COUNT), 0) AS po_prod
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
  WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
    AND LEADTIME_IN_MINUTE > 0
    AND OPERATOR_COUNT > 0
    -- AND PLANT = 'xxx'
  GROUP BY PROCESS_ORDER_FG
) sub
```

### 6c. Upstream Productivity (pengolahan) — 3-level LOD
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH`
**Kolom tanggal:** `OLAH_COMPLETED_AT`

Setara Tableau LOD: `{FIXED [PROCESS_ORDER_SFG]: MAX(bulk) / (SUM(jam) / SUM(operator))}`.
Dihitung 3 tahap karena satu SFG → banyak posisi → banyak activity.

```sql
-- LEVEL 1: per activity — ambil nilai dari baris yang ada release_bulk
WITH activity_lvl AS (
  SELECT
    PROCESS_ORDER_SFG, POSITION, ACTIVITY, ACTIVITY_ID,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN RELEASE_BULK END)       AS release_bulk_sfg,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN LEADTIME_IN_MINUTE END) AS leadtime_per_act,
    MAX(CASE WHEN RELEASE_BULK IS NOT NULL THEN OPERATOR_COUNT END)     AS operator_per_act
  FROM MIGRATION.CONTROL_TOWER.CT_MANUF_OLAH
  WHERE OLAH_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
    -- AND PLANT = 'xxx'
  GROUP BY PROCESS_ORDER_SFG, POSITION, ACTIVITY, ACTIVITY_ID
),

-- LEVEL 2: per posisi — sum leadtime dan operator dari semua activity di posisi itu
position_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    MAX(release_bulk_sfg)  AS release_bulk_sfg,
    SUM(leadtime_per_act)  AS leadtime_sum,
    SUM(operator_per_act)  AS operator_per_position
  FROM activity_lvl
  GROUP BY PROCESS_ORDER_SFG, POSITION
),

-- LEVEL 3: per SFG — sum semua posisi jadi satu angka per SFG
sfg_lvl AS (
  SELECT
    PROCESS_ORDER_SFG,
    MAX(release_bulk_sfg)      AS max_release_bulk,
    SUM(leadtime_sum)          AS total_leadtime_min,
    SUM(operator_per_position) AS total_operators
  FROM position_lvl
  GROUP BY PROCESS_ORDER_SFG
)

-- HASIL: produktivitas per SFG → AVG semua SFG
SELECT
  AVG(
    CASE WHEN total_leadtime_min > 0 AND total_operators > 0
    THEN max_release_bulk / (total_leadtime_min / 60.0) / total_operators
    END
  ) AS avg_upstream_prod
FROM sfg_lvl
WHERE max_release_bulk > 0
```

### 6d. Productivity Details — Manhours & Operator
**Tabel:** `MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS`
**Kolom tanggal:** `KEMAS_COMPLETED_AT`

```sql
SELECT
  ROUND(SUM(LEADTIME_IN_MINUTE / 60.0 * OPERATOR_COUNT)) AS total_manhours,
  ROUND(AVG(OPERATOR_COUNT))                              AS avg_operators
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
  AND LEADTIME_IN_MINUTE > 0
  AND OPERATOR_COUNT > 0
  -- AND PLANT = 'xxx'
```

---

## 7. SPARKLINES (data mingguan)
Versi weekly dari OEE dan E2E — logika sama, di-group per minggu. Hasilnya untuk sparkline kecil di card.

### 7a. OEE Weekly
```sql
SELECT
  DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS week,
  AVG(
    (CASE WHEN QTY_TOTAL > 0
      THEN QTY_FG_GOOD::FLOAT / QTY_TOTAL ELSE 0 END)
    *
    (CASE WHEN ACTIVITY_PRODUCTIVITY_STD > 0
      THEN LEAST(PRODUCTIVITY::FLOAT / ACTIVITY_PRODUCTIVITY_STD, 1.0)
      ELSE 0 END)
  ) * 100 AS oee
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_KEMAS
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
  -- AND PLANT = 'xxx'
GROUP BY 1
ORDER BY 1
```

### 7b. E2E Weekly
```sql
SELECT
  DATE_TRUNC('week', KEMAS_COMPLETED_AT::DATE) AS week,
  AVG(E2E_PRODUCTIVITY) AS avg_prod
FROM MIGRATION.CONTROL_TOWER.CT_MANUF_E2E
WHERE KEMAS_COMPLETED_AT::DATE BETWEEN '2025-01-01' AND CURRENT_DATE()
  -- AND PLANT = 'xxx'
GROUP BY 1
ORDER BY 1
```

---

## CARA PAKAI

**Test query di Snowflake:**
Ganti `BETWEEN '2025-01-01' AND CURRENT_DATE()` dengan range yang mau dicek.
Aktifkan `-- AND PLANT = 'xxx'` dengan uncomment dan ganti `xxx` dengan nama plant.

**Update query di dashboard:**
Edit `lib/queries.ts` → fungsi yang namanya sesuai KPI (contoh: `getLeadTimeKPI`, `getOEEByPlant`).
Setelah edit, update juga query di file ini supaya tetap sinkron.

**Kolom tanggal per KPI:**
| KPI | Tabel | Kolom tanggal |
|---|---|---|
| Lead Time, RFT | CT_MANUF_LEADTIME | `PO_FG_DONE_DATE` |
| Pack Loss, OEE, Downstream Prod, Sparklines | CT_MANUF_KEMAS | `KEMAS_COMPLETED_AT` |
| E2E Productivity, E2E Sparkline | CT_MANUF_E2E | `KEMAS_COMPLETED_AT` |
| Upstream Productivity | CT_MANUF_OLAH | `OLAH_COMPLETED_AT` |
| Bulk Loss, Bulk Output | DATAMART_PRODUCTION_OUTPUT_OLAH | `CORRECTION_DATE` |
| FG Output | DATAMART_PRODUCTION_OUTPUT_FG | `CORRECTION_DATE` |
