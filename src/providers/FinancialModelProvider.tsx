import { type PropsWithChildren } from "react";
import {
  FinancialModelContext,
  useFinancialModelStore,
} from "../hooks/useFinancialModel";

/**
 * 財務モデルの状態を提供するProviderコンポーネント
 */
export function FinancialModelProvider({ children }: PropsWithChildren) {
  const hook = useFinancialModelStore();
  return (
    <FinancialModelContext.Provider value={hook}>
      {children}
    </FinancialModelContext.Provider>
  );
}
