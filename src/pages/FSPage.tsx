// src/pages/FSPage.tsx
import { useFinancialModel } from "../hooks/useFinancialModel";
import { StatementTable } from "../components/StatementTable";
// App.cssはApp.tsxでグローバルにインポートされている想定

function FSPage() {
  const { columns, rows, runCompute, nextYearPeriodId } = useFinancialModel();

  // FSタイプの行のみを表示（DCFタイプを除外）
  const fsRows = rows.filter(
    (row) =>
      row.rowType === "fs-header" ||
      (row.rowType === "account" &&
        row.sheetType !== "FCF" &&
        row.sheetType !== "PV") ||
      row.rowType === "balance-check" ||
      row.rowType === "ratio" ||
      row.rowType === "yoy"
  );

  return (
    <>
      <h2>Simple Financial Model (FS)</h2>
      <button onClick={runCompute}>
        Compute Next Year {nextYearPeriodId ? `(${nextYearPeriodId})` : ""}
      </button>

      <div className="grid-container">
        {fsRows.length > 0 && (
          <StatementTable columns={columns} rows={fsRows} />
        )}
      </div>
    </>
  );
}

export default FSPage;
