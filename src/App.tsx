import { useFinancialModel } from "./hooks/useFinancialModel";
import { StatementTable } from "./components/StatementTable";
import "./App.css";

function App() {
  const { columns, rows, runCompute } = useFinancialModel();

  return (
    <div className="app-container">
      <h2>Simple Financial Model</h2>
      <button onClick={runCompute}>Compute Next Year (2026-3)</button>

      <div className="grid-container">
        {rows.length > 0 && <StatementTable columns={columns} rows={rows} />}
      </div>
    </div>
  );
}

export default App;
