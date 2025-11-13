// src/engine/ast.ts

import { NodeRegistry } from "../model/registry.ts";
import type { NodeId, Op } from "../model/types.ts";

export function makeFF(
  reg: NodeRegistry,
  value: number,
  label: string
): NodeId {
  // 新しいIDを生成
  const id = reg.newId();

  // ノードオブジェクトを作成してレジストリに登録
  reg.add({
    id,
    type: "FF",
    value,
    label,
  });

  return id;
}

export function makeTT(
  reg: NodeRegistry,
  left: NodeId,
  right: NodeId,
  operator: Op,
  label: string
): NodeId {
  // 新しいIDを生成
  const id = reg.newId();

  // ノードオブジェクトを作成してレジストリに登録
  reg.add({
    id,
    type: "TT",
    ref1: left,
    ref2: right,
    operator,
    label,
  });

  return id;
}

/**
 * トポロジカルソート
 *
 * ノードの依存関係を解決し、評価すべき順序を決定します。
 * これは、有向非巡回グラフ（DAG: Directed Acyclic Graph）に対する
 * 標準的なアルゴリズムです。
 *
 * トポロジカルソートの基本的な考え方は、「依存先がすべて処理されてから
 * 自分を処理する」というものです。Kahn のアルゴリズムを使用しています。
 *
 * アルゴリズムの手順：
 *
 * 1. 各ノードの入次数（そのノードに入ってくるエッジの数）を計算
 * 2. 入次数が0のノード（依存先がない）をキューに追加
 * 3. キューからノードを取り出し、結果リストに追加
 * 4. そのノードから出ているエッジを削除（子ノードの入次数を減らす）
 * 5. 入次数が0になったノードをキューに追加
 * 6. キューが空になるまで繰り返す
 *
 * もしすべてのノードを処理できなかった場合、グラフに循環があることを
 * 意味します。これは「A→B→C→A」のような循環参照を示し、
 * 計算不可能なのでエラーを投げます。
 *
 * 具体例で考えてみましょう。以下のような依存関係があるとします。
 *
 * - 単価（依存なし）
 * - 数量（依存なし）
 * - 売上 = 単価 × 数量（単価と数量に依存）
 * - 原価 = 売上 × 0.6（売上に依存）
 * - 粗利 = 売上 - 原価（売上と原価に依存）
 *
 * トポロジカルソートの結果：
 * [単価, 数量, 売上, 原価, 粗利]
 *
 * この順序で評価すれば、各ノードを計算する時点で、必要な値がすべて
 * 揃っていることが保証されます。
 *
 * @param reg - ノードレジストリ
 * @param rootNodeIds - 評価したいルートノードのIDリスト
 * @returns 評価すべき順序でソートされたノードIDの配列
 * @throws 循環参照が検出された場合
 */
function topoSort(reg: NodeRegistry, rootNodeIds: NodeId[]): NodeId[] {
  // ステップ1: ルートノードから到達可能なすべてのノードを収集
  // これにより、不要なノード（使用されていないノード）を除外できます
  const reachable = new Set<NodeId>();
  const visit = (id: NodeId) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    const node = reg.get(id);
    // 子ノードがあれば再帰的に訪問
    if (node.type === "TT") {
      visit(node.ref1);
      visit(node.ref2);
    }
  };
  for (const rootNodeId of rootNodeIds) {
    visit(rootNodeId);
  }

  const nodes = Array.from(reachable);

  // ステップ2: 各ノードの入次数を計算
  // 入次数は、「このノードに依存している親ノードの数」を表します
  const inDegree = new Map<NodeId, number>();
  const children = new Map<NodeId, NodeId[]>(); // 各ノードの子リスト

  // 初期化: すべてのノードの入次数を0に設定
  for (const id of nodes) {
    inDegree.set(id, 0);
    children.set(id, []);
  }

  // エッジを辿って入次数を計算
  // 注意: ASTでは「親→子」の関係ですが、計算は「子→親」の順なので、
  // エッジの向きを逆にして考えます
  for (const id of nodes) {
    const node = reg.get(id);
    if (node.type === "TT") {
      // このノード(id)は ref1 に依存している
      // つまり ref1 → id というエッジがある
      inDegree.set(id, (inDegree.get(id) || 0) + 1);
      children.get(node.ref1)!.push(id);
      inDegree.set(id, (inDegree.get(id) || 0) + 1);
      children.get(node.ref2)!.push(id);
    }
  }

  // ステップ3: 入次数が0のノードをキューに追加
  // これらは依存先がないノード（FFノード）です
  const queue: NodeId[] = [];
  for (const id of nodes) {
    if ((inDegree.get(id) || 0) === 0) {
      queue.push(id);
    }
  }

  // ステップ4: Kahnのアルゴリズムを実行
  const sorted: NodeId[] = [];
  while (queue.length > 0) {
    // キューから1つ取り出す
    const current = queue.shift()!;
    sorted.push(current);

    // このノードの子ノード（このノードに依存しているノード）の
    // 入次数を減らす
    for (const child of children.get(current) || []) {
      const newDegree = (inDegree.get(child) || 0) - 1;
      inDegree.set(child, newDegree);

      // 入次数が0になったら、キューに追加
      if (newDegree === 0) {
        queue.push(child);
      }
    }
  }

  // ステップ5: すべてのノードを処理できたかチェック
  if (sorted.length !== nodes.length) {
    throw new Error(
      `循環参照が検出されました。処理できたノード: ${sorted.length}/${nodes.length}`
    );
  }

  return sorted;
}

