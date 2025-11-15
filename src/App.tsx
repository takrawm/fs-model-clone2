import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import "./App.css";

// ページコンポーネントを遅延読み込み
const FSPage = lazy(() => import("./pages/FSPage"));
const DCFPage = lazy(() => import("./pages/DCFPage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));

function App() {
  return (
    <div className="app-container">
      {/* 1. タブナビゲーション */}
      <nav className="navigation-tabs">
        <NavLink to="/config">Config</NavLink>
        <NavLink to="/fs">FS</NavLink>
        <NavLink to="/dcf">DCF</NavLink>
      </nav>

      {/* 2. ページコンテンツ */}
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Navigate replace to="/fs" />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/fs" element={<FSPage />} />
          <Route path="/dcf" element={<DCFPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
