"use client";

import { useEffect, useMemo, useState } from "react";

type Outlet = {
  name: string;
  sales: number;
  grossMargin: number;
  gmRate: number;
  leakage: number;
  driver: string;
  priority: string;
};

const outlets: Outlet[] = [
  { name: "Saket Premium", sales: 692297, grossMargin: 565071, gmRate: 81.62, leakage: 4535, driver: "Milk", priority: "Coffee Beans availability" },
  { name: "Connaught Place", sales: 626350, grossMargin: 519292, gmRate: 82.91, leakage: 2152, driver: "Coffee Beans", priority: "Coffee Beans and Lid availability" },
  { name: "Hauz Khas", sales: 626543, grossMargin: 515846, gmRate: 82.33, leakage: 4181, driver: "Coffee Beans", priority: "FreshDairy delivery recovery" },
];

const menuLeaders = [
  ["Mocha - Medium", "INR 34.9K", "81.59%", "162"],
  ["Latte - Medium", "INR 34.3K", "83.22%", "168"],
  ["Latte - Regular", "INR 33.8K", "83.51%", "183"],
  ["Americano - Medium", "INR 33.5K", "87.31%", "186"],
  ["Cappuccino - Regular", "INR 32.5K", "83.43%", "177"],
  ["Flat White - Medium", "INR 32.2K", "83.90%", "150"],
];

const actionQueue = [
  { level: "P1", item: "Coffee Beans", outlet: "Connaught Place", exposure: "INR 6.8K", signal: "Red inventory shortage", impact: "56 menu-item links", action: "Replenish / transfer" },
  { level: "P1", item: "Coffee Beans", outlet: "Saket Premium", exposure: "INR 6.3K", signal: "Red inventory shortage", impact: "56 menu-item links", action: "Replenish / transfer" },
  { level: "P1", item: "Paneer", outlet: "Hauz Khas", exposure: "INR 17.7K", signal: "Open PO timing - 5 days", impact: "4 menu items", action: "Expedite supplier" },
  { level: "P1", item: "Chicken", outlet: "Hauz Khas", exposure: "INR 12.3K", signal: "Open PO timing - 11 days", impact: "6 menu items", action: "Expedite supplier" },
  { level: "P2", item: "Cheese", outlet: "Hauz Khas", exposure: "INR 11.1K", signal: "Open PO timing - 8 days", impact: "14 menu items", action: "Confirm PO date" },
  { level: "P2", item: "Croissant Base", outlet: "Connaught Place", exposure: "INR 11.0K", signal: "Open PO timing - 8 days", impact: "8 menu items", action: "Confirm PO date" },
];

const supplierRows = [
  ["FreshDairy Foods NCR", "Hauz Khas", "INR 15.6K", "28 days"],
  ["FreshDairy Foods NCR", "Saket Premium", "INR 14.7K", "28 days"],
  ["FreshDairy Foods NCR", "Connaught Place", "INR 9.2K", "29 days"],
  ["NorthStar Poultry", "Connaught Place", "INR 8.9K", "7 days"],
];

