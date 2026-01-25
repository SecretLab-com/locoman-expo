import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

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
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch {
      return true; // Assume online if check fails
    }
  },

  /**
   * Subscribe to network state changes
   */
  subscribeToNetworkChanges(callback: (isConnected: boolean) => void): () => void {
    return NetInfo.addEventListener((state: NetInfoState) => {
      callback(state.isConnected ?? false);
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
