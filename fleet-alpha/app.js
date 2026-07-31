(() => {
  "use strict";

  const SCHEMA_VERSION = 2;
  const STORAGE_KEY = "fleet-alpha:v2";
  const RECORD_TYPES = ["earnings", "offers", "payoffs", "maintenance", "incidents"];
  const TYPE_LABELS = {
    earnings: "Earnings", offers: "Offers", payoffs: "Payoffs",
    maintenance: "Maintenance", incidents: "Incidents"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const currentMonth = () => today().slice(0, 7);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const nullableNumber = value => value === "" || value == null ? null : number(value);
  const monthLabel = month => {
    if (!month) return "—";
    const [year, part] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, part - 1, 1));
  };
  const dateLabel = value => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)) : "—";
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const vehicleName = vehicle => vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}` : "Unknown vehicle";
  const byDateDesc = (a, b) => String(b.date || b.month || "").localeCompare(String(a.date || a.month || ""));

  const demoData = () => ({
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    vehicles: [
      {
        id: "demo_vehicle_aurora", year: 2023, make: "Northstar", model: "Aurora", trim: "Touring",
        financeType: "loan", acquisitionDate: "2024-02-15", acquisitionCash: 6200,
        monthlyPayment: 725, insurance: 168, maintenanceReserve: 95, currentMileage: 28640,
        leaseTerm: null, annualMileageAllowance: null, residual: null, currentPayoff: 32100,
        estimatedMarketValue: 35400, monthlyDepreciation: 410,
        notes: "Fictional demo vehicle. Replace with your own data."
      },
      {
        id: "demo_vehicle_bay", year: 2022, make: "Crescent", model: "Bay", trim: "EX",
        financeType: "lease", acquisitionDate: "2024-08-01", acquisitionCash: 3500,
        monthlyPayment: 548, insurance: 142, maintenanceReserve: 80, currentMileage: 19120,
        leaseTerm: 36, annualMileageAllowance: 12000, residual: 23800, currentPayoff: 26750,
        estimatedMarketValue: 27400, monthlyDepreciation: 330,
        notes: "Fictional demo vehicle. All values are illustrative."
      }
    ],
    earnings: [
      { id: "demo_earn_1", vehicleId: "demo_vehicle_aurora", month: shiftMonth(currentMonth(), -2), revenue: 2440, maintenance: 60, otherCosts: 95, bookedDays: 18, miles: 1520, source: "demo", reservationId: "", notes: "Fictional demo month" },
      { id: "demo_earn_2", vehicleId: "demo_vehicle_aurora", month: shiftMonth(currentMonth(), -1), revenue: 2280, maintenance: 35, otherCosts: 110, bookedDays: 16, miles: 1375, source: "demo", reservationId: "", notes: "Fictional demo month" },
      { id: "demo_earn_3", vehicleId: "demo_vehicle_aurora", month: currentMonth(), revenue: 2310, maintenance: 20, otherCosts: 88, bookedDays: 15, miles: 1210, source: "demo", reservationId: "", notes: "Fictional demo month" },
      { id: "demo_earn_4", vehicleId: "demo_vehicle_bay", month: shiftMonth(currentMonth(), -2), revenue: 1540, maintenance: 0, otherCosts: 74, bookedDays: 12, miles: 870, source: "demo", reservationId: "", notes: "Fictional demo month" },
      { id: "demo_earn_5", vehicleId: "demo_vehicle_bay", month: shiftMonth(currentMonth(), -1), revenue: 1370, maintenance: 125, otherCosts: 68, bookedDays: 10, miles: 710, source: "demo", reservationId: "", notes: "Fictional demo month" },
      { id: "demo_earn_6", vehicleId: "demo_vehicle_bay", month: currentMonth(), revenue: 1180, maintenance: 40, otherCosts: 66, bookedDays: 8, miles: 590, source: "demo", reservationId: "", notes: "Fictional demo month" }
    ],
    offers: [
      { id: "demo_offer_1", vehicleId: "demo_vehicle_aurora", date: today(), source: "Demo Auto Buyer", amount: 34800, expiresAt: shiftDate(today(), 7), verified: true, notes: "Fictional executable offer" },
      { id: "demo_offer_2", vehicleId: "demo_vehicle_bay", date: shiftDate(today(), -8), source: "Demo Marketplace", amount: 26900, expiresAt: shiftDate(today(), 3), verified: true, notes: "Fictional executable offer" }
    ],
    payoffs: [
      { id: "demo_payoff_1", vehicleId: "demo_vehicle_aurora", date: today(), amount: 32100, lender: "Demo Credit Union", verified: true, notes: "Fictional payoff quote" },
      { id: "demo_payoff_2", vehicleId: "demo_vehicle_bay", date: today(), amount: 26750, lender: "Demo Lease Co.", verified: true, notes: "Fictional payoff quote" }
    ],
    maintenance: [
      { id: "demo_maint_1", vehicleId: "demo_vehicle_aurora", date: shiftDate(today(), -42), category: "Tires", amount: 640, mileage: 27105, notes: "Fictional service record" }
    ],
    incidents: [
      { id: "demo_incident_1", vehicleId: "demo_vehicle_bay", date: shiftDate(today(), -74), type: "Minor damage", status: "Closed", claimAmount: 420, outOfPocket: 100, notes: "Fictional claim record" }
    ],
    importedReservations: [],
    settings: {
      holdThreshold: 175, prepareThreshold: -75, loanPayoffDecline: 430,
      averageMonths: 3, saleFrictionPct: 2.5, currency: "USD"
    }
  });

  function shiftMonth(month, delta) {
    const [year, part] = month.split("-").map(Number);
    const date = new Date(year, part - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function shiftDate(dateString, delta) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + delta);
    return date.toISOString().slice(0, 10);
  }

  function migrate(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Stored data is not an object.");
    if (number(raw.schemaVersion) > SCHEMA_VERSION) throw new Error("This data was created by a newer Fleet Alpha version.");
    const base = demoData();
    const migrated = {
      schemaVersion: SCHEMA_VERSION,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      vehicles: Array.isArray(raw.vehicles) ? raw.vehicles : [],
      earnings: Array.isArray(raw.earnings) ? raw.earnings : [],
      offers: Array.isArray(raw.offers) ? raw.offers : [],
      payoffs: Array.isArray(raw.payoffs) ? raw.payoffs : [],
      maintenance: Array.isArray(raw.maintenance) ? raw.maintenance : [],
      incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
      importedReservations: Array.isArray(raw.importedReservations) ? raw.importedReservations : [],
      settings: { ...base.settings, ...(raw.settings || {}) }
    };
    validateData(migrated);
    return migrated;
  }

  function validateData(candidate) {
    if (!candidate || typeof candidate !== "object") throw new Error("Backup root must be an object.");
    if (number(candidate.schemaVersion) > SCHEMA_VERSION) throw new Error(`Schema version ${candidate.schemaVersion} is not supported.`);
    ["vehicles", ...RECORD_TYPES, "importedReservations"].forEach(key => {
      if (!Array.isArray(candidate[key])) throw new Error(`“${key}” must be an array.`);
      candidate[key].forEach((record, index) => {
        if (!record || typeof record !== "object" || !String(record.id || "").trim()) {
          throw new Error(`“${key}” record ${index + 1} needs a valid id.`);
        }
      });
    });
    if (!candidate.settings || typeof candidate.settings !== "object") throw new Error("Settings are missing.");
    const vehicleIds = new Set(candidate.vehicles.map(item => item.id));
    RECORD_TYPES.forEach(key => candidate[key].forEach(record => {
      if (!vehicleIds.has(record.vehicleId)) throw new Error(`A ${key} record references a missing vehicle.`);
    }));
    return true;
  }

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoData();
    try {
      return migrate(JSON.parse(raw));
    } catch (error) {
      console.warn("Fleet Alpha recovered from corrupt local data:", error.message);
      const recovered = demoData();
      recovered.recoveryNotice = `Saved browser data could not be loaded (${error.message}). Fictional demo data was restored.`;
      return recovered;
    }
  }

  let state = loadData();
  let activeView = "dashboard";
  let activeRecordType = "earnings";
  let editorContext = null;
  let pendingConfirmation = null;
  let importRows = [];

  function saveData(message = "") {
    state.updatedAt = new Date().toISOString();
    state.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    if (message) toast(message);
  }

  function money(value, { compact = false } = {}) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: state.settings.currency || "USD",
      maximumFractionDigits: 0, notation: compact ? "compact" : "standard"
    }).format(number(value));
  }

  function integer(value) {
    if (value == null || value === "") return "—";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number(value));
  }

  function findVehicle(id) {
    return state.vehicles.find(vehicle => vehicle.id === id);
  }

  function latestRecord(type, vehicleId) {
    return state[type].filter(item => item.vehicleId === vehicleId).sort(byDateDesc)[0] || null;
  }

  function monthlyEarnings(vehicleId) {
    const groups = new Map();
    state.earnings.filter(item => item.vehicleId === vehicleId).forEach(item => {
      if (!groups.has(item.month)) groups.set(item.month, { month: item.month, revenue: 0, maintenance: 0, otherCosts: 0, bookedDays: 0, miles: 0 });
      const group = groups.get(item.month);
      ["revenue", "maintenance", "otherCosts", "bookedDays", "miles"].forEach(key => { group[key] += number(item[key]); });
    });
    return [...groups.values()].sort((a, b) => b.month.localeCompare(a.month));
  }

  function vehicleEconomics(vehicle) {
    const earnings = monthlyEarnings(vehicle.id);
    const latest = earnings[0] || null;
    const fixedCost = number(vehicle.monthlyPayment) + number(vehicle.insurance) + number(vehicle.maintenanceReserve);
    const latestProfit = latest ? number(latest.revenue) - number(vehicle.monthlyPayment) - number(vehicle.insurance) - number(latest.maintenance) - number(latest.otherCosts) : null;
    const payoffRecord = latestRecord("payoffs", vehicle.id);
    const payoff = payoffRecord ? number(payoffRecord.amount) : nullableNumber(vehicle.currentPayoff);
    const validOffers = state.offers.filter(item => item.vehicleId === vehicle.id && (!item.expiresAt || item.expiresAt >= today()));
    const bestOffer = validOffers.sort((a, b) => number(b.amount) - number(a.amount))[0] || null;
    const exitValue = bestOffer ? number(bestOffer.amount) : nullableNumber(vehicle.estimatedMarketValue);
    const equity = exitValue != null && payoff != null ? exitValue - payoff : null;
    const window = earnings.slice(0, number(state.settings.averageMonths) || 3);
    const profits = window.map(item => number(item.revenue) - number(vehicle.monthlyPayment) - number(vehicle.insurance) - number(item.maintenance) - number(item.otherCosts));
    const averageProfit = profits.length ? profits.reduce((a, b) => a + b, 0) / profits.length : null;
    const depreciation = nullableNumber(vehicle.monthlyDepreciation);
    const holdValue = averageProfit != null && depreciation != null ? averageProfit - depreciation : null;
    const trend = profits.length >= 2 ? profits[0] - profits[profits.length - 1] : 0;

    let status = "ADD DATA";
    let reason = "Add payoff, current market or offer value, depreciation, and earnings to unlock a recommendation.";
    if (payoff != null && exitValue != null && depreciation != null && averageProfit != null) {
      if (holdValue < number(state.settings.prepareThreshold) && (equity >= 0 || holdValue < -Math.max(100, depreciation * .5))) {
        status = "SELL NOW";
        reason = `Waiting is estimated to cost ${money(Math.abs(holdValue))} next month${equity >= 0 ? ` while ${money(equity)} of equity is available` : ""}.`;
      } else if (holdValue < number(state.settings.holdThreshold) || trend < -Math.max(100, Math.abs(averageProfit) * .2)) {
        status = "PREPARE TO SELL";
        reason = trend < -Math.max(100, Math.abs(averageProfit) * .2)
          ? `Recent monthly profit has declined by about ${money(Math.abs(trend))}.`
          : `Holding adds only about ${money(holdValue)} after expected depreciation.`;
      } else {
        status = "HOLD";
        reason = `Expected profit exceeds depreciation by about ${money(holdValue)} next month.`;
      }
    }
    return { latest, latestProfit, fixedCost, payoff, payoffRecord, bestOffer, exitValue, equity, averageProfit, depreciation, holdValue, trend, status, reason };
  }

  function renderAll() {
    renderDashboard();
    renderVehicles();
    renderRecordTabs();
    renderRecords();
    renderForecast();
    renderReservations();
    populateSettings();
  }

  function renderDashboard() {
    const economics = state.vehicles.map(vehicle => ({ vehicle, ...vehicleEconomics(vehicle) }));
    const thisMonthProfit = state.vehicles.reduce((sum, vehicle) => {
      const records = state.earnings.filter(item => item.vehicleId === vehicle.id && item.month === currentMonth());
      if (!records.length) return sum;
      return sum + records.reduce((subtotal, item) => subtotal + number(item.revenue) - number(item.maintenance) - number(item.otherCosts), 0) - number(vehicle.monthlyPayment) - number(vehicle.insurance);
    }, 0);
    const lifetime = state.vehicles.reduce((sum, vehicle) => sum + monthlyEarnings(vehicle.id).reduce((subtotal, item) =>
      subtotal + number(item.revenue) - number(item.maintenance) - number(item.otherCosts) - number(vehicle.monthlyPayment) - number(vehicle.insurance), 0), 0);
    const attention = economics.filter(item => item.status !== "HOLD").length;
    $("#kpis").innerHTML = [
      ["Active vehicles", state.vehicles.length, "Tracked assets"],
      ["This month profit", money(thisMonthProfit), currentMonth() === (economics[0]?.latest?.month || "") ? "Operating result" : "Based on entered data"],
      ["Lifetime net earnings", money(lifetime), "All recorded months"],
      ["Need attention", attention, attention === 1 ? "Vehicle" : "Vehicles"]
    ].map(([label, value, note]) => `<article class="kpi"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></article>`).join("");

    const cards = $("#cards");
    if (!state.vehicles.length) {
      cards.innerHTML = emptyState("No vehicles yet", "Add a vehicle to begin tracking fleet economics.", "add-vehicle", "Add your first vehicle");
      return;
    }
    cards.innerHTML = economics.map(item => {
      const vehicle = item.vehicle;
      const statusClass = { "HOLD": "hold", "PREPARE TO SELL": "prepare", "SELL NOW": "sell", "ADD DATA": "data" }[item.status];
      return `<article class="card">
        <div class="card-top"><div><h3>${escapeHTML(vehicleName(vehicle))}</h3><p class="card-subtitle">${escapeHTML(vehicle.financeType?.toUpperCase() || "FINANCE NOT SET")} · Acquired ${escapeHTML(dateLabel(vehicle.acquisitionDate))}</p></div><span class="status status-${statusClass}">${escapeHTML(item.status)}</span></div>
        <div class="metrics">
          <div class="metric"><span>Latest profit</span><strong class="${number(item.latestProfit) < 0 ? "negative" : "positive"}">${money(item.latestProfit)}</strong></div>
          <div class="metric"><span>Mileage</span><strong>${integer(vehicle.currentMileage)} mi</strong></div>
          <div class="metric"><span>Current equity</span><strong class="${number(item.equity) < 0 ? "negative" : "positive"}">${money(item.equity)}</strong></div>
        </div>
        <p class="reason">${escapeHTML(item.reason)}</p>
        <div class="actions">
          <button type="button" data-action="quick-earning" data-id="${escapeHTML(vehicle.id)}">Add month</button>
          <button type="button" data-action="quick-offer" data-id="${escapeHTML(vehicle.id)}">Add offer</button>
          <button type="button" data-action="show-forecast" data-id="${escapeHTML(vehicle.id)}">View forecast</button>
        </div>
        <details><summary>Economics & data sources</summary><div class="details-grid">
          ${detail("Fixed cost", money(item.fixedCost), "estimate")}
          ${detail("Recent avg. profit", money(item.averageProfit), "estimate")}
          ${detail("Monthly depreciation", money(item.depreciation), "estimate")}
          ${detail("Hold value", money(item.holdValue), "estimate")}
          ${detail("Exit value", money(item.exitValue), item.bestOffer ? "verified" : "estimate")}
          ${detail("Payoff", money(item.payoff), item.payoffRecord?.verified ? "verified" : "estimate")}
        </div></details>
      </article>`;
    }).join("");
  }

  function detail(label, value, source) {
    return `<div class="detail-row"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)} <em class="estimate ${source === "verified" ? "verified" : ""}">${source}</em></strong></div>`;
  }

  function renderVehicles() {
    const container = $("#vehicleTable");
    if (!state.vehicles.length) {
      container.innerHTML = emptyState("Your garage is empty", "Add financing and value assumptions for your first vehicle.", "add-vehicle", "Add vehicle");
      return;
    }
    container.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Vehicle</th><th>Finance</th><th>Mileage</th><th>Payment</th><th>Market / payoff</th><th>Actions</th></tr></thead><tbody>
      ${state.vehicles.map(vehicle => `<tr>
        <td><span class="table-primary">${escapeHTML(vehicleName(vehicle))}</span><span class="table-secondary">${escapeHTML(vehicle.notes || "No notes")}</span></td>
        <td>${escapeHTML(vehicle.financeType || "—")}<span class="table-secondary">${escapeHTML(dateLabel(vehicle.acquisitionDate))}</span></td>
        <td>${integer(vehicle.currentMileage)} mi</td>
        <td>${money(vehicle.monthlyPayment)}<span class="table-secondary">+ ${money(number(vehicle.insurance) + number(vehicle.maintenanceReserve))} reserves</span></td>
        <td>${money(vehicle.estimatedMarketValue)} <span class="estimate">estimate</span><span class="table-secondary">${money(vehicle.currentPayoff)} payoff</span></td>
        <td><div class="actions"><button type="button" data-edit="vehicles" data-id="${escapeHTML(vehicle.id)}">Edit</button><button class="danger" type="button" data-delete="vehicles" data-id="${escapeHTML(vehicle.id)}">Delete</button></div></td>
      </tr>`).join("")}
    </tbody></table></div>`;
  }

  function renderRecordTabs() {
    $("#recordTabs").innerHTML = RECORD_TYPES.map(type => `<button type="button" role="tab" aria-selected="${type === activeRecordType}" data-record-tab="${type}">${TYPE_LABELS[type]} <small>${state[type].length}</small></button>`).join("");
    $("#addRecordBtn").textContent = `Add ${singular(activeRecordType).toLowerCase()}`;
  }

  function renderRecords() {
    const container = $("#recordTable");
    const records = [...state[activeRecordType]].sort(byDateDesc);
    if (!records.length) {
      container.innerHTML = emptyState(`No ${TYPE_LABELS[activeRecordType].toLowerCase()} yet`, `Add a ${singular(activeRecordType).toLowerCase()} record to improve your fleet picture.`, "add-record", `Add ${singular(activeRecordType).toLowerCase()}`);
      return;
    }
    const configs = {
      earnings: { heads: ["Vehicle", "Month", "Revenue", "Operating profit", "Utilization"], cells: earningCells },
      offers: { heads: ["Vehicle", "Date", "Source", "Offer", "Expires"], cells: offerCells },
      payoffs: { heads: ["Vehicle", "Date", "Lender", "Payoff", "Source"], cells: payoffCells },
      maintenance: { heads: ["Vehicle", "Date", "Category", "Cost", "Mileage"], cells: maintenanceCells },
      incidents: { heads: ["Vehicle", "Date", "Type", "Status", "Financial impact"], cells: incidentCells }
    };
    const config = configs[activeRecordType];
    container.innerHTML = `<div class="table-wrap"><table><thead><tr>${config.heads.map(head => `<th>${head}</th>`).join("")}<th>Actions</th></tr></thead><tbody>
      ${records.map(record => `<tr>${config.cells(record)}<td><div class="actions"><button type="button" data-edit="${activeRecordType}" data-id="${escapeHTML(record.id)}">Edit</button><button class="danger" type="button" data-delete="${activeRecordType}" data-id="${escapeHTML(record.id)}">Delete</button></div></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  function earningCells(record) {
    const vehicle = findVehicle(record.vehicleId);
    const profit = number(record.revenue) - number(vehicle?.monthlyPayment) - number(vehicle?.insurance) - number(record.maintenance) - number(record.otherCosts);
    return `<td class="table-primary">${escapeHTML(vehicleName(vehicle))}</td><td>${escapeHTML(monthLabel(record.month))}<span class="table-secondary">${escapeHTML(record.source || "manual")}</span></td><td>${money(record.revenue)}</td><td class="${profit < 0 ? "negative" : "positive"}">${money(profit)}</td><td>${integer(record.bookedDays)} days<span class="table-secondary">${integer(record.miles)} miles</span></td>`;
  }
  function offerCells(record) {
    return `<td class="table-primary">${escapeHTML(vehicleName(findVehicle(record.vehicleId)))}</td><td>${escapeHTML(dateLabel(record.date))}</td><td>${escapeHTML(record.source)}</td><td>${money(record.amount)} ${record.verified ? '<span class="estimate verified">verified</span>' : '<span class="estimate">estimate</span>'}</td><td>${escapeHTML(dateLabel(record.expiresAt))}</td>`;
  }
  function payoffCells(record) {
    return `<td class="table-primary">${escapeHTML(vehicleName(findVehicle(record.vehicleId)))}</td><td>${escapeHTML(dateLabel(record.date))}</td><td>${escapeHTML(record.lender)}</td><td>${money(record.amount)}</td><td>${record.verified ? '<span class="estimate verified">verified</span>' : '<span class="estimate">estimate</span>'}</td>`;
  }
  function maintenanceCells(record) {
    return `<td class="table-primary">${escapeHTML(vehicleName(findVehicle(record.vehicleId)))}</td><td>${escapeHTML(dateLabel(record.date))}</td><td>${escapeHTML(record.category)}</td><td>${money(record.amount)}</td><td>${integer(record.mileage)} mi</td>`;
  }
  function incidentCells(record) {
    return `<td class="table-primary">${escapeHTML(vehicleName(findVehicle(record.vehicleId)))}</td><td>${escapeHTML(dateLabel(record.date))}</td><td>${escapeHTML(record.type)}</td><td>${escapeHTML(record.status)}</td><td>${money(number(record.claimAmount) + number(record.outOfPocket))}<span class="table-secondary">${money(record.outOfPocket)} out of pocket</span></td>`;
  }

  function renderForecast() {
    const container = $("#forecastContent");
    if (!state.vehicles.length) {
      container.innerHTML = emptyState("Nothing to forecast", "Add a vehicle and earnings history to create an outlook.", "add-vehicle", "Add vehicle");
      return;
    }
    container.innerHTML = state.vehicles.map(vehicle => {
      const forecast = buildForecast(vehicle);
      const maxMagnitude = Math.max(1, ...forecast.months.map(item => Math.abs(item.netHold)));
      return `<article class="forecast-card" id="forecast-${escapeHTML(vehicle.id)}">
        <div class="forecast-head"><div><h2>${escapeHTML(vehicleName(vehicle))}</h2><p class="card-subtitle">${escapeHTML(forecast.ready ? "Directional equity and hold-cost outlook" : "More inputs required")}</p></div><span class="status status-${forecast.ready ? "hold" : "data"}">${forecast.ready ? "12 MONTHS" : "ADD DATA"}</span></div>
        <div class="forecast-callout"><strong>${escapeHTML(forecast.exitTitle)}</strong><span>${escapeHTML(forecast.explanation)}</span></div>
        ${forecast.ready ? `<div class="forecast-bars" role="img" aria-label="Projected monthly hold value for ${escapeHTML(vehicleName(vehicle))}">
          ${forecast.months.map(item => `<div class="bar-wrap" title="${escapeHTML(monthLabel(item.month))}: ${escapeHTML(money(item.netHold))} hold value"><div class="bar ${item.netHold < 0 ? "negative" : ""}" style="height:${Math.max(3, Math.abs(item.netHold) / maxMagnitude * 100)}%"></div><span class="bar-label">${escapeHTML(item.month.slice(5))}</span></div>`).join("")}
        </div>` : ""}
        <p class="assumptions">${escapeHTML(forecast.assumptions)}</p>
      </article>`;
    }).join("");
  }

  function buildForecast(vehicle) {
    const economics = vehicleEconomics(vehicle);
    const missing = [];
    if (economics.averageProfit == null) missing.push("recent earnings");
    if (economics.payoff == null) missing.push("payoff");
    if (economics.exitValue == null) missing.push("market value or offer");
    if (economics.depreciation == null) missing.push("depreciation");
    if (missing.length) {
      return { ready: false, months: [], exitTitle: "Add data to generate an exit window", explanation: `Missing ${missing.join(", ")}.`, assumptions: "Forecasts remain hidden until the minimum inputs are present." };
    }
    const months = [];
    const saleFriction = number(state.settings.saleFrictionPct) / 100;
    const acquisition = new Date(`${vehicle.acquisitionDate || today()}T12:00:00`);
    const leaseEnd = vehicle.financeType === "lease" && vehicle.leaseTerm ? new Date(acquisition.getFullYear(), acquisition.getMonth() + number(vehicle.leaseTerm), acquisition.getDate()) : null;
    for (let index = 1; index <= 12; index += 1) {
      const month = shiftMonth(currentMonth(), index);
      const projectedValue = Math.max(0, economics.exitValue - economics.depreciation * index);
      let projectedPayoff;
      if (vehicle.financeType === "lease" && leaseEnd) {
        const remaining = Math.max(0, (leaseEnd.getFullYear() - new Date().getFullYear()) * 12 + leaseEnd.getMonth() - new Date().getMonth());
        const step = remaining ? Math.max(0, (economics.payoff - number(vehicle.residual)) / remaining) : 0;
        projectedPayoff = Math.max(number(vehicle.residual), economics.payoff - step * index);
      } else {
        projectedPayoff = Math.max(0, economics.payoff - number(state.settings.loanPayoffDecline) * index);
      }
      const projectedEquity = projectedValue * (1 - saleFriction) - projectedPayoff;
      const netHold = economics.averageProfit - economics.depreciation;
      months.push({ month, projectedValue, projectedPayoff, projectedEquity, netHold });
    }
    const firstNegative = months.find(item => item.netHold < number(state.settings.prepareThreshold));
    const bestEquity = [...months].sort((a, b) => b.projectedEquity - a.projectedEquity)[0];
    const exit = firstNegative || bestEquity;
    const exitTitle = economics.holdValue < number(state.settings.prepareThreshold)
      ? `Consider exiting now; next-month hold value is ${money(economics.holdValue)}`
      : `Suggested review window: ${monthLabel(exit.month)}`;
    const explanation = firstNegative
      ? "The monthly hold value falls below your prepare-to-sell floor."
      : `Projected net equity is strongest near ${monthLabel(bestEquity.month)} at roughly ${money(bestEquity.projectedEquity)}.`;
    const assumptions = `Estimate only: ${money(economics.averageProfit)}/month recent average profit; ${money(economics.depreciation)}/month depreciation; ${vehicle.financeType === "lease" ? "lease payoff trends toward residual" : `${money(state.settings.loanPayoffDecline)}/month payoff decline`}; ${state.settings.saleFrictionPct}% sale friction.`;
    return { ready: true, months, exitTitle, explanation, assumptions };
  }

  function renderReservations() {
    const target = $("#reservationTable");
    if (!state.importedReservations.length) {
      target.innerHTML = '<div class="muted">No imported reservation IDs yet.</div>';
      return;
    }
    target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Reservation ID</th><th>Vehicle</th><th>Imported</th><th></th></tr></thead><tbody>
      ${state.importedReservations.slice().sort(byDateDesc).map(item => `<tr><td class="table-primary">${escapeHTML(item.reservationId)}</td><td>${escapeHTML(vehicleName(findVehicle(item.vehicleId)))}</td><td>${escapeHTML(dateLabel((item.importedAt || "").slice(0, 10)))}</td><td><button class="danger" type="button" data-delete="importedReservations" data-id="${escapeHTML(item.id)}">Remove</button></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  function populateSettings() {
    const form = $("#settingsForm");
    Object.entries(state.settings).forEach(([key, value]) => {
      if (form.elements[key] && document.activeElement !== form.elements[key]) form.elements[key].value = value;
    });
  }

  function emptyState(title, copy, action, label) {
    return `<div class="empty"><h2>${escapeHTML(title)}</h2><p>${escapeHTML(copy)}</p><button class="primary" type="button" data-action="${escapeHTML(action)}">${escapeHTML(label)}</button></div>`;
  }

  const fieldDefinitions = {
    vehicles: [
      ["year", "Year", "number", { required: true, min: 1900, max: 2100 }],
      ["make", "Make", "text", { required: true }],
      ["model", "Model", "text", { required: true }],
      ["trim", "Trim", "text"],
      ["financeType", "Finance type", "select", { required: true, options: [["loan", "Loan"], ["lease", "Lease"]] }],
      ["acquisitionDate", "Acquisition date", "date", { required: true }],
      ["acquisitionCash", "Cash / down payment", "number", { min: 0, step: .01 }],
      ["monthlyPayment", "Monthly payment", "number", { min: 0, step: .01, required: true }],
      ["insurance", "Monthly insurance", "number", { min: 0, step: .01, required: true }],
      ["maintenanceReserve", "Maintenance reserve", "number", { min: 0, step: .01, required: true }],
      ["currentMileage", "Current mileage", "number", { min: 0, step: 1, required: true }],
      ["leaseTerm", "Lease term (months)", "number", { min: 1, step: 1 }],
      ["annualMileageAllowance", "Annual mileage allowance", "number", { min: 0, step: 1 }],
      ["residual", "Lease residual", "number", { min: 0, step: .01 }],
      ["currentPayoff", "Current payoff estimate", "number", { min: 0, step: .01 }],
      ["estimatedMarketValue", "Estimated market value", "number", { min: 0, step: .01 }],
      ["monthlyDepreciation", "Monthly depreciation estimate", "number", { min: 0, step: .01 }],
      ["notes", "Notes", "textarea", { wide: true, maxlength: 1000 }]
    ],
    earnings: [
      ["vehicleId", "Vehicle", "vehicle", { required: true }], ["month", "Month", "month", { required: true }],
      ["revenue", "Revenue / net earnings", "number", { required: true, step: .01 }],
      ["maintenance", "Maintenance this month", "number", { min: 0, step: .01 }],
      ["otherCosts", "Other monthly costs", "number", { min: 0, step: .01 }],
      ["bookedDays", "Booked days", "number", { min: 0, max: 31, step: 1 }],
      ["miles", "Miles driven", "number", { min: 0, step: 1 }],
      ["source", "Source", "text"], ["reservationId", "Reservation ID", "text"],
      ["notes", "Notes", "textarea", { wide: true, maxlength: 1000 }]
    ],
    offers: [
      ["vehicleId", "Vehicle", "vehicle", { required: true }], ["date", "Offer date", "date", { required: true }],
      ["source", "Buyer / source", "text", { required: true }], ["amount", "Offer amount", "number", { min: 0, step: .01, required: true }],
      ["expiresAt", "Expires", "date"], ["verified", "Executable / verified", "checkbox"],
      ["notes", "Notes", "textarea", { wide: true, maxlength: 1000 }]
    ],
    payoffs: [
      ["vehicleId", "Vehicle", "vehicle", { required: true }], ["date", "Quote date", "date", { required: true }],
      ["lender", "Lender", "text"], ["amount", "Payoff amount", "number", { min: 0, step: .01, required: true }],
      ["verified", "Verified quote", "checkbox"], ["notes", "Notes", "textarea", { wide: true, maxlength: 1000 }]
    ],
    maintenance: [
      ["vehicleId", "Vehicle", "vehicle", { required: true }], ["date", "Service date", "date", { required: true }],
      ["category", "Category", "select", { required: true, options: [["Routine", "Routine"], ["Tires", "Tires"], ["Repair", "Repair"], ["Cleaning", "Cleaning"], ["Registration", "Registration"], ["Other", "Other"]] }],
      ["amount", "Cost", "number", { min: 0, step: .01, required: true }], ["mileage", "Mileage", "number", { min: 0, step: 1 }],
      ["notes", "Notes", "textarea", { wide: true, maxlength: 1000 }]
    ],
    incidents: [
      ["vehicleId", "Vehicle", "vehicle", { required: true }], ["date", "Incident date", "date", { required: true }],
      ["type", "Type", "select", { required: true, options: [["Damage", "Damage"], ["Accident", "Accident"], ["Claim", "Claim"], ["Theft", "Theft"], ["Other", "Other"]] }],
      ["status", "Status", "select", { required: true, options: [["Open", "Open"], ["In review", "In review"], ["Closed", "Closed"]] }],
      ["claimAmount", "Claim amount", "number", { min: 0, step: .01 }], ["outOfPocket", "Out-of-pocket cost", "number", { min: 0, step: .01 }],
      ["notes", "Notes", "textarea", { wide: true, maxlength: 1000 }]
    ]
  };

  function singular(type) {
    return ({ vehicles: "Vehicle", earnings: "Earning", offers: "Offer", payoffs: "Payoff", maintenance: "Maintenance", incidents: "Incident" })[type] || type;
  }

  function openEditor(type, record = {}, defaults = {}) {
    if (type !== "vehicles" && !state.vehicles.length) {
      toast("Add a vehicle before adding records.");
      showView("vehicles");
      return;
    }
    editorContext = { type, id: record.id || null };
    $("#editorEyebrow").textContent = record.id ? `Edit ${singular(type).toLowerCase()}` : `New ${singular(type).toLowerCase()}`;
    $("#editorTitle").textContent = record.id ? `Edit ${singular(type)}` : `Add ${singular(type)}`;
    $("#editorFields").innerHTML = fieldDefinitions[type].map(def => renderField(def, { ...defaults, ...record })).join("");
    $("#editorDialog").showModal();
    const first = $("#editorFields input:not([type=checkbox]), #editorFields select, #editorFields textarea");
    if (first) first.focus();
  }

  function renderField([name, label, type, options = {}], record) {
    const value = record[name] ?? defaultFieldValue(name, type);
    const attrs = [
      options.required ? "required" : "", options.min != null ? `min="${options.min}"` : "",
      options.max != null ? `max="${options.max}"` : "", options.step != null ? `step="${options.step}"` : "",
      options.maxlength ? `maxlength="${options.maxlength}"` : ""
    ].filter(Boolean).join(" ");
    let control;
    if (type === "textarea") control = `<textarea name="${name}" ${attrs}>${escapeHTML(value)}</textarea>`;
    else if (type === "select") control = `<select name="${name}" ${attrs}>${options.options.map(([optionValue, optionLabel]) => `<option value="${escapeHTML(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHTML(optionLabel)}</option>`).join("")}</select>`;
    else if (type === "vehicle") control = `<select name="${name}" ${attrs}><option value="">Choose vehicle</option>${state.vehicles.map(vehicle => `<option value="${escapeHTML(vehicle.id)}" ${value === vehicle.id ? "selected" : ""}>${escapeHTML(vehicleName(vehicle))}</option>`).join("")}</select>`;
    else if (type === "checkbox") control = `<input name="${name}" type="checkbox" ${value ? "checked" : ""}>`;
    else control = `<input name="${name}" type="${type}" value="${escapeHTML(value)}" ${attrs}>`;
    return `<label class="${options.wide ? "wide" : ""}">${escapeHTML(label)}${control}</label>`;
  }

  function defaultFieldValue(name, type) {
    if (type === "date") return today();
    if (type === "month") return currentMonth();
    if (type === "checkbox") return false;
    if (name === "source") return "Manual";
    return "";
  }

  function saveEditor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || !editorContext) return;
    const definitions = fieldDefinitions[editorContext.type];
    const record = { id: editorContext.id || uid(singular(editorContext.type).toLowerCase()) };
    definitions.forEach(([name, , type]) => {
      const input = form.elements[name];
      if (type === "checkbox") record[name] = input.checked;
      else if (type === "number") record[name] = nullableNumber(input.value);
      else record[name] = input.value.trim();
    });
    const collection = state[editorContext.type];
    const index = collection.findIndex(item => item.id === record.id);
    if (index >= 0) collection[index] = record;
    else collection.push(record);
    if (editorContext.type === "payoffs") {
      const vehicle = findVehicle(record.vehicleId);
      if (vehicle) vehicle.currentPayoff = record.amount;
    }
    if (editorContext.type === "earnings" && record.reservationId) {
      const existing = state.importedReservations.find(item => normalize(item.reservationId) === normalize(record.reservationId));
      if (!existing) state.importedReservations.push({ id: uid("reservation"), reservationId: record.reservationId, vehicleId: record.vehicleId, importedAt: new Date().toISOString(), source: "manual" });
    }
    $("#editorDialog").close();
    saveData(`${singular(editorContext.type)} saved.`);
    editorContext = null;
  }

  function requestDelete(type, id) {
    const record = state[type].find(item => item.id === id);
    if (!record) return;
    const label = type === "vehicles" ? vehicleName(record) : (record.reservationId || `${singular(type).toLowerCase()} record`);
    let extra = "";
    if (type === "vehicles") {
      const count = RECORD_TYPES.reduce((sum, key) => sum + state[key].filter(item => item.vehicleId === id).length, 0);
      extra = ` This also deletes ${count} linked record${count === 1 ? "" : "s"} and imported IDs.`;
    }
    confirmAction(`Delete ${singular(type)}`, `Delete “${label}”? This cannot be undone.${extra}`, () => {
      state[type] = state[type].filter(item => item.id !== id);
      if (type === "vehicles") {
        RECORD_TYPES.forEach(key => { state[key] = state[key].filter(item => item.vehicleId !== id); });
        state.importedReservations = state.importedReservations.filter(item => item.vehicleId !== id);
      }
      saveData(`${singular(type)} deleted.`);
    });
  }

  function confirmAction(title, message, callback, label = "Delete") {
    $("#confirmTitle").textContent = title;
    $("#confirmMessage").textContent = message;
    $("#confirmAccept").textContent = label;
    pendingConfirmation = callback;
    $("#confirmDialog").showModal();
  }

  function showView(view, updateHash = true) {
    if (!document.getElementById(view)) return;
    activeView = view;
    $$(".view").forEach(section => section.classList.toggle("active", section.id === view));
    $$("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    if (updateHash) history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function handleGlobalClick(event) {
    const button = event.target.closest("button, [data-view-link]");
    if (!button) return;
    if (button.dataset.view) showView(button.dataset.view);
    if (button.dataset.viewLink) showView(button.dataset.viewLink);
    if (button.dataset.recordTab) {
      activeRecordType = button.dataset.recordTab;
      renderRecordTabs(); renderRecords();
    }
    if (button.dataset.edit) {
      const record = state[button.dataset.edit].find(item => item.id === button.dataset.id);
      openEditor(button.dataset.edit, record);
    }
    if (button.dataset.delete) requestDelete(button.dataset.delete, button.dataset.id);
    const action = button.dataset.action;
    if (action === "add-vehicle") openEditor("vehicles");
    if (action === "add-record") openEditor(activeRecordType);
    if (action === "quick-earning") openEditor("earnings", {}, { vehicleId: button.dataset.id });
    if (action === "quick-offer") openEditor("offers", {}, { vehicleId: button.dataset.id });
    if (action === "show-forecast") {
      showView("forecast");
      setTimeout(() => document.getElementById(`forecast-${button.dataset.id}`)?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (char !== "\r") field += char;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(values => values.some(value => value.trim() !== ""));
  }

  const columnAliases = {
    reservationId: ["reservationid", "reservation", "tripid", "bookingid", "confirmationnumber"],
    vehicle: ["vehicle", "car", "vehicle name", "listing", "listingname"],
    startDate: ["tripstart", "startdate", "tripstartdate", "from", "start"],
    endDate: ["tripend", "enddate", "tripenddate", "to", "end"],
    earnings: ["netearnings", "earnings", "hostearnings", "netincome", "tripprice", "payout", "amount"],
    bookedDays: ["bookeddays", "tripdays", "days", "duration"],
    mileage: ["mileage", "miles", "distance", "tripmiles"]
  };

  function detectColumns(headers) {
    const normalized = headers.map(normalize);
    const mapping = {};
    Object.entries(columnAliases).forEach(([key, aliases]) => {
      const index = normalized.findIndex(header => aliases.some(alias => header === normalize(alias) || header.includes(normalize(alias))));
      if (index >= 0) mapping[key] = index;
    });
    return mapping;
  }

  function parseMoney(value) {
    const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
    return cleaned === "" ? null : number(cleaned);
  }

  function parseDate(value) {
    if (!value) return "";
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
    const match = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) return "";
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }

  async function previewImport() {
    const files = [...$("#csvFiles").files];
    if (!files.length) { toast("Choose at least one CSV file."); return; }
    if (!state.vehicles.length) { toast("Add a vehicle before importing earnings."); showView("vehicles"); return; }
    importRows = [];
    for (const file of files) {
      const grid = parseCSV(await file.text());
      if (grid.length < 2) {
        importRows.push({ file: file.name, error: "File has no data rows.", skip: true });
        continue;
      }
      const headers = grid[0];
      const columns = detectColumns(headers);
      if (columns.earnings == null || columns.startDate == null) {
        importRows.push({ file: file.name, error: "Required earnings or trip date column was not detected.", skip: true });
        continue;
      }
      grid.slice(1).forEach((values, index) => {
        const startDate = parseDate(values[columns.startDate]);
        const revenue = parseMoney(values[columns.earnings]);
        const externalVehicle = columns.vehicle != null ? values[columns.vehicle].trim() : "";
        const reservationId = columns.reservationId != null ? values[columns.reservationId].trim() : "";
        const fingerprint = reservationId || `fp_${simpleHash([file.name, startDate, externalVehicle, revenue, values[columns.endDate] || ""].join("|"))}`;
        const match = externalVehicle ? state.vehicles.find(vehicle => normalize(vehicleName(vehicle)) === normalize(externalVehicle) || normalize(vehicleName(vehicle)).includes(normalize(externalVehicle))) : null;
        const duplicate = state.importedReservations.some(item => normalize(item.reservationId) === normalize(fingerprint)) || importRows.some(item => normalize(item.fingerprint) === normalize(fingerprint));
        const errors = [];
        if (!startDate) errors.push("Invalid trip date");
        if (revenue == null) errors.push("Invalid earnings");
        importRows.push({
          file: file.name, rowNumber: index + 2, startDate, endDate: columns.endDate != null ? parseDate(values[columns.endDate]) : "",
          month: startDate.slice(0, 7), revenue, bookedDays: columns.bookedDays != null ? number(values[columns.bookedDays]) : calculateDays(startDate, columns.endDate != null ? parseDate(values[columns.endDate]) : ""),
          miles: columns.mileage != null ? number(String(values[columns.mileage]).replace(/[^\d.-]/g, "")) : 0,
          externalVehicle, vehicleId: match?.id || "", reservationId, fingerprint, duplicate, errors, skip: duplicate || errors.length > 0
        });
      });
    }
    renderImportPreview();
    $("#importDialog").showModal();
  }

  function calculateDays(start, end) {
    if (!start || !end) return 0;
    return Math.max(1, Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) + 1);
  }

  function simpleHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function renderImportPreview() {
    const dataRows = importRows.filter(row => row.rowNumber);
    const duplicates = dataRows.filter(row => row.duplicate).length;
    const unmatched = dataRows.filter(row => !row.vehicleId && !row.skip).length;
    const errors = importRows.filter(row => row.error || row.errors?.length).length;
    $("#importSummary").innerHTML = `<span><strong>${dataRows.length}</strong> rows</span><span><strong>${duplicates}</strong> duplicates</span><span><strong>${unmatched}</strong> unmatched</span><span><strong>${errors}</strong> errors</span>`;
    if (!importRows.length) {
      $("#importPreview").innerHTML = '<div class="empty"><h3>No rows detected</h3></div>';
      return;
    }
    $("#importPreview").innerHTML = `<div class="table-wrap"><table><thead><tr><th>File / row</th><th>Trip</th><th>CSV vehicle</th><th>Map to vehicle</th><th>Earnings</th><th>Status</th></tr></thead><tbody>
      ${importRows.map((row, index) => {
        if (!row.rowNumber) return `<tr class="row-error"><td>${escapeHTML(row.file)}</td><td colspan="5">${escapeHTML(row.error)}</td></tr>`;
        const status = row.duplicate ? "Duplicate — skipped" : row.errors.length ? row.errors.join(", ") : row.vehicleId ? "Ready" : "Needs vehicle";
        return `<tr class="${row.duplicate ? "row-duplicate" : (!row.vehicleId || row.errors.length) ? "row-error" : ""}">
          <td>${escapeHTML(row.file)}<span class="table-secondary">Row ${row.rowNumber}</span></td>
          <td>${escapeHTML(dateLabel(row.startDate))}<span class="table-secondary">${integer(row.bookedDays)} days · ${integer(row.miles)} mi</span></td>
          <td>${escapeHTML(row.externalVehicle || "Not supplied")}</td>
          <td><select class="import-row-select" data-import-index="${index}" ${row.duplicate || row.errors.length ? "disabled" : ""}><option value="">Choose vehicle</option>${state.vehicles.map(vehicle => `<option value="${escapeHTML(vehicle.id)}" ${row.vehicleId === vehicle.id ? "selected" : ""}>${escapeHTML(vehicleName(vehicle))}</option>`).join("")}</select></td>
          <td>${money(row.revenue)}</td><td>${escapeHTML(status)}</td>
        </tr>`;
      }).join("")}
    </tbody></table></div>`;
    $("#commitImportBtn").disabled = !dataRows.some(row => !row.skip && row.vehicleId);
  }

  function commitImport() {
    const valid = importRows.filter(row => row.rowNumber && !row.skip && row.vehicleId);
    const unmatched = importRows.filter(row => row.rowNumber && !row.skip && !row.vehicleId);
    if (!valid.length) { toast("Map at least one valid row to a vehicle."); return; }
    const groups = new Map();
    valid.forEach(row => {
      const key = `${row.vehicleId}|${row.month}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
      state.importedReservations.push({
        id: uid("reservation"), reservationId: row.fingerprint, originalReservationId: row.reservationId,
        vehicleId: row.vehicleId, importedAt: new Date().toISOString(), source: row.file
      });
    });
    groups.forEach((rows, key) => {
      const [vehicleId, month] = key.split("|");
      state.earnings.push({
        id: uid("earning"), vehicleId, month,
        revenue: rows.reduce((sum, row) => sum + number(row.revenue), 0),
        maintenance: 0, otherCosts: 0,
        bookedDays: rows.reduce((sum, row) => sum + number(row.bookedDays), 0),
        miles: rows.reduce((sum, row) => sum + number(row.miles), 0),
        source: `Turo CSV (${rows.length} trip${rows.length === 1 ? "" : "s"})`,
        reservationId: "", notes: `Imported from ${[...new Set(rows.map(row => row.file))].join(", ")}`
      });
    });
    const duplicateCount = importRows.filter(row => row.duplicate).length;
    const errorCount = importRows.filter(row => row.error || row.errors?.length).length;
    $("#importDialog").close();
    $("#importResult").textContent = `Imported ${valid.length} rows into ${groups.size} vehicle-month records. Skipped ${duplicateCount} duplicates and ${errorCount} invalid rows. ${unmatched.length} unmatched rows were not imported.`;
    saveData(`Imported ${valid.length} CSV rows.`);
    importRows = [];
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fleet-alpha-backup-${today()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast("JSON backup exported.");
  }

  async function restoreBackup() {
    const file = $("#restoreFile").files[0];
    if (!file) { toast("Choose a JSON backup first."); return; }
    let restored;
    try {
      restored = migrate(JSON.parse(await file.text()));
      validateData(restored);
    } catch (error) {
      toast(`Backup rejected: ${error.message}`);
      return;
    }
    confirmAction("Restore backup", `Replace all browser data with the validated backup “${file.name}”?`, () => {
      state = restored;
      saveData("Backup restored.");
    }, "Restore");
  }

  function bindEvents() {
    document.addEventListener("click", handleGlobalClick);
    $("#editorForm").addEventListener("submit", saveEditor);
    $$("[data-close]").forEach(button => button.addEventListener("click", () => $("#editorDialog").close()));
    $$("[data-import-close]").forEach(button => button.addEventListener("click", () => $("#importDialog").close()));
    $("#addRecordBtn").addEventListener("click", () => openEditor(activeRecordType));
    $("#settingsForm").addEventListener("submit", event => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const values = Object.fromEntries(new FormData(event.currentTarget));
      state.settings = {
        holdThreshold: number(values.holdThreshold), prepareThreshold: number(values.prepareThreshold),
        loanPayoffDecline: number(values.loanPayoffDecline), averageMonths: number(values.averageMonths),
        saleFrictionPct: number(values.saleFrictionPct), currency: values.currency
      };
      saveData("Decision settings saved.");
    });
    $("#confirmCancel").addEventListener("click", () => { pendingConfirmation = null; $("#confirmDialog").close(); });
    $("#confirmAccept").addEventListener("click", () => {
      const callback = pendingConfirmation;
      pendingConfirmation = null;
      $("#confirmDialog").close();
      if (callback) callback();
    });
    $("#csvFiles").addEventListener("change", event => {
      const files = [...event.target.files];
      $("#csvSelection").textContent = files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected: ${files.map(file => file.name).join(", ")}` : "No files selected";
    });
    $("#previewImportBtn").addEventListener("click", previewImport);
    $("#importPreview").addEventListener("change", event => {
      const select = event.target.closest("[data-import-index]");
      if (!select) return;
      importRows[number(select.dataset.importIndex)].vehicleId = select.value;
      renderImportPreview();
    });
    $("#commitImportBtn").addEventListener("click", commitImport);
    $("#exportBtn").addEventListener("click", exportBackup);
    $("#restoreBtn").addEventListener("click", restoreBackup);
    $("#resetBtn").addEventListener("click", () => confirmAction("Reset to demo data", "Replace all browser data with clearly fictional starter records?", () => { state = demoData(); saveData("Demo data restored."); }, "Reset"));
    $("#clearBtn").addEventListener("click", () => confirmAction("Clear all data", "Permanently remove every locally stored Fleet Alpha record from this browser?", () => {
      const empty = demoData();
      RECORD_TYPES.forEach(key => { empty[key] = []; });
      empty.vehicles = []; empty.importedReservations = [];
      state = empty; saveData("All fleet data cleared.");
    }, "Clear all"));
    window.addEventListener("hashchange", () => showView(location.hash.slice(1) || "dashboard", false));
  }

  bindEvents();
  renderAll();
  showView(location.hash.slice(1) || "dashboard", false);
  if (state.recoveryNotice) {
    setTimeout(() => toast(state.recoveryNotice), 300);
    delete state.recoveryNotice;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
})();
