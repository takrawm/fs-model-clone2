// src/pages/FSPage.tsx
import { useFinancialModel } from "../hooks/useFinancialModel";
import { StatementTable } from "../components/StatementTable";
// App.cssはApp.tsxでグローバルにインポートされている想定

function FSPage() {
  const { columns, rows, runCompute, nextYearPeriodId } = useFinancialModel();

  return (
    <>
      <h2>Simple Financial Model (FS)</h2>
      <button onClick={runCompute}>
        Compute Next Year {nextYearPeriodId ? `(${nextYearPeriodId})` : ""}
      </button>

      <div className="grid-container">
        {rows.length > 0 && <StatementTable columns={columns} rows={rows} />}
      </div>
    </>
  );
}

export default FSPage;

