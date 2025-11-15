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
        // accountName列のフォーマッター
        return {
          ...col,
          renderCell: (props: RenderCellProps<Row>) => {
            const { row } = props;
            if (row.rowType === "fs-header") {
              return <strong>{row.fsType}</strong>;
            }
            // ratio行とyoy行は、rowClassで適用されるCSSに任せる
            return <span className="account-name">{row.accountName}</span>;
          },
        };
      } else if (col.key === "ruleDescription") {
        return {
          ...col,
          renderCell: (props: RenderCellProps<Row>) => {
            const { row } = props;
            if (row.rowType === "fs-header") return null;
            return (
              <span className="rule-description">{row.ruleDescription}</span>
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

            // バランスチェック行 - 値に応じた条件分岐が必要
            if (row.rowType === "balance-check") {
              if (typeof value === "number") {
                const isBalanced = value === 0; // 完全一致をチェック
                return (
                  <div
                    className="numeric-cell"
                    style={{ color: isBalanced ? "green" : "red" }}
                  >
                    {isBalanced ? "一致" : value.toLocaleString()}
                  </div>
                );
              }
              return "-";
            }

            // 比率行 - CSSでスタイル適用
            if (row.rowType === "ratio") {
              if (typeof value === "number") {
                return <div className="numeric-cell">{value.toFixed(1)}%</div>;
              }
              return "-";
            }

            // 前期比行 - CSSでスタイル適用
            if (row.rowType === "yoy") {
              if (typeof value === "number") {
                return (
                  <div className="numeric-cell">
                    {value > 0 ? "+" : ""}
                    {value.toFixed(1)}%
                  </div>
                );
              }
              return "-";
            }

            // AccountRowの場合 - 値に応じた条件分岐が必要
            if (row.rowType === "account") {
              if (typeof value === "number") {
                // 整数に丸めてから、3桁ごとにカンマを付けて表示
                const integerValue = Math.round(value);
                const absValue = Math.abs(integerValue);
                const formattedValue = absValue.toLocaleString("ja-JP", {
                  maximumFractionDigits: 0,
                });

                // 値によってスタイルが変わるので、renderCellで処理
                if (integerValue < 0) {
                  return (
                    <div className="numeric-cell negative">
                      ({formattedValue})
                    </div>
                  );
                }

                return <div className="numeric-cell">{formattedValue}</div>;
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
