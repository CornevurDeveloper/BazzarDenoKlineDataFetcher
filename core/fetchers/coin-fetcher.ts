import { load } from "@std/dotenv";

export async function fetchCoins() {
  try {
    // Ensure environment variables are loaded
    await load({ export: true });

    const url = Deno.env.get("COIN_SIFTER_URL") + "/coins/formatted-symbols";
    const token = Deno.env.get("SECRET_TOKEN");

    if (!Deno.env.get("COIN_SIFTER_URL") || !token) {
      console.error(
        "Error: COIN_SIFTER_URL or SECRET_TOKEN is not set in environment."
      );
      throw new Error("Missing server configuration");
    }

    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": token!, // '!' означает "non-null assertion", т.к. мы проверили выше
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Типизируем ответ от 'node-fetch@2'
    const data: any = await response.json();
    const rawSymbols = data.symbols;

    // Normalize exchange names to lowercase
    const coins = rawSymbols.map((coin: any) => ({
      ...coin,
      exchanges: coin.exchanges?.map((ex: string) => ex.toLowerCase()) || [],
    }));

    return coins;
  } catch (error) {
    console.error("Failed to fetch or parse coins data:", error);
    throw error;
  }
}
