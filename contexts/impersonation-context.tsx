import { createContext, useContext, ReactNode } from "react";
import { useAuthContext } from "./auth-context";

type ImpersonationContextType = {
  isBannerVisible: boolean;
};

const ImpersonationContext = createContext<ImpersonationContextType>({
  isBannerVisible: false,
});

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { isImpersonating, impersonatedUser } = useAuthContext();
  const isBannerVisible = isImpersonating && !!impersonatedUser;

  return (
    <ImpersonationContext.Provider value={{ isBannerVisible }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonationContext() {
  return useContext(ImpersonationContext);
}
