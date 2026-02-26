import { mulberry32 } from "../../services/whimsy.js";

/**
 * Supply Chain Marathon: Manage a multi-warehouse supply chain over 30 periods.
 * Agent checks in periodically to receive orders, disruptions, and price changes,
 * then decides how to allocate fulfillment across warehouses.
 * Long-running: 1 hour, heartbeat every 5 minutes.
 */

export interface Product {
  id: string;
  name: string;
  base_cost: number;
  base_price: number;
  shelf_life: number; // periods before expiry
}

export interface Warehouse {
  id: string;
  name: string;
  capacity: number;
  operating_cost: number;
}

export interface Order {
  id: string;
  product_id: string;
  quantity: number;
  deadline_period: number;
  revenue: number; // price * quantity at time of order
}

export interface Disruption {
  id: string;
  warehouse_id: string;
  type: string;
  severity: number; // 0.1-0.5 (percentage impact)
  start_period: number;
  duration_periods: number;
}

export interface PriceChange {
  product_id: string;
  new_price: number;
  period: number;
}

export interface PeriodData {
  period: number;
  orders: Order[];
  disruptions: Disruption[];
  price_changes: PriceChange[];
}

export interface SupplyChainGroundTruth {
  optimal_profit: number;
  optimal_fulfillment: number; // 0-1 ratio
  total_orders: number;
  total_revenue: number;
  periods: PeriodData[];
}

export interface SupplyChainData {
  products: Product[];
  warehouses: Warehouse[];
  periods: PeriodData[];
  groundTruth: SupplyChainGroundTruth;
  objective: string;
}

const PRODUCT_NAMES = [
  "Abyssal Kelp Extract",
  "Pressurized Coral Compound",
  "Deep-Sea Luminite",
  "Thermal Vent Catalyst",
  "Tidal Iron Ore",
];

const WAREHOUSE_NAMES = [
  "Riftwall Depot",
  "Coral Basin Hub",
  "Trench Floor Vault",
];

const DISRUPTION_TYPES = ["supply_delay", "capacity_reduction", "cost_increase", "quality_issue"];

