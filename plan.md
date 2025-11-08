# 簡易版財務モデルアプリ実装計画

## 1. プロジェクト構造のセットアップ

### 1.1 Vite + React + TypeScript プロジェクトの作成

- `fs/fs-model-clone2/`ディレクトリに Vite プロジェクトを作成
- 依存関係: React, TypeScript, react-data-grid
- 設定ファイル: `vite.config.ts`, `tsconfig.json`, `package.json`

### 1.2 ディレクトリ構造

```
fs-model-clone2/
├── src/
│   ├── lib/
│   │   └── fam/           # FAMアルゴリズム（簡易版）
│   │       ├── fam.ts
│   │       ├── engine/
│   │       │   └── ast.ts  # 簡易版ASTエンジン
│   │       └── model/
│   │           ├── types.ts
│   │           ├── bc.ts
│   │           ├── ids.ts
│   │           ├── registry.ts
│   │           └── globalAccount.ts  # 簡易版GAID定義
│   ├── data/
│   │   └── seed.json      # 空白ファイル（後でエクセルから生成予定）
│   ├── components/
│   │   ├── App.tsx
│   │   ├── FinancialStatements.tsx  # タブ切り替えコンポーネント
│   │   └── StatementTable.tsx       # react-data-grid表示コンポーネント
│   ├── hooks/
│   │   └── useFinancialModel.ts     # FAM計算実行フック
│   └── types/
│       └── seed.ts                  # seed.jsonの型定義
├── public/
└── package.json
```

## 2. FAM アルゴリズムの移植（必要最小限）

### 2.1 型定義の移植・簡略化 (`src/lib/fam/model/types.ts`)

- `Account`, `RuleInput`, `RefInput`, `Period`, `CFI`型を移植
- 元の`FsType`を拡張して`'PP&E' | 'Financing'`を追加
- 不要なフィールドは簡略化（最小限の必須フィールドのみ）

### 2.2 簡易版 AST エンジン (`src/lib/fam/engine/ast.ts`)

- `makeFF`, `makeTT`, `evalTopo`, `buildAccountNode`を移植
- 元の複雑な機能は簡略化し、基本的な計算ルール（INPUT, GROWTH_RATE, CALCULATION 等）のみ対応
- トポロジカルソートによる依存解決は維持

### 2.3 ユーティリティ (`src/lib/fam/model/`)

- `ids.ts`: `cellId`, `periodKey`関数（hash 依存は削除、簡易版に変更）
- `registry.ts`: `NodeRegistry`クラス（そのまま移植）
- `bc.ts`: `CFI`型定義のみ移植
- `globalAccount.ts`: 最小限の GAID 定義（必要最低限の GAID のみ）

### 2.4 FAM クラス (`src/lib/fam/fam.ts`)

- 元の`FAM`クラスの主要メソッドを移植:
  - `importActuals(PREVS, accountsMaster, opts?)`
  - `setRules(rules)`
  - `setBalanceChange(cfis)`
  - `compute({ years, baseProfitAccount, cashAccount })`
  - `getTable({ fs, years })`
- 内部実装を簡略化（BS/CF 計算ロジックは維持、複雑な最適化は後回し）
- `fs_type`として`'PP&E'`と`'Financing'`をサポート

## 3. seed.json の型定義と構造

### 3.1 型定義 (`src/types/seed.ts`)

```typescript
export interface SeedData {
  accountsMaster: Account[];
  PREVS: Record<string, number>[];
  rules: Record<string, RuleInput>;
  balanceChange?: CFI[];
  metadata?: {
    startYear?: number;
    actualYears?: number[];
  };
}
```

### 3.2 空白 seed.json ファイル作成 (`src/data/seed.json`)

- 初期は空のオブジェクト構造のみ: `{}`
- 後でエクセルから生成予定のため、コメントで構造を記載

## 4. UI コンポーネント実装

### 4.1 メイン App コンポーネント (`src/components/App.tsx`)

- seed.json を読み込み
- `useFinancialModel`フックで FAM 計算を実行
- `FinancialStatements`コンポーネントに結果を渡す

### 4.2 財務諸表タブコンポーネント (`src/components/FinancialStatements.tsx`)

- タブ切り替え UI（PL/BS/CF/PP&E/Financing）
- 選択されたタブに応じて`StatementTable`にデータを渡す
- react-data-grid のカラム定義（年度列 + 勘定行）

### 4.3 テーブル表示コンポーネント (`src/components/StatementTable.tsx`)

- `react-data-grid`を使用
- 行: 勘定科目（AccountName, accountId）
- 列: 年度（FY:2020, FY:2021, ...）
- セル: 計算結果の数値
- フォーマット: 数値は 3 桁区切り、マイナスは括弧表示など

### 4.4 計算フック (`src/hooks/useFinancialModel.ts`)

- seed.json からデータを読み込み
- FAM インスタンスを作成
- `importActuals` → `setRules` → `setBalanceChange` → `compute`の順で実行
- 計算結果を`getTable`で取得し、各財務諸表タイプごとに整形
- エラーハンドリングとローディング状態管理

## 5. 実装の詳細

### 5.1 FAM 移植の簡略化ポイント

- `recalculateParent`などの複雑な集計ロジックは簡略化
- `mirrorBsValueByGA`などの最適化機能は削除
- 基本的な BS 繰越・CF 計算・RE 連動は維持

### 5.2 react-data-grid の設定

- カラム定義: 年度ごとに動的生成
- 行定義: `accountsMaster`から生成、fs_type でフィルタリング
- 数値フォーマット: カスタムセルレンダラーで実装

### 5.3 タブ表示の財務諸表タイプ

- `'PL'`: 損益計算書
- `'BS'`: 貸借対照表
- `'CF'`: キャッシュフロー計算書
- `'PP&E'`: 固定資産関連（FAM の fs_type 拡張）
- `'Financing'`: 資金調達関連（FAM の fs_type 拡張）

## 6. 実装順序

1. プロジェクトセットアップ（Vite + 依存関係インストール）
2. 型定義の移植（types.ts, seed.ts）
3. ユーティリティの移植（ids.ts, registry.ts）
4. 簡易版 AST エンジンの移植
5. FAM クラスの移植・簡略化
6. seed.json（空白）の作成
7. useFinancialModel フックの実装
8. UI コンポーネントの実装（App, FinancialStatements, StatementTable）
9. 動作確認とデバッグ

## 7. 注意事項

- FAM のコアアルゴリズムは維持するが、最適化やエッジケース対応は簡略化
- seed.json の形式は後でエクセルから生成することを前提に設計
- フロントエンドのみなので、Node.js 依存の機能（hash, logger 等）は削除または代替実装
- 将来的な API 統合を想定し、FAM クラスのインターフェースは変更しない
