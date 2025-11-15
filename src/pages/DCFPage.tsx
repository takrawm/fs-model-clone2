// src/pages/DCFPage.tsx
import { useMemo } from "react";
import { useFinancialModel } from "../hooks/useFinancialModel";
import { StatementTable } from "../components/StatementTable";

function DCFPage() {
  const { columns, rows, nextYearPeriodId } = useFinancialModel();

  // FSヘッダー行（PL, BSなど）を除外した行を作成
  const dcfRows = useMemo(() => {
    return rows.filter((row) => row.rowType !== "fs-header");
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

