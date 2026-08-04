"use client";

import { useEffect, useMemo, useState } from "react";

const outletData = [
  { name: "NCR • Golf Course", short: "GC", cover: 1.8, risk: 18420, urgent: 5, tone: "critical" },
  { name: "NCR • Cyber Hub", short: "CH", cover: 2.6, risk: 12680, urgent: 3, tone: "watch" },
  { name: "NCR • Saket", short: "SK", cover: 4.1, risk: 6240, urgent: 1, tone: "healthy" },
  { name: "NCR • Noida", short: "NO", cover: 5.4, risk: 3910, urgent: 0, tone: "healthy" },
];

const actions = [
  { priority: "P1", item: "FreshDairy Whole Milk", supplier: "FreshDairy Foods NCR", outlet: "Golf Course", cover: "1.2 days", value: "₹8,940", impact: "Cappuccino · Latte · Cold Coffee", status: "Order now" },
  { priority: "P1", item: "Mozzarella Cheese", supplier: "DairyBest", outlet: "Cyber Hub", cover: "1.6 days", value: "₹5,720", impact: "Margherita · Cheese Toast", status: "Confirm PO" },
  { priority: "P2", item: "Arabica Roast Beans", supplier: "Bean Street", outlet: "Golf Course", cover: "2.4 days", value: "₹3,760", impact: "Espresso · Americano", status: "Expedite" },
  { priority: "P2", item: "Avocado", supplier: "GreenBasket", outlet: "Saket", cover: "2.8 days", value: "₹2,180", impact: "Avocado Toast", status: "Review" },
];

const ziaQuestions = [
  "Which outlet has the highest gross margin at risk?",
  "What must FreshDairy deliver this week?",
  "Show ingredients with fewer than 3 days of cover.",
  "Which menu items are exposed by milk shortage?",
];

