// src/pages/DCFPage.tsx
import { useMemo } from "react";
import { useFinancialModel } from "../hooks/useFinancialModel";
import { StatementTable } from "../components/StatementTable";

function DCFPage() {
  const { columns, rows, nextYearPeriodId } = useFinancialModel();

  // DCFタイプの行のみを表示（DCFヘッダー行とDCFアカウント行）
  const dcfRows = useMemo(() => {
    return rows.filter(
      (row) =>
        row.rowType === "dcf-header" ||
        (row.rowType === "account" &&
          (row.sheetType === "FCF" || row.sheetType === "PV"))
    );
  }, [rows]);

  return (
    <>
      <h2>DCF Analysis</h2>
      <button disabled>
        Compute Next Year {nextYearPeriodId ? `(${nextYearPeriodId})` : ""}
      </button>

      <div className="grid-container">
        {dcfRows.length > 0 && (
          <StatementTable columns={columns} rows={dcfRows} />
        )}
      </div>
    </>
  );
}

export default DCFPage;
