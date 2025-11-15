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
      const newCol: Column<Row> = { ...col } as Column<Row>;

      // カラムキーに応じてフォーマッターを追加
      if (col.key === "accountName") {
        (newCol as any).formatter = ({ row }: { row: Row }) => {
          if (row.rowType === "fs-header") {
            return <strong>{row.fsType}</strong>;
          }
          return <span style={{ paddingLeft: "20px" }}>{row.accountName}</span>;
        };
      } else if (col.key === "ruleDescription") {
        (newCol as any).formatter = ({ row }: { row: Row }) => {
          if (row.rowType === "fs-header") return "";
          return (
            <span style={{ fontSize: "12px", color: "#ccc" }}>
              {row.ruleDescription}
            </span>
          );
        };
      } else {
        // 期間列のフォーマッター
        (newCol as any).formatter = ({ row }: { row: Row }) => {
          if (row.rowType === "fs-header") return "";
          // col.keyは動的な値（例: "2025-3-ANNUAL"）
          // AccountRowの場合のみ期間の値が存在する
          if (row.rowType === "account") {
            const value = row[col.key as string];
            if (typeof value === "number") {
              return (
                <div style={{ textAlign: "right", paddingRight: "10px" }}>
                  {value.toLocaleString()}
                </div>
              );
            }
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
        return "";
      }}
    />
  );
}
