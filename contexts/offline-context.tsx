import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { offlineCache } from "@/lib/offline-cache";

interface OfflineContextType {
  isOnline: boolean;
  isLoading: boolean;
  lastSyncTime: number | null;
  isCacheStale: boolean;
  syncData: () => Promise<void>;
  clearCache: () => Promise<void>;
  getCachedBundles: () => Promise<any[] | null>;
  getCachedProducts: () => Promise<any[] | null>;
  getCachedTrainers: () => Promise<any[] | null>;
  cacheBundles: (bundles: any[]) => Promise<void>;
  cacheProducts: (products: any[]) => Promise<void>;
  cacheTrainers: (trainers: any[]) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [isCacheStale, setIsCacheStale] = useState(false);

  // Check initial network status and cache state
  useEffect(() => {
    async function init() {
      try {
        const [online, lastSync, stale] = await Promise.all([
          offlineCache.isOnline(),
          offlineCache.getLastSyncTime(),
          offlineCache.isCacheStale(),
        ]);
        setIsOnline(online);
        setLastSyncTime(lastSync);
        setIsCacheStale(stale);
      } catch (error) {
        console.error("[Offline] Init error:", error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Subscribe to network changes
  useEffect(() => {
    const unsubscribe = offlineCache.subscribeToNetworkChanges((connected) => {
      setIsOnline(connected);
      console.log(`[Offline] Network status changed: ${connected ? "online" : "offline"}`);
    });
    return unsubscribe;
  }, []);

  const syncData = useCallback(async () => {
    if (!isOnline) {
      console.log("[Offline] Cannot sync while offline");
      return;
    }

    try {
      await offlineCache.updateLastSyncTime();
      const lastSync = await offlineCache.getLastSyncTime();
      setLastSyncTime(lastSync);
      setIsCacheStale(false);
      console.log("[Offline] Data synced");
    } catch (error) {
      console.error("[Offline] Sync error:", error);
    }
  }, [isOnline]);

  const clearCache = useCallback(async () => {
    await offlineCache.clearAll();
    setLastSyncTime(null);
    setIsCacheStale(true);
    console.log("[Offline] Cache cleared");
  }, []);

  const getCachedBundles = useCallback(async () => {
    return offlineCache.getCachedBundles();
  }, []);

  const getCachedProducts = useCallback(async () => {
    return offlineCache.getCachedProducts();
  }, []);

  const getCachedTrainers = useCallback(async () => {
    return offlineCache.getCachedTrainers();
  }, []);

  const cacheBundles = useCallback(async (bundles: any[]) => {
    await offlineCache.cacheBundles(bundles);
    await offlineCache.updateLastSyncTime();
    const lastSync = await offlineCache.getLastSyncTime();
    setLastSyncTime(lastSync);
    setIsCacheStale(false);
  }, []);

  const cacheProducts = useCallback(async (products: any[]) => {
    await offlineCache.cacheProducts(products);
  }, []);

  const cacheTrainers = useCallback(async (trainers: any[]) => {
    await offlineCache.cacheTrainers(trainers);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isLoading,
        lastSyncTime,
        isCacheStale,
        syncData,
        clearCache,
        getCachedBundles,
        getCachedProducts,
        getCachedTrainers,
        cacheBundles,
        cacheProducts,
        cacheTrainers,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