const ziaPrompts = [
  "Which menu items are exposed by Coffee Beans?",
  "What should FreshDairy deliver this week?",
  "Show consumption variance by outlet.",
];

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export default function Home() {
  const [selectedOutlet, setSelectedOutlet] = useState("Network");
  const [activeView, setActiveView] = useState("Executive brief");
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("Validated January 2026 operating snapshot - latest complete risk date: 31 Jan 2026");
  const [connection, setConnection] = useState<"checking" | "preview" | "connected">("checking");

  useEffect(() => {
    fetch("/api/zoho/status")
      .then((response) => response.json())
      .then((data) => setConnection(data.connected ? "connected" : "preview"))
      .catch(() => setConnection("preview"));
  }, []);

  const visibleOutlets = useMemo(() => selectedOutlet === "Network" ? outlets : outlets.filter((outlet) => outlet.name === selectedOutlet), [selectedOutlet]);
  const totals = useMemo(() => visibleOutlets.reduce((acc, outlet) => ({ sales: acc.sales + outlet.sales, grossMargin: acc.grossMargin + outlet.grossMargin, leakage: acc.leakage + outlet.leakage }), { sales: 0, grossMargin: 0, leakage: 0 }), [visibleOutlets]);
  const marginRate = totals.sales ? totals.grossMargin / totals.sales * 100 : 0;
  const maxMargin = Math.max(...visibleOutlets.map((outlet) => outlet.grossMargin));

  function askZia(prompt = question) {
    if (!prompt.trim()) return setNotice("Choose a suggested question or type one for Zia.");
    setQuestion(prompt);
    setNotice(connection === "connected" ? "Zoho session is connected. Configure the approved analytics query mapping to return the live answer." : "Zia question saved. Connect Zoho Analytics to use approved live-query mappings.");
  }

  return (
    <main className="tower">
      <aside className="side-nav" aria-label="Tower navigation">
        <div className="brand"><span>AB</span><div><strong>ABNAH</strong><small>Supply Chain Tower</small></div></div>
        <nav>
          {["Executive brief", "Menu performance", "Action queue", "Supplier control", "Data confidence"].map((item, index) => (
            <button key={item} className={activeView === item ? "nav-link active" : "nav-link"} onClick={() => { setActiveView(item); setNotice(`${item} is in focus.`); }}>
              <i>{["01", "02", "03", "04", "05"][index]}</i>{item}
            </button>
          ))}
        </nav>
        <div className="nav-foot"><span>ABG-GIT Workspace</span><strong>ABNAH meeting Demo</strong></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><span className="eyebrow">ABNAH CAFE</span><h2>{activeView}</h2></div>
          <div className="header-actions">
            <span className={connection === "connected" ? "connection live" : "connection"}>{connection === "connected" ? "Zoho session connected" : connection === "checking" ? "Checking Zoho" : "Verified snapshot"}</span>
            <button className="outline-button" onClick={() => connection === "connected" ? setNotice("Live access is connected. Configure approved report queries in the Zoho API mapping to refresh values.") : (window.location.href = "/api/zoho/connect")}>{connection === "connected" ? "Connection status" : "Connect Zoho"}</button>
          </div>
        </header>

        <section className="headline">
          <div><p className="eyebrow">JANUARY 2026 - EXECUTIVE DECISION PACK</p><h1>Margin. Availability.<br /><em>Action.</em></h1><p>Protect the coffee-margin engine, resolve material supplier delays and focus outlet controls where consumption diverges from recipe demand.</p></div>
          <div className="filter-box"><label htmlFor="outlet">Scope</label><select id="outlet" value={selectedOutlet} onChange={(event) => setSelectedOutlet(event.target.value)}><option>Network</option>{outlets.map((outlet) => <option key={outlet.name}>{outlet.name}</option>)}</select><span>Period: 01-31 Jan 2026</span></div>
        </section>

        <div className="notice"><span />{notice}<button onClick={() => setNotice("Expiry risk is excluded from the executive total because its source is declared provisional synthetic data, not POSIST actual batch expiry.")}>Data note</button></div>

        <section className="kpis" aria-label="Executive KPIs">
          <article><span>Net sales</span><strong>INR {(totals.sales / 1_000_000).toFixed(2)}M</strong><small>{selectedOutlet === "Network" ? "3 cafes" : selectedOutlet}</small></article>
          <article><span>Gross margin</span><strong>INR {(totals.grossMargin / 1_000_000).toFixed(2)}M</strong><small>{marginRate.toFixed(2)}% theoretical GM</small></article>
          <article><span>Recipe-cost coverage</span><strong>100%</strong><small>All reported sales costed</small></article>
          <article><span>Modelled variance</span><strong>INR {(totals.leakage / 1000).toFixed(1)}K</strong><small>Thresholds pending approval</small></article>
        </section>

        <section className="two-up">
          <article className="panel store-panel"><div className="panel-head"><div><span className="eyebrow">STORE PERFORMANCE</span><h3>Gross-margin contribution</h3></div><span className="panel-tag">INR</span></div>
            <div className="bar-list">{visibleOutlets.map((outlet) => <div className="bar-row" key={outlet.name}><div className="bar-label"><strong>{outlet.name}</strong><span>{outlet.gmRate.toFixed(2)}% GM</span></div><div className="bar-track"><i style={{ width: `${outlet.grossMargin / maxMargin * 100}%` }} /></div><strong className="bar-value">INR {inr.format(outlet.grossMargin / 1000)}K</strong></div>)}</div>
            <div className="insight"><b>Decision:</b> Saket Premium leads absolute contribution; Connaught Place leads margin efficiency. Keep beverage service levels protected at all outlets.</div>
          </article>
          <article className="panel focus-panel"><div className="panel-head"><div><span className="eyebrow">NETWORK RISK</span><h3>What deserves action now</h3></div><span className="risk-dot">P1</span></div>
            <ol><li><b>Protect Coffee Beans</b><span>Red inventory flags at Connaught Place and Saket; 56 menu-item links each.</span></li><li><b>Recover FreshDairy service</b><span>INR 39.4K open liability across the network; aged lines up to 29 days.</span></li><li><b>Control Hauz Khas usage</b><span>6.60% modelled consumption variance, led by Coffee Beans.</span></li></ol>
          </article>
        </section>

        <section className="panel action-panel"><div className="panel-head"><div><span className="eyebrow">DECIDE AND ACT</span><h3>Priority replenishment queue</h3></div><span className="chip">Current complete snapshot</span></div>
          <div className="scroll"><table><thead><tr><th>Priority</th><th>Ingredient</th><th>Outlet</th><th>Risk signal</th><th>Margin exposure</th><th>Menu impact</th><th>Recommended action</th></tr></thead><tbody>{actionQueue.filter((row) => selectedOutlet === "Network" || row.outlet === selectedOutlet).map((row) => <tr key={`${row.item}-${row.outlet}`}><td><span className={`priority ${row.level.toLowerCase()}`}>{row.level}</span></td><td><strong>{row.item}</strong></td><td>{row.outlet}</td><td>{row.signal}</td><td><strong>{row.exposure}</strong></td><td>{row.impact}</td><td><button className="table-action" onClick={() => setNotice(`${row.action}: ${row.item} at ${row.outlet}. Assign an owner and due time in the daily huddle.`)}>{row.action} <b>→</b></button></td></tr>)}</tbody></table></div>
        </section>

        <section className="three-up">
          <article className="panel"><span className="eyebrow">MENU PERFORMANCE</span><h3>Protect the coffee core</h3><table className="compact"><thead><tr><th>Menu item</th><th>GM</th><th>Rate</th></tr></thead><tbody>{menuLeaders.slice(0, 4).map(([item, margin, rate]) => <tr key={item}><td>{item}</td><td>{margin}</td><td className="positive">{rate}</td></tr>)}</tbody></table><p className="panel-copy">Americano - Medium has the highest featured GM rate at 87.31%. Do not discount coffee items with critical ingredient risk.</p></article>
          <article className="panel"><span className="eyebrow">SUPPLIER CONTROL</span><h3>FreshDairy recovery plan</h3><table className="compact"><thead><tr><th>Outlet</th><th>Liability</th><th>Overdue</th></tr></thead><tbody>{supplierRows.slice(0, 3).map(([, outlet, liability, overdue]) => <tr key={outlet}><td>{outlet}</td><td>{liability}</td><td className="danger">{overdue}</td></tr>)}</tbody></table><button className="inline-action" onClick={() => setNotice("FreshDairy action: confirm delivery date by Milk, Cream, Paneer and Cheese; prepare approved alternate-source plan.")}>Open supplier brief →</button></article>
          <article className="panel confidence"><span className="eyebrow">DATA CONFIDENCE</span><h3>What is ready to use</h3><div className="confidence-row"><span>Recipe costing</span><b>Ready</b></div><div className="confidence-row"><span>Inventory and PO risk</span><b>Review actions</b></div><div className="confidence-row"><span>Expiry risk</span><b className="danger">Not actuals</b></div><p className="panel-copy">Expiry records are provisional synthetic demonstration data. Keep them out of actual loss reporting until POSIST batch-expiry data is integrated.</p></article>
        </section>

        <section className="zia"><div className="zia-mark">Z</div><div className="zia-main"><span className="eyebrow">ZIA SUPPLY INTELLIGENCE</span><h3>Ask the tower a question</h3><div className="ask"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What should I buy today to protect margin?" aria-label="Ask Zia" /><button onClick={() => askZia()}>Ask Zia →</button></div><div className="prompts">{ziaPrompts.map((prompt) => <button key={prompt} onClick={() => askZia(prompt)}>{prompt}</button>)}</div></div><div className="zia-side"><span>Query guardrail</span><b>Answers should use approved Zoho views and disclose confidence.</b></div></section>
      </section>
    </main>
  );
}
