import { useMemo } from "react";
import { DataGrid, type Column } from "react-data-grid";
// react-data-grid のデフォルトスタイルをインポート
import "react-data-grid/lib/styles.css";
import "./StatementTable.css";
import type { Row } from "../hooks/useFinancialModel";

interface StatementTableProps {
  columns: Column<Row>[];
  rows: Row[];
}

export function StatementTable({ columns, rows }: StatementTableProps) {
  // フォーマッター関数をコンポーネント側で定義
  const formattedColumns = useMemo(() => {
    return columns.map((col) => {
      // 既存のカラム定義をコピー
      const newCol: Column<Row> = { ...col };

      // カラムキーに応じてフォーマッターを追加
      if (col.key === "accountName") {
        newCol.formatter = ({ row }) => {
          if (row.rowType === "fs-header") {
            return <strong>{row.fsType}</strong>;
          }
          const indent = row.isCfSource ? "30px" : "20px";
          return <span style={{ paddingLeft: indent }}>{row.accountName}</span>;
        };
      } else if (col.key === "ruleDescription") {
        newCol.formatter = ({ row }) => {
          if (row.rowType === "fs-header") return "";
          return (
            <span style={{ fontSize: "12px", color: "#ccc" }}>
              {row.ruleDescription}
            </span>
          );
        };
      } else {
        // 期間列のフォーマッター
        newCol.formatter = ({ row }) => {
          if (row.rowType === "fs-header") return "";
          const value = row[col.key];
          if (typeof value === "number") {
            return (
              <div style={{ textAlign: "right", paddingRight: "10px" }}>
                {value.toLocaleString()}
              </div>
            );
          }
          return "-";
        };
      }

      return newCol;
    });
  }, [columns]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <DataGrid
      columns={formattedColumns}
      rows={rows}
      rowKeyGetter={(row) => row.id}
      style={{ height: "80vh" }}
      rowClass={(row) => {
        if (row.rowType === "fs-header") return "fs-header-row";
        if (row.isTotal) return "total-row";
        return "";
      }}
    />
  );
}
