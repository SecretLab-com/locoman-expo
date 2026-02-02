import { getApiBaseUrl } from "@/lib/api-config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { Platform } from "react-native";

// Cache keys
const CACHE_KEYS = {
  BUNDLES: "offline_cache_bundles",
  PRODUCTS: "offline_cache_products",
  TRAINERS: "offline_cache_trainers",
  USER_PROFILE: "offline_cache_user_profile",
  LAST_SYNC: "offline_cache_last_sync",
};

// Cache expiration time (24 hours)
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

const CACHE_VERSION = 1;
const WEB_HEALTH_TTL_MS = 5000;
let lastWebHealthCheckAt = 0;
let lastWebHealthResult: boolean | null = null;

const getHealthUrl = () => {
  const baseUrl = getApiBaseUrl() || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/api/health`;
};

const checkWebReachability = async (force = false): Promise<boolean> => {
  if (Platform.OS !== "web") return true;
  const now = Date.now();
  if (!force && lastWebHealthResult !== null && now - lastWebHealthCheckAt < WEB_HEALTH_TTL_MS) {
    return lastWebHealthResult;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(getHealthUrl(), { method: "GET", signal: controller.signal });
    lastWebHealthResult = response.ok;
    lastWebHealthCheckAt = now;
    return response.ok;
  } catch {
    lastWebHealthResult = false;
    lastWebHealthCheckAt = now;
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Offline caching service for the app
 * Provides persistent storage for bundles, products, and trainer data
 */
export const offlineCache = {
  /**
   * Check if the device is online
   */
  async isOnline(): Promise<boolean> {
    try {
      if (Platform.OS === "web") {
        const browserOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
        if (!browserOnline) {
          return await checkWebReachability(true);
        }
        return await checkWebReachability();
      }
      const state = await NetInfo.fetch();
      const isConnected = state.isConnected;
      const isReachable = state.isInternetReachable;
      if (isConnected === false || isReachable === false) {
        return false;
      }
      return true;
    } catch {
      return true; // Assume online if check fails
    }
  },

  /**
   * Subscribe to network state changes
   */
  subscribeToNetworkChanges(callback: (isConnected: boolean) => void): () => void {
    if (Platform.OS === "web") {
      let isActive = true;
      const emit = async (force = false) => {
        if (!isActive) return;
        const online = await checkWebReachability(force);
        callback(online);
      };
      const handleOnline = () => void emit(true);
      const handleOffline = () => void emit(true);
      if (typeof window !== "undefined") {
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
      }
      const intervalId = setInterval(() => void emit(false), 15000);
      void emit(true);
      return () => {
        isActive = false;
        clearInterval(intervalId);
        if (typeof window !== "undefined") {
          window.removeEventListener("online", handleOnline);
          window.removeEventListener("offline", handleOffline);
        }
      };
    }
    return NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected;
      const isReachable = state.isInternetReachable;
      const online = !(isConnected === false || isReachable === false);
      callback(online);
    });
  },

  /**
   * Save bundles to cache
   */
  async cacheBundles(bundles: any[]): Promise<void> {
    try {
      const entry: CacheEntry<any[]> = {
        data: bundles,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      await AsyncStorage.setItem(CACHE_KEYS.BUNDLES, JSON.stringify(entry));
      console.log(`[OfflineCache] Cached ${bundles.length} bundles`);
    } catch (error) {
      console.error("[OfflineCache] Failed to cache bundles:", error);
    }
  },

  /**
   * Get cached bundles
   */
  async getCachedBundles(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.BUNDLES);
      if (!cached) return null;

      const entry: CacheEntry<any[]> = JSON.parse(cached);
      
      // Check version compatibility
      if (entry.version !== CACHE_VERSION) {
        await AsyncStorage.removeItem(CACHE_KEYS.BUNDLES);
        return null;
      }

      // Check expiration
      if (Date.now() - entry.timestamp > CACHE_EXPIRATION_MS) {
        console.log("[OfflineCache] Bundles cache expired");
        return entry.data; // Return stale data but mark as expired
      }

      return entry.data;
    } catch (error) {
      console.error("[OfflineCache] Failed to get cached bundles:", error);
      return null;
    }
  },

  /**
   * Save products to cache
   */
  async cacheProducts(products: any[]): Promise<void> {
    try {
      const entry: CacheEntry<any[]> = {
        data: products,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      await AsyncStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(entry));
      console.log(`[OfflineCache] Cached ${products.length} products`);
    } catch (error) {
      console.error("[OfflineCache] Failed to cache products:", error);
    }
  },

  /**
   * Get cached products
   */
  async getCachedProducts(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.PRODUCTS);
      if (!cached) return null;

      const entry: CacheEntry<any[]> = JSON.parse(cached);
      
      if (entry.version !== CACHE_VERSION) {
        await AsyncStorage.removeItem(CACHE_KEYS.PRODUCTS);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error("[OfflineCache] Failed to get cached products:", error);
      return null;
    }
  },

  /**
   * Save trainers to cache
   */
  async cacheTrainers(trainers: any[]): Promise<void> {
    try {
      const entry: CacheEntry<any[]> = {
        data: trainers,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      await AsyncStorage.setItem(CACHE_KEYS.TRAINERS, JSON.stringify(entry));
      console.log(`[OfflineCache] Cached ${trainers.length} trainers`);
    } catch (error) {
      console.error("[OfflineCache] Failed to cache trainers:", error);
    }
  },

  /**
   * Get cached trainers
   */
  async getCachedTrainers(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.TRAINERS);
      if (!cached) return null;

      const entry: CacheEntry<any[]> = JSON.parse(cached);
      
      if (entry.version !== CACHE_VERSION) {
        await AsyncStorage.removeItem(CACHE_KEYS.TRAINERS);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error("[OfflineCache] Failed to get cached trainers:", error);
      return null;
    }
  },

  /**
   * Save user profile to cache
   */
  async cacheUserProfile(profile: any): Promise<void> {
    try {
      const entry: CacheEntry<any> = {
        data: profile,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      await AsyncStorage.setItem(CACHE_KEYS.USER_PROFILE, JSON.stringify(entry));
      console.log("[OfflineCache] Cached user profile");
    } catch (error) {
      console.error("[OfflineCache] Failed to cache user profile:", error);
    }
  },

  /**
   * Get cached user profile
   */
  async getCachedUserProfile(): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.USER_PROFILE);
      if (!cached) return null;

      const entry: CacheEntry<any> = JSON.parse(cached);
      
      if (entry.version !== CACHE_VERSION) {
        await AsyncStorage.removeItem(CACHE_KEYS.USER_PROFILE);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error("[OfflineCache] Failed to get cached user profile:", error);
      return null;
    }
  },

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch {
      return null;
    }
  },

  /**
   * Update last sync timestamp
   */
  async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error("[OfflineCache] Failed to update last sync time:", error);
    }
  },

  /**
   * Check if cache is stale (older than expiration time)
   */
  async isCacheStale(): Promise<boolean> {
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return true;
    return Date.now() - lastSync > CACHE_EXPIRATION_MS;
  },

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEYS.BUNDLES),
        AsyncStorage.removeItem(CACHE_KEYS.PRODUCTS),
        AsyncStorage.removeItem(CACHE_KEYS.TRAINERS),
        AsyncStorage.removeItem(CACHE_KEYS.USER_PROFILE),
        AsyncStorage.removeItem(CACHE_KEYS.LAST_SYNC),
      ]);
      console.log("[OfflineCache] Cleared all cache");
    } catch (error) {
      console.error("[OfflineCache] Failed to clear cache:", error);
    }
  },

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    bundlesCount: number;
    productsCount: number;
    trainersCount: number;
    lastSync: number | null;
    isStale: boolean;
  }> {
    const [bundles, products, trainers, lastSync, isStale] = await Promise.all([
      this.getCachedBundles(),
      this.getCachedProducts(),
      this.getCachedTrainers(),
      this.getLastSyncTime(),
      this.isCacheStale(),
    ]);

    return {
      bundlesCount: bundles?.length ?? 0,
      productsCount: products?.length ?? 0,
      trainersCount: trainers?.length ?? 0,
      lastSync,
      isStale,
    };
  },
};

export default offlineCache;
