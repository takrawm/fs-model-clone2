import { useMemo } from "react";
import { DataGrid, type Column, type RenderCellProps } from "react-data-grid";
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
      // カラムキーに応じてフォーマッターを追加
      if (col.key === "accountName") {
        // accountName列のフォーマッター（比率と前期比のスタイルを追加）
        return {
          ...col,
          renderCell: (props: RenderCellProps<Row>) => {
            const { row } = props;
            if (row.rowType === "fs-header") {
              return <strong>{row.fsType}</strong>;
            }
            if (row.rowType === "balance-check") {
              return (
                <span
                  style={{
                    backgroundColor: "#0066cc",
                    color: "white",
                    padding: "2px 8px 2px 20px",
                    borderRadius: "3px",
                    display: "inline-block",
                  }}
                >
                  {row.accountName}
                </span>
              );
            }
            if (row.rowType === "ratio" || row.rowType === "yoy") {
              return (
                <span
                  style={{
                    paddingLeft: "20px",
                    color: "#888",
                    fontStyle: "italic",
                  }}
                >
                  {row.accountName}
                </span>
              );
            }
            return (
              <span style={{ paddingLeft: "20px" }}>{row.accountName}</span>
            );
          },
        };
      } else if (col.key === "ruleDescription") {
        return {
          ...col,
          renderCell: (props: RenderCellProps<Row>) => {
            const { row } = props;
            if (row.rowType === "fs-header") return null;
            return (
              <span style={{ fontSize: "12px" }}>{row.ruleDescription}</span>
            );
          },
        };
      } else {
        // 期間列のフォーマッター
        return {
          ...col,
          renderCell: (props: RenderCellProps<Row>) => {
            const { row } = props;
            if (row.rowType === "fs-header") return null;

            const value = row[col.key as string];

            // バランスチェック行
            if (row.rowType === "balance-check") {
              if (typeof value === "number") {
                const isBalanced = value === 0; // 完全一致をチェック
                return (
                  <div
                    style={{
                      textAlign: "right",
                      paddingRight: "10px",
                      color: isBalanced ? "green" : "red",
                    }}
                  >
                    {isBalanced ? "一致" : value.toLocaleString()}
                  </div>
                );
              }
              return "-";
            }

            // 比率行
            if (row.rowType === "ratio") {
              if (typeof value === "number") {
                return (
                  <div
                    style={{
                      textAlign: "right",
                      paddingRight: "10px",
                      color: "#888",
                      fontStyle: "italic",
                    }}
                  >
                    {value.toFixed(1)}%
                  </div>
                );
              }
              return "-";
            }

            // 前期比行
            if (row.rowType === "yoy") {
              if (typeof value === "number") {
                return (
                  <div
                    style={{
                      textAlign: "right",
                      paddingRight: "10px",
                      color: "#888",
                      fontStyle: "italic",
                    }}
                  >
                    {value > 0 ? "+" : ""}
                    {value.toFixed(1)}%
                  </div>
                );
              }
              return "-";
            }

            // AccountRowの場合
            if (row.rowType === "account") {
              if (typeof value === "number") {
                // 整数に丸めてから、3桁ごとにカンマを付けて表示
                const integerValue = Math.round(value);
                const absValue = Math.abs(integerValue);
                const formattedValue = absValue.toLocaleString("ja-JP", {
                  maximumFractionDigits: 0,
                });

                // マイナスの場合は()付きで赤字表示
                if (integerValue < 0) {
                  return (
                    <div
                      style={{
                        textAlign: "right",
                        paddingRight: "10px",
                        color: "red",
                      }}
                    >
                      ({formattedValue})
                    </div>
                  );
                }

                return (
                  <div style={{ textAlign: "right", paddingRight: "10px" }}>
                    {formattedValue}
                  </div>
                );
              }
            }

            return "-";
          },
        };
      }
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
        if (row.rowType === "balance-check") return "balance-check-row";
        if (row.rowType === "ratio") return "ratio-row";
        if (row.rowType === "yoy") return "yoy-row";
        return "";
      }}
    />
  );
}