export function generateSupplyChainData(seed: number): SupplyChainData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const randFloat = (min: number, max: number) => min + rng() * (max - min);

  // ── Generate 5 products ──────────────────────────────────────────────
  const products: Product[] = PRODUCT_NAMES.map((name, i) => ({
    id: `PROD-${String(i + 1).padStart(2, "0")}`,
    name,
    base_cost: randInt(10, 40),
    base_price: randInt(50, 120),
    shelf_life: randInt(3, 10),
  }));

  // ── Generate 3 warehouses ────────────────────────────────────────────
  const warehouses: Warehouse[] = WAREHOUSE_NAMES.map((name, i) => ({
    id: `WH-${String(i + 1).padStart(2, "0")}`,
    name,
    capacity: randInt(80, 200),
    operating_cost: randInt(5, 20),
  }));

  // ── Generate 30 periods ──────────────────────────────────────────────
  const periods: PeriodData[] = [];
  let orderCounter = 0;
  let disruptionCounter = 0;
  const allOrders: Order[] = [];
  const allDisruptions: Disruption[] = [];
  const allPriceChanges: PriceChange[] = [];

  // Track current prices (may change over time)
  const currentPrices = new Map<string, number>();
  for (const p of products) {
    currentPrices.set(p.id, p.base_price);
  }

  for (let period = 1; period <= 30; period++) {
    const periodOrders: Order[] = [];
    const periodDisruptions: Disruption[] = [];
    const periodPriceChanges: PriceChange[] = [];

    // Orders: 0-3 per period
    const orderCount = randInt(0, 3);
    for (let o = 0; o < orderCount; o++) {
      orderCounter++;
      const product = pick(products);
      const quantity = randInt(1, 15);
      const price = currentPrices.get(product.id)!;
      const order: Order = {
        id: `ORD-${String(orderCounter).padStart(3, "0")}`,
        product_id: product.id,
        quantity,
        deadline_period: Math.min(30, period + randInt(1, 5)),
        revenue: price * quantity,
      };
      periodOrders.push(order);
      allOrders.push(order);
    }

    // Disruptions: 0-1 per period, ~8 total across all periods
    // Use a probability that yields roughly 8 disruptions over 30 periods
    if (rng() < 0.27) {
      disruptionCounter++;
      const warehouse = pick(warehouses);
      const disruption: Disruption = {
        id: `DISR-${String(disruptionCounter).padStart(2, "0")}`,
        warehouse_id: warehouse.id,
        type: pick(DISRUPTION_TYPES),
        severity: Math.round(randFloat(0.1, 0.5) * 100) / 100,
        start_period: period,
        duration_periods: randInt(1, 4),
      };
      periodDisruptions.push(disruption);
      allDisruptions.push(disruption);
    }

    // Price changes: 0-1 per period
    if (rng() < 0.2) {
      const product = pick(products);
      const currentPrice = currentPrices.get(product.id)!;
      // Price changes by -30% to +30%
      const multiplier = randFloat(0.7, 1.3);
      const newPrice = Math.round(currentPrice * multiplier);
      currentPrices.set(product.id, newPrice);
      const priceChange: PriceChange = {
        product_id: product.id,
        new_price: newPrice,
        period,
      };
      periodPriceChanges.push(priceChange);
      allPriceChanges.push(priceChange);
    }

    periods.push({
      period,
      orders: periodOrders,
      disruptions: periodDisruptions,
      price_changes: periodPriceChanges,
    });
  }

  // ── Compute optimal strategy ─────────────────────────────────────────
  // For each order, determine cheapest warehouse to fulfill from
  // considering base cost, operating cost, and active disruptions.

  let optimalProfit = 0;
  let fulfilledOrders = 0;

  for (const order of allOrders) {
    const product = products.find((p) => p.id === order.product_id)!;

    // Find cheapest warehouse at the order's period
    let bestCost = Infinity;

    for (const wh of warehouses) {
      // Check for active disruptions at this warehouse during the order deadline
      const activeDisruptions = allDisruptions.filter(
        (d) =>
          d.warehouse_id === wh.id &&
          d.start_period <= order.deadline_period &&
          d.start_period + d.duration_periods > order.deadline_period,
      );

      let fulfillmentCost = product.base_cost * order.quantity + wh.operating_cost;

      // Apply disruption effects
      let canFulfill = true;
      for (const d of activeDisruptions) {
        switch (d.type) {
          case "supply_delay":
            // Delays may prevent fulfillment if deadline is tight
            if (order.deadline_period - d.start_period < d.duration_periods) {
              canFulfill = false;
            }
            break;
          case "capacity_reduction":
            // Reduced capacity may not fit the order
            if (order.quantity > wh.capacity * (1 - d.severity)) {
              canFulfill = false;
            }
            break;
          case "cost_increase":
            fulfillmentCost *= 1 + d.severity;
            break;
          case "quality_issue":
            // Quality issues add rework cost
            fulfillmentCost *= 1 + d.severity * 0.5;
            break;
        }
      }

      if (canFulfill && fulfillmentCost < bestCost) {
        bestCost = fulfillmentCost;
      }
    }

    if (bestCost < Infinity) {
      optimalProfit += order.revenue - bestCost;
      fulfilledOrders++;
    }
  }

  const totalOrders = allOrders.length;
  const totalRevenue = allOrders.reduce((sum, o) => sum + o.revenue, 0);
  const optimalFulfillment = totalOrders > 0 ? fulfilledOrders / totalOrders : 1;

  const groundTruth: SupplyChainGroundTruth = {
    optimal_profit: Math.round(optimalProfit),
    optimal_fulfillment: Math.round(optimalFulfillment * 1000) / 1000,
    total_orders: totalOrders,
    total_revenue: totalRevenue,
    periods,
  };

  const objective =
    `Manage a supply chain with ${products.length} products across ${warehouses.length} warehouses over 30 periods. ` +
    `Check in periodically to receive orders, monitor disruptions, and adapt to price changes. ` +
    `Decide which warehouse fulfills each order to maximise profit and fulfillment rate. ` +
    `You have 1 hour. Send heartbeats every 5 minutes. ` +
    `Submit: total_profit, fulfillment_ratio (0-1), orders_fulfilled, orders_total, and a decisions array ` +
    `[{order_id, warehouse_id}] for each order you fulfilled.`;

  return {
    products,
    warehouses,
    periods,
    groundTruth,
    objective,
  };
}
