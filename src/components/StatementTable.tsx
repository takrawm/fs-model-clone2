import { DataGrid, type Column } from "react-data-grid";
// react-data-grid のデフォルトスタイルをインポート
import "react-data-grid/lib/styles.css";

interface Row {
  id: string;
  [key: string]: any;
}

interface StatementTableProps {
  columns: Column<Row>[];
  rows: Row[];
}

export function StatementTable({ columns, rows }: StatementTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKeyGetter={(row) => row.id}
      style={{ height: "80vh" }} // グリッドの高さを指定
    />
  );
}
