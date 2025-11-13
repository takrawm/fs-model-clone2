import { useFinancialModel } from "./hooks/useFinancialModel";
import { StatementTable } from "./components/StatementTable";
import "./App.css";

function App() {
  const { columns, rows, runCompute } = useFinancialModel();

  return (
    <div className="app-container">
      <h1>簡易財務モデル</h1>
      <p>
        ボタンを押すと <code>fam.compute()</code>{" "}
        が実行され、2026-3-ANNUALの予測が計算されます。
      </p>
      <button onClick={runCompute}>Compute 2026-3-ANNUAL</button>

      <div className="grid-container">
        {rows.length > 0 && <StatementTable columns={columns} rows={rows} />}
      </div>
    </div>
  );
}

export default App;