export default function Home() {
  const [activeView, setActiveView] = useState("Command center");
  const [selectedOutlet, setSelectedOutlet] = useState("All outlets");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("Live planning view • refreshed 08:30 IST");
  const [connection, setConnection] = useState<"checking" | "preview" | "connected">("checking");

  useEffect(() => {
    fetch("/api/zoho/status").then((response) => response.json()).then((data) => {
      setConnection(data.connected ? "connected" : "preview");
      if (data.connected) setToast("Zoho Analytics connected • live refresh ready");
    }).catch(() => setConnection("preview"));
  }, []);

  const filteredActions = useMemo(
    () => actions.filter((action) => selectedOutlet === "All outlets" || action.outlet.includes(selectedOutlet.replace("NCR • ", ""))),
    [selectedOutlet],
  );

  function ask(question: string) {
    setQuery(question);
    setToast("Zia question prepared — connect your Zoho token to run it live.");
  }

  return (
    <main className="tower-shell">
      <aside className="rail" aria-label="Main navigation">
        <div className="brand-mark"><span>AB</span><i /></div>
        <nav>
          {["Command center", "Inventory health", "Supplier pulse", "Demand plan", "Margin risk"].map((item, index) => (
            <button key={item} className={activeView === item ? "nav-item active" : "nav-item"} onClick={() => setActiveView(item)}>
              <b>{["◈", "▣", "⌁", "↗", "◉"][index]}</b><span>{item}</span>
            </button>
          ))}
        </nav>
        <div className="rail-bottom"><button className="nav-item"><b>⚙</b><span>Settings</span></button><div className="avatar">SP</div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="crumb"><span>ABNAH</span><em>/</em><strong>{activeView}</strong></div>
          <div className="top-actions"><span className={connection === "connected" ? "live-dot" : "preview-dot"}>{connection === "connected" ? "Zoho live" : connection === "checking" ? "Checking Zoho" : "Planning preview"}</span><button className="icon-button" aria-label="Notifications">◌</button>{connection === "connected" ? <button className="share-button" onClick={() => setToast("Daily control-tower digest scheduled for 08:30 IST.")}>Share brief</button> : <button className="share-button" onClick={() => { window.location.href = "/api/zoho/connect"; }}>Connect Zoho</button>}</div>
        </header>

        <section className="hero">
          <div><p className="eyebrow">SUPPLY CHAIN COMMAND CENTER</p><h1>Protect today’s sales.<br /><span>Plan the next seven days.</span></h1><p className="hero-copy">One view for replenishment, supplier follow-up and menu margin exposure across ABNAH cafés.</p></div>
          <div className="hero-controls"><label>Network view<select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)}><option>All outlets</option>{outletData.map((outlet) => <option key={outlet.name}>{outlet.name}</option>)}</select></label><button className="primary-button" onClick={() => setToast("Action queue exported for the procurement team.")}>↓ Export action list</button></div>
        </section>

        <div className="status-strip"><span className="signal" />{toast}<button onClick={() => connection === "connected" ? setToast("Zoho Analytics refresh requested.") : (window.location.href = "/api/zoho/connect")}>{connection === "connected" ? "Refresh now" : "Connect Zoho"}</button></div>

        <section className="metric-grid" aria-label="Supply chain key performance indicators">
          <article className="metric-card risk-card"><div className="metric-label">Gross margin at risk <button aria-label="More information">i</button></div><strong>₹40,950</strong><p><span className="up">↑ 12.4%</span> vs. last 7 days</p><div className="spark spark-risk"><i /><i /><i /><i /><i /><i /><i /></div></article>
          <article className="metric-card"><div className="metric-label">Urgent replenishments <button aria-label="More information">i</button></div><strong>9 <small>SKUs</small></strong><p><span className="warning-dot" /> 5 need a PO today</p><div className="meter"><i style={{ width: "72%" }} /></div></article>
          <article className="metric-card"><div className="metric-label">Open purchase orders <button aria-label="More information">i</button></div><strong>₹2.46L</strong><p><span className="good">63%</span> due within 48 hours</p><div className="mini-bars"><i /><i /><i /><i /><i /><i /></div></article>
          <article className="metric-card"><div className="metric-label">Network stock cover <button aria-label="More information">i</button></div><strong>3.6 <small>days</small></strong><p><span className="good">+0.4 days</span> vs. target</p><div className="cover-scale"><i /><i /><i /><i /><i /></div></article>
        </section>

        <section className="board-grid">
          <article className="panel outlet-panel"><div className="panel-heading"><div><p className="eyebrow">NETWORK HEALTH</p><h2>Outlet stock &amp; margin exposure</h2></div><button className="text-button">Outlet detail →</button></div><div className="outlet-list">{outletData.map((outlet) => <div className="outlet-row" key={outlet.name}><div className={`outlet-badge ${outlet.tone}`}>{outlet.short}</div><div className="outlet-name"><strong>{outlet.name}</strong><span>{outlet.urgent ? `${outlet.urgent} urgent items` : "No urgent items"}</span></div><div className="cover-cell"><span>Stock cover</span><strong>{outlet.cover}d</strong><div className="cover-track"><i style={{ width: `${Math.min(outlet.cover / 6 * 100, 100)}%` }} /></div></div><div className="risk-cell"><span>Margin at risk</span><strong>₹{outlet.risk.toLocaleString("en-IN")}</strong></div></div>)}</div></article>

          <article className="panel supplier-panel"><div className="panel-heading"><div><p className="eyebrow">SUPPLIER PULSE</p><h2>FreshDairy Foods NCR</h2></div><span className="supplier-status">Needs follow-up</span></div><div className="supplier-score"><div className="score-ring"><b>72</b><span>/100</span></div><div><strong>Vendor reliability is slipping</strong><p>2 late receipts in the last 7 days. Milk delivery affects 3 high-margin beverage lines.</p></div></div><div className="supplier-stats"><div><span>Wallet share</span><strong>28%</strong></div><div><span>Open PO value</span><strong>₹34,200</strong></div><div><span>Next expected</span><strong>Today, 14:00</strong></div></div><button className="supplier-action" onClick={() => setToast("Supplier follow-up brief opened for FreshDairy Foods NCR.")}>Open supplier brief <span>→</span></button></article>
        </section>

        <section className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">DECIDE &amp; ACT</p><h2>Today’s replenishment queue</h2></div><div className="heading-actions"><span className="priority-pill">2 P1 critical</span><button className="text-button" onClick={() => setToast("All replenishment actions are displayed below.")}>View all →</button></div></div><div className="table-wrap"><table><thead><tr><th>Priority</th><th>Ingredient / supplier</th><th>Outlet</th><th>Stock cover</th><th>GM exposure</th><th>Menu impact</th><th /></tr></thead><tbody>{filteredActions.map((action) => <tr key={action.item}><td><span className={`priority ${action.priority.toLowerCase()}`}>{action.priority}</span></td><td><strong>{action.item}</strong><small>{action.supplier}</small></td><td>{action.outlet}</td><td><b className={action.priority === "P1" ? "danger-text" : ""}>{action.cover}</b></td><td><strong>{action.value}</strong></td><td><span className="impact-copy">{action.impact}</span></td><td><button className="row-action" onClick={() => setToast(`${action.status}: ${action.item} at ${action.outlet}`)}>{action.status} →</button></td></tr>)}</tbody></table></div></section>

        <section className="zia-panel"><div className="zia-orb">✦</div><div className="zia-content"><p className="eyebrow">ZIA SUPPLY INTELLIGENCE</p><h2>Ask the tower anything</h2><div className="ask-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. What should I buy today to protect margin?" aria-label="Ask Zia" /><button onClick={() => setToast(query ? connection === "connected" ? "Question sent to the live Zia query layer." : "Connect Zoho to run this question on live data." : "Type a question for Zia first.")}>Ask Zia <span>→</span></button></div><div className="question-chips">{ziaQuestions.map((question) => <button key={question} onClick={() => ask(question)}>{question}</button>)}</div></div><div className="zia-note"><span>Data model</span><strong>Replenishment · menu risk · open PO · purchase receipt</strong><p>{connection === "connected" ? "Authenticated Zoho user session active." : "Secure Zoho sign-in activates live responses."}</p></div></section>
      </section>
    </main>
  );
}
