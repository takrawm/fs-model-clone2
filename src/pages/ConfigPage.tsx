// src/pages/ConfigPage.tsx
import { useState } from "react";
import { dcfConfig, type DCFConfig } from "../config/dcfConfig";
import "./ConfigPage.css"; // スタイリング用にCSSをインポート

function ConfigPage() {
  // 簡易的な状態管理（編集はまだ永続化されない）
  const [config, setConfig] = useState<DCFConfig>(dcfConfig);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0, // 数値に変換
    }));
  };

  return (
    <div className="config-page">
      <h2>Configuration</h2>

      {/* FS Config Section (Placeholder) */}
      <section className="config-section">
        <h3>FS-Config</h3>
        <p>(FS設定はここに表示されます)</p>
      </section>

      {/* DCF Config Section */}
      <section className="config-section">
        <h3>DCF-Config</h3>
        <form className="config-form">
          <div className="form-group">
            <label htmlFor="baseYear">基準年度 (FY)</label>
            <input
              type="number"
              id="baseYear"
              name="baseYear"
              value={config.baseYear}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="forecastYears">予測期間 (年数)</label>
            <input
              type="number"
              id="forecastYears"
              name="forecastYears"
              value={config.forecastYears}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="terminalGrowthRate">永久成長率 (%)</label>
            <input
              type="number"
              id="terminalGrowthRate"
              name="terminalGrowthRate"
              value={config.terminalGrowthRate * 100} // %で表示
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  terminalGrowthRate: parseFloat(e.target.value) / 100 || 0,
                }))
              }
              step="0.1"
            />
          </div>
          <div className="form-group">
            <label htmlFor="wacc">WACC (%)</label>
            <input
              type="number"
              id="wacc"
              name="wacc"
              value={config.wacc * 100} // %で表示
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  wacc: parseFloat(e.target.value) / 100 || 0,
                }))
              }
              step="0.1"
            />
          </div>
        </form>
      </section>

      {/* LBO Config Section (Placeholder) */}
      <section className="config-section">
        <h3>LBO-Config</h3>
        <p>(LBO設定はここに表示されます)</p>
      </section>
    </div>
  );
}

export default ConfigPage;
