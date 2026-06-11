/**
 * Pharmacy Inventory Analytics Module
 * Industry-standard analytics: KPIs, ABC analysis, slow-moving, waste, FEFO
 * Aligns with Leafio, Datarithm, PrimeRx, KeHE best practices
 */

(function() {
  'use strict';

  const DAYS_NEAR_EXPIRY = 30;
  const DAYS_DEAD_STOCK = 90;
  const ABC_A_PERCENT = 0.8;  // 80% of value
  const ABC_B_PERCENT = 0.95; // 95% cumulative

  /**
   * Fetch all dispensing records for velocity/turnover (single query)
   */
  async function _getDispensingAggregates(orgId, daysBack) {
    const supabase = await window.getPharmacySupabaseClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const { data } = await supabase
      .from('dispensing_records')
      .select('inventory_id, quantity_dispensed, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', cutoff.toISOString())
      .eq('status', 'dispensed');
    const byInv = {};
    (data || []).forEach(r => {
      const id = r.inventory_id;
      if (!id) return;
      if (!byInv[id]) byInv[id] = { total: 0, lastDate: null };
      byInv[id].total += r.quantity_dispensed || 0;
      const d = r.created_at ? new Date(r.created_at).getTime() : 0;
      if (!byInv[id].lastDate || d > byInv[id].lastDate) byInv[id].lastDate = d;
    });
    return { byInv, daysBack };
  }

  /**
   * Compute sales velocity (units per day) from dispensing records
   */
  window.computeSalesVelocity = async function(inventoryId, daysBack = 90) {
    const orgId = await window.getPharmacyOrgId();
    const { byInv, daysBack: d } = await _getDispensingAggregates(orgId, daysBack);
    const agg = byInv[inventoryId];
    const total = agg ? agg.total : 0;
    return d > 0 ? total / d : 0;
  };

  /**
   * Compute Weeks of Supply (WOS) = Quantity on Hand / (Sales Velocity * 7)
   */
  window.computeWOS = function(qtyOnHand, salesVelocityPerDay) {
    if (!salesVelocityPerDay || salesVelocityPerDay <= 0) return null;
    return (qtyOnHand / (salesVelocityPerDay * 7)).toFixed(1);
  };

  /**
   * Compute inventory turnover rate (turns per year)
   */
  window.computeTurnoverRate = async function(inventoryId, daysBack = 365) {
    const velocity = await window.computeSalesVelocity(inventoryId, daysBack);
    const inv = (await window.getMedicationInventory()).find(i => i.id === inventoryId);
    if (!inv || !inv.current_stock || inv.current_stock <= 0) return null;
    const annualSales = velocity * 365;
    return (annualSales / inv.current_stock).toFixed(2);
  };

  /**
   * Compute carrying cost (simplified: cost * stock * monthly holding %)
   */
  window.computeCarryingCost = function(costPerUnit, qtyOnHand, monthlyHoldingPercent = 0.02) {
    if (!costPerUnit || !qtyOnHand) return null;
    return (costPerUnit * qtyOnHand * monthlyHoldingPercent).toFixed(2);
  };

  /**
   * Get enriched inventory with computed fields (optimized: single dispense query)
   */
  window.getEnrichedInventory = async function() {
    const inventory = await window.getMedicationInventory();
    const orgId = await window.getPharmacyOrgId();
    const { byInv: byInv90, daysBack: d90 } = await _getDispensingAggregates(orgId, 90);
    const { byInv: byInv365 } = await _getDispensingAggregates(orgId, 365);
    const enriched = [];
    for (const item of inventory) {
      const agg90 = byInv90[item.id];
      const agg365 = byInv365[item.id];
      const velocity = agg90 ? agg90.total / d90 : 0;
      const annualSales = agg365 ? agg365.total : velocity * 365;
      const wos = window.computeWOS(item.current_stock, velocity);
      const turnover = item.current_stock > 0 ? (annualSales / item.current_stock).toFixed(2) : null;
      const carryingCost = window.computeCarryingCost(item.cost_per_unit, item.current_stock);
      const reorderLevel = item.reorder_point ?? item.minimum_stock ?? 0;
      let status = 'In Stock';
      if (item.current_stock === 0) status = 'Out of Stock';
      else if (item.current_stock <= reorderLevel) status = 'Low Stock';
      else if (item.current_stock >= (item.maximum_stock || 9999) * 0.9) status = 'Overstock';
      const expiryDate = item.expiry_date ? new Date(item.expiry_date) : null;
      const daysToExpiry = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
      const nearExpiry = daysToExpiry !== null && daysToExpiry <= DAYS_NEAR_EXPIRY && daysToExpiry > 0;
      const expired = daysToExpiry !== null && daysToExpiry <= 0;
      const lastSold = item.last_dispensed_at ? new Date(item.last_dispensed_at) : null;
      const daysSinceSold = lastSold ? Math.ceil((new Date() - lastSold) / (1000 * 60 * 60 * 24)) : null;
      const deadStock = daysSinceSold !== null && daysSinceSold > DAYS_DEAD_STOCK;
      enriched.push({
        ...item,
        sales_velocity_per_day: velocity,
        weeks_of_supply: wos,
        inventory_turnover_rate: turnover,
        carrying_cost: carryingCost,
        status,
        near_expiry: nearExpiry,
        expired,
        days_to_expiry: daysToExpiry,
        last_sold_date: item.last_dispensed_at,
        days_since_sold: daysSinceSold,
        dead_stock: deadStock,
        quantity_on_hand: item.current_stock,
        reorder_level: reorderLevel,
        sku_ndc: item.ndc || item.sku,
        cost_price: item.cost_per_unit,
        selling_price: item.selling_price_per_unit,
        location: item.warehouse_location || item.shelf_location,
        pack_size: item.pack_size,
        category_type: item.therapeutic_category || (item.controlled_substance ? 'Controlled' : 'General'),
        on_purchase_order: item.on_purchase_order ?? 0,
        on_sales_order: item.on_sales_order ?? 0,
        last_received_date: item.last_received_date
      });
    }
    return enriched;
  };

  /**
   * ABC Analysis: classify items by value (A=high, B=medium, C=low)
   */
  window.runABCAnalysis = async function() {
    const inventory = await window.getEnrichedInventory();
    const cost = (i) => i.cost_price ?? i.cost_per_unit ?? 0;
    const qty = (i) => i.quantity_on_hand ?? i.current_stock ?? 0;
    const withValue = inventory
      .filter(i => cost(i) * qty(i) > 0)
      .map(i => ({ ...i, totalValue: cost(i) * qty(i) }));
    withValue.sort((a, b) => b.totalValue - a.totalValue);
    const grandTotal = withValue.reduce((s, i) => s + i.totalValue, 0);
    let cum = 0;
    const result = withValue.map(i => {
      cum += i.totalValue;
      const pct = grandTotal > 0 ? cum / grandTotal : 0;
      let abc = 'C';
      if (pct <= ABC_A_PERCENT) abc = 'A';
      else if (pct <= ABC_B_PERCENT) abc = 'B';
      return { ...i, abc_class: abc, cumulative_pct: (pct * 100).toFixed(1) };
    });
    return result;
  };

  /**
   * Slow-moving and dead stock report
   */
  window.getSlowMovingReport = async function() {
    const inventory = await window.getEnrichedInventory();
    return inventory.filter(i => i.dead_stock || (i.days_since_sold > 60 && i.days_since_sold <= DAYS_DEAD_STOCK));
  };

  /**
   * Near-expiry and expired items (FEFO prioritization)
   */
  window.getExpiryRiskReport = async function() {
    const inventory = await window.getEnrichedInventory();
    return inventory
      .filter(i => i.expired || i.near_expiry)
      .sort((a, b) => (a.days_to_expiry ?? 9999) - (b.days_to_expiry ?? 9999));
  };

  /**
   * FEFO: sort inventory by expiry (first expired first out)
   */
  window.sortByFEFO = function(items) {
    return [...items].sort((a, b) => {
      const da = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
      const db = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
      return da - db;
    });
  };

  /**
   * Dashboard KPIs
   */
  window.getInventoryKPIs = async function() {
    const inventory = await window.getEnrichedInventory();
    const cost = (i) => i.cost_price ?? i.cost_per_unit ?? 0;
    const qty = (i) => i.quantity_on_hand ?? i.current_stock ?? 0;
    const totalValue = inventory.reduce((s, i) => s + cost(i) * qty(i), 0);
    const lowStockCount = inventory.filter(i => i.status === 'Low Stock').length;
    const outOfStockCount = inventory.filter(i => i.status === 'Out of Stock').length;
    const nearExpiryCount = inventory.filter(i => i.near_expiry && !i.expired).length;
    const expiredCount = inventory.filter(i => i.expired).length;
    const deadStockCount = inventory.filter(i => i.dead_stock).length;
    const avgTurnover = inventory.filter(i => i.inventory_turnover_rate).length > 0
      ? (inventory.reduce((s, i) => s + parseFloat(i.inventory_turnover_rate || 0), 0) / inventory.filter(i => i.inventory_turnover_rate).length).toFixed(2)
      : null;
    return {
      totalItems: inventory.length,
      totalValue,
      lowStockCount,
      outOfStockCount,
      nearExpiryCount,
      expiredCount,
      deadStockCount,
      avgTurnover,
      criticalAlerts: outOfStockCount + expiredCount,
      warningAlerts: lowStockCount + nearExpiryCount
    };
  };

  /**
   * Sales trend data (last N days)
   */
  window.getSalesTrendData = async function(days = 30) {
    const supabase = await window.getPharmacySupabaseClient();
    const orgId = await window.getPharmacyOrgId();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const { data } = await supabase
      .from('dispensing_records')
      .select('quantity_dispensed, created_at, total_price')
      .eq('organization_id', orgId)
      .gte('created_at', cutoff.toISOString())
      .eq('status', 'dispensed');
    const byDate = {};
    (data || []).forEach(r => {
      const d = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = { units: 0, revenue: 0 };
      byDate[d].units += r.quantity_dispensed || 0;
      byDate[d].revenue += r.total_price || 0;
    });
    const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([date, v]) => ({ date, ...v }));
  };

  /**
   * Inventory distribution by category
   */
  window.getInventoryByCategory = async function() {
    const inventory = await window.getEnrichedInventory();
    const byCat = {};
    const cost = (i) => i.cost_price ?? i.cost_per_unit ?? 0;
    const qty = (i) => i.quantity_on_hand ?? i.current_stock ?? 0;
    inventory.forEach(i => {
      const cat = i.category_type || 'Uncategorized';
      if (!byCat[cat]) byCat[cat] = { count: 0, value: 0 };
      byCat[cat].count++;
      byCat[cat].value += cost(i) * qty(i);
    });
    return Object.entries(byCat).map(([name, v]) => ({ category: name, ...v }));
  };

  /**
   * Top-selling items
   */
  window.getTopSellingItems = async function(limit = 10, daysBack = 30) {
    const supabase = await window.getPharmacySupabaseClient();
    const orgId = await window.getPharmacyOrgId();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const { data } = await supabase
      .from('dispensing_records')
      .select('medication_name, strength, form, quantity_dispensed, inventory_id')
      .eq('organization_id', orgId)
      .gte('created_at', cutoff.toISOString())
      .eq('status', 'dispensed');
    const byItem = {};
    (data || []).forEach(r => {
      const key = `${r.medication_name}|${r.strength}|${r.form}`;
      if (!byItem[key]) byItem[key] = { name: r.medication_name, strength: r.strength, form: r.form, quantity: 0 };
      byItem[key].quantity += r.quantity_dispensed || 0;
    });
    return Object.values(byItem).sort((a, b) => b.quantity - a.quantity).slice(0, limit);
  };

})();
