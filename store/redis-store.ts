import { Redis } from "@upstash/redis";
import { MarketData, TF, DColors } from "../core/types.ts";
import { logger } from "../core/utils/logger.ts";
import { load } from "@std/dotenv";

/**
 * RedisStore - замена MemoryStore с персистентностью в Upstash Redis
 */
export class RedisStore {
  private static redis: Redis | null = null;
  private static readonly KEY_PREFIX = "market-vibe:cache:";
  private static readonly TTL_SECONDS = 7 * 24 * 60 * 60; // 7 дней

  /**
   * Инициализация Redis клиента (вызывать при старте сервера)
   */
  static async init() {
    if (this.redis) return;

    // Load env variables if not already loaded (though server.ts should do it)
    await load({ export: true });

    const url =
      Deno.env.get("BIZZAR_UPSTASH_REDIS_REST_URL") ||
      Deno.env.get("BIZZAR_UPSTASH_REDIS_URL");
    const token =
      Deno.env.get("BIZZAR_UPSTASH_REDIS_REST_TOKEN") ||
      Deno.env.get("BIZZAR_UPSTASH_REDIS_TOKEN");

    if (!url || !token) {
      throw new Error(
        "BIZZAR_UPSTASH_REDIS_REST_URL и BIZZAR_UPSTASH_REDIS_REST_TOKEN должны быть установлены в .env"
      );
    }

    if (!url.startsWith("https://")) {
      throw new Error(
        `UPSTASH_REDIS_REST_URL должен начинаться с https://, получен: ${url}`
      );
    }

    this.redis = new Redis({
      url,
      token,
      automaticDeserialization: true,
    });

    logger.info("✅ [REDIS] Успешно подключен к Upstash Redis", DColors.green);
  }

  /**
   * Получить клиент Redis
   */
  private static getClient(): Redis {
    if (!this.redis) {
      throw new Error("Redis not initialized. Call RedisStore.init() first.");
    }
    return this.redis!;
  }

  /**
   * Сохранить данные для таймфрейма
   */
  static async save(timeframe: TF, snapshot: MarketData): Promise<void> {
    try {
      if (!this.redis) await this.init();
      const redis = this.getClient();
      const key = `${this.KEY_PREFIX}${timeframe}`;

      const dataWithMeta = {
        ...snapshot,
        timestamp: Date.now(),
      };

      // Сохраняем JSON (Upstash требует JSON)
      const jsonStr = JSON.stringify(dataWithMeta);

      const encoder = new TextEncoder();
      const originalSize = encoder.encode(jsonStr).length;

      logger.info(
        `📊 [REDIS] ${timeframe}: ${(originalSize / 1024 / 1024).toFixed(2)}MB`,
        DColors.yellow
      );

      await redis.set(key, jsonStr, {
        ex: this.TTL_SECONDS,
      });

      logger.info(
        `✅ [REDIS] Saved ${timeframe} (${snapshot.coinsNumber} coins)`,
        DColors.green
      );
    } catch (error) {
      logger.error(
        `❌ [REDIS] Error saving ${timeframe}: ${error}`,
        DColors.red
      );
      throw error;
    }
  }

  /**
   * Получить данные для таймфрейма
   */
  static async get(timeframe: TF): Promise<MarketData | null> {
    try {
      if (!this.redis) await this.init();
      const redis = this.getClient();
      const key = `${this.KEY_PREFIX}${timeframe}`;

      // Получаем JSON объект
      const stored = await redis.get(key);

      if (!stored) {
        logger.info(
          `ℹ️ [REDIS] No cache found for ${timeframe}`,
          DColors.yellow
        );
        return null;
      }

      // В Deno/Upstash для JS SDK, если automaticDeserialization: true (по умолчанию?),
      // redis.get вернет объект. Если stored - это строка, то парсим.
      // Но мы сохраняли через redis.set(key, jsonStr).
      // Upstash SDK должен вернуть объект.

      let data: MarketData & { timestamp: number };

      if (typeof stored === "string") {
        data = JSON.parse(stored);
      } else {
        data = stored as MarketData & { timestamp: number };
      }

      const ageMinutes = Math.round((Date.now() - data.timestamp) / 60000);
      logger.info(
        `✅ [REDIS] Retrieved ${timeframe}: ${data.coinsNumber} coins, age: ${ageMinutes}m`,
        DColors.cyan
      );

      return data;
    } catch (error) {
      logger.error(
        `❌ [REDIS] Error getting ${timeframe}: ${error}`,
        DColors.red
      );
      return null;
    }
  }

  /**
   * Получить все закэшированные таймфреймы
   */
  static async getAll(): Promise<MarketData[]> {
    try {
      if (!this.redis) await this.init();
      const redis = this.getClient();
      const pattern = `${this.KEY_PREFIX}*`;

      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        logger.info("ℹ️ [REDIS] No cached data found", DColors.yellow);
        return [];
      }

      const allData: MarketData[] = [];

      for (const key of keys) {
        try {
          const stored = await redis.get(key);
          if (stored) {
            let data: MarketData;
            if (typeof stored === "string") {
              data = JSON.parse(stored);
            } else {
              data = stored as MarketData;
            }
            allData.push(data);
          }
        } catch (e) {
          logger.error(
            `❌ [REDIS] Error parsing key ${key}: ${e}`,
            DColors.red
          );
        }
      }

      logger.info(
        `✅ [REDIS] Retrieved ${allData.length} cached timeframes`,
        DColors.cyan
      );
      return allData;
    } catch (error) {
      logger.error(`❌ [REDIS] Error getting all data: ${error}`, DColors.red);
      return [];
    }
  }

  /**
   * Очистить все данные кэша
   */
  static async clear(): Promise<void> {
    try {
      if (!this.redis) await this.init();
      const redis = this.getClient();
      const pattern = `${this.KEY_PREFIX}*`;

      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        logger.info("ℹ️ [REDIS] No keys to clear", DColors.yellow);
        return;
      }

      await redis.del(...keys);

      logger.info(
        `✅ [REDIS] Cleared ${keys.length} cached timeframes`,
        DColors.green
      );
    } catch (error) {
      logger.error(`❌ [REDIS] Error clearing cache: ${error}`, DColors.red);
      throw error;
    }
  }

  /**
   * Проверить возраст кэша (в миллисекундах)
   */
  static async getCacheAge(timeframe: TF): Promise<number | null> {
    const data = await this.get(timeframe);
    if (!data || !("timestamp" in data)) {
      return null;
    }
    return Date.now() - (data as any).timestamp;
  }

  /**
   * Проверить, устарел ли кэш
   */
  static async isStale(
    timeframe: TF,
    maxAge: number = 2 * 60 * 60 * 1000
  ): Promise<boolean> {
    const age = await this.getCacheAge(timeframe);
    return age === null || age > maxAge;
  }
}

export type { MarketData };