/**
 * ASTを評価します（トポロジカルソート版）
 *
 * このメソッドは、トポロジカルソートで決定された順序に従って、
 * すべてのノードを順次評価します。これは、最も効率的な評価方法です。
 *
 * 評価の流れ：
 *
 * 1. トポロジカルソートで評価順序を決定
 * 2. その順序で各ノードを評価
 *    - FFノード: valueをそのまま記録
 *    - TTノード: 左右の子の値を演算して結果を記録
 * 3. すべてのノードの値を Map で返す
 *
 * この方法の利点は、各ノードを一度だけ評価すればよいことです。
 * トポロジカルソートにより、あるノードを評価する時点で、その依存先
 * （子ノード）の値は必ず計算済みであることが保証されています。
 *
 * 評価の具体例：
 *
 * ノード構造:
 * - FF(id="1", value=1050): 単価
 * - FF(id="2", value=550): 数量
 * - TT(id="3", ref1="1", ref2="2", op=MUL): 売上
 * - FF(id="4", value=0.6): 原価率
 * - TT(id="5", ref1="3", ref2="4", op=MUL): 原価
 * - TT(id="6", ref1="3", ref2="5", op=SUB): 粗利
 *
 * トポロジカルソート結果: [1, 2, 4, 3, 5, 6]
 *
 * 評価の流れ:
 * 1. ノード1を評価 → 1050
 * 2. ノード2を評価 → 550
 * 3. ノード4を評価 → 0.6
 * 4. ノード3を評価 → 1050 × 550 = 577500
 * 5. ノード5を評価 → 577500 × 0.6 = 346500
 * 6. ノード6を評価 → 577500 - 346500 = 231000
 *
 * @param reg - ノードレジストリ
 * @param rootNodeIds - 評価したいルートノードのIDリスト
 * @returns 各ノードの評価結果を格納した Map
 */
export function evalTopo(
  reg: NodeRegistry,
  rootNodeIds: NodeId[]
): Map<NodeId, number> {
  // トポロジカルソートで評価順序を決定
  const order = topoSort(reg, rootNodeIds);

  // 各ノードの評価結果を格納する Map
  const values = new Map<NodeId, number>();

  // 順序に従って各ノードを評価
  for (const id of order) {
    const node = reg.get(id);

    if (node.type === "FF") {
      // FFノード: 値をそのまま記録
      values.set(id, node.value);
    } else {
      // TTノード: 左右の子の値を取得して演算
      const leftValue = values.get(node.ref1);
      const rightValue = values.get(node.ref2);

      // 子の値が取得できない場合はエラー
      // （トポロジカルソートが正しければ、この状況は発生しないはず）
      if (leftValue === undefined || rightValue === undefined) {
        throw new Error(
          `子ノードの値が見つかりません: ${id} ` +
            `(left=${node.ref1}, right=${node.ref2})`
        );
      }

      // 演算を実行
      let result: number;
      switch (node.operator) {
        case "ADD":
          result = leftValue + rightValue;
          break;
        case "SUB":
          result = leftValue - rightValue;
          break;
        case "MUL":
          result = leftValue * rightValue;
          break;
        case "DIV":
          // 0除算のチェック
          if (rightValue === 0) {
            throw new Error(
              `0での除算が発生しました: ${id} ` +
                `(left=${leftValue}, right=${rightValue})`
            );
          }
          result = leftValue / rightValue;
          break;
        default:
          throw new Error(`未対応の演算子: ${node.operator}`);
      }

      values.set(id, result);
    }
  }

  return values;
}
