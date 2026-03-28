import { CONFIG } from "../config.ts";
import { RedisStore } from "./redis-store.ts";
import { MemoryStore } from "./memory-store.ts";
import { MongoStore } from "./mongo-store.ts";
import { MarketData, TF, DColors } from "../core/types.ts";
import { logger } from "../core/utils/logger.ts";

/**
 * Единый интерфейс для всех хранилищ.
 */
export interface IDataStore {
  init(): Promise<void>;
  save(timeframe: TF, snapshot: MarketData): Promise<void>;
  get(timeframe: TF): Promise<MarketData | null>;
  getAll(): Promise<MarketData[]>;
  clear(): Promise<void>;
}

// Lazy storage resolution
let currentStore: IDataStore | null = null;

function getStore(): IDataStore {
  if (currentStore) return currentStore;

  const driver = CONFIG.STORAGE.DRIVER;

  if (driver === "memory") {
    logger.info("🗄️ [STORAGE] Using MEMORY store (NodeCache)", DColors.cyan);
    currentStore = MemoryStore;
  } else if (driver === "mongo") {
    logger.info("🗄️ [STORAGE] Using MONGODB store", DColors.cyan);
    currentStore = MongoStore;
  } else {
    logger.info("🗄️ [STORAGE] Using REDIS store (Upstash)", DColors.cyan);
    currentStore = RedisStore;
  }

  return currentStore;
}

/**
 * Единая точка доступа к хранилищу.
 * Выбор драйвера происходит лениво при первом вызове метода.
 */
export const DataStore: IDataStore = {
  init: () => getStore().init(),
  save: (t, s) => getStore().save(t, s),
  get: (t) => getStore().get(t),
  getAll: () => getStore().getAll(),
  clear: () => getStore().clear(),
};
