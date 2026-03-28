
import { MongoClient, Collection, Db } from "mongodb";
import { MarketData, TF, DColors } from "../core/types.ts";
import { logger } from "../core/utils/logger.ts";
import { CONFIG } from "../config.ts";

/**
 * MongoStore - хранилище в MongoDB
 * Document ID (_id) = timeframe (e.g. "4h", "1h")
 */
export class MongoStore {
    private static client: MongoClient | null = null;
    private static db: Db | null = null;
    private static collection: Collection<MarketData & { _id: string }> | null = null;

    /**
     * Инициализация MongoDB клиента
     */
    static async init() {
        if (this.client) return;

        const uri = CONFIG.MONGO.URI;
        if (!uri) {
            throw new Error("MONGODB_URI не установлен в .env или config.ts");
        }

        try {
            this.client = new MongoClient(uri);
            await this.client.connect();

            this.db = this.client.db(CONFIG.MONGO.DB_NAME);
            this.collection = this.db.collection(CONFIG.MONGO.COLLECTION);

            logger.info(
                `✅ [MONGO] Connected to DB: ${CONFIG.MONGO.DB_NAME}, Coll: ${CONFIG.MONGO.COLLECTION}`,
                DColors.green
            );
        } catch (error) {
            logger.error(`❌ [MONGO] Connection error: ${error}`, DColors.red);
            throw error;
        }
    }

    private static getCollection(): Collection<MarketData & { _id: string }> {
        if (!this.collection) {
            throw new Error("MongoStore not initialized. Call init() first.");
        }
        return this.collection;
    }

    /**
     * Сохранить данные для таймфрейма
     * upsert: true (создать если нет, обновить если есть)
     */
    static async save(timeframe: TF, snapshot: MarketData): Promise<void> {
        try {
            if (!this.client) await this.init();
            const col = this.getCollection();

            // Добавляем _id = timeframe для удобства поиска
            const doc = {
                _id: timeframe,
                ...snapshot,
                updatedAt: Date.now() // Ensure freshness
            };

            await col.updateOne(
                { _id: timeframe },
                { $set: doc },
                { upsert: true }
            );

            logger.info(
                `✅ [MONGO] Saved ${timeframe} (${snapshot.coinsNumber} coins)`,
                DColors.green
            );
        } catch (error) {
            logger.error(
                `❌ [MONGO] Error saving ${timeframe}: ${error}`,
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
            if (!this.client) await this.init();
            const col = this.getCollection();

            const doc = await col.findOne({ _id: timeframe });

            if (!doc) {
                logger.info(
                    `ℹ️ [MONGO] No cache found for ${timeframe}`,
                    DColors.yellow
                );
                return null;
            }

            // Удаляем _id перед возвратом, чтобы соответствовать интерфейсу MarketData (опционально, но чисто)
            const { _id, ...data } = doc;

            const ageMinutes = Math.round((Date.now() - data.updatedAt) / 60000);
            logger.info(
                `✅ [MONGO] Retrieved ${timeframe}: ${data.coinsNumber} coins, age: ${ageMinutes}m`,
                DColors.cyan
            );

            return data as MarketData;
        } catch (error) {
            logger.error(
                `❌ [MONGO] Error getting ${timeframe}: ${error}`,
                DColors.red
            );
            return null;
        }
    }

    /**
     * Получить все данные
     */
    static async getAll(): Promise<MarketData[]> {
        try {
            if (!this.client) await this.init();
            const col = this.getCollection();

            const docs = await col.find({}).toArray();

            if (docs.length === 0) {
                logger.info("ℹ️ [MONGO] Collection is empty", DColors.yellow);
                return [];
            }

            // Мапим, убирая _id если нужно, или просто возвращаем
            const results = docs.map(doc => {
                const { _id, ...data } = doc;
                return data as MarketData;
            });

            logger.info(
                `✅ [MONGO] Retrieved ${results.length} timeframes`,
                DColors.cyan
            );

            return results;
        } catch (error) {
            logger.error(`❌ [MONGO] Error getting all data: ${error}`, DColors.red);
            return [];
        }
    }

    /**
     * Очистить коллекцию
     */
    static async clear(): Promise<void> {
        try {
            if (!this.client) await this.init();
            const col = this.getCollection();

            const result = await col.deleteMany({});

            logger.info(
                `✅ [MONGO] Cleared collection (${result.deletedCount} docs deleted)`,
                DColors.green
            );
        } catch (error) {
            logger.error(`❌ [MONGO] Error clearing collection: ${error}`, DColors.red);
            throw error;
        }
    }
}
