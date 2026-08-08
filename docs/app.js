const API = "https://abnah-zoho-api.techmajos6.workers.dev";
const rupees = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const num = (value) => Number(String(value || 0).replace(/,/g, ""));
const html = (value) => String(value ?? "").replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

document.querySelector("#connect").addEventListener("click", () => { window.location.href = `${API}/auth/zoho`; });

function render(data) {
  const outlets = data.outlets || [];
  const sales = outlets.reduce((sum, row) => sum + num(row.net_sales), 0);
  const gm = outlets.reduce((sum, row) => sum + num(row.gross_margin), 0);
  const avg = sales ? gm / sales * 100 : 0;
  document.querySelector("#status").textContent = "Live Zoho Analytics";
  document.querySelector("#status-dot").className = "live";
  document.querySelector("#connect").textContent = "Zoho connected";
  document.querySelector("#connect").disabled = true;
  document.querySelector("#kpis").innerHTML = [["Net sales", rupees(sales), `${outlets.length} outlets`], ["Gross margin", rupees(gm), `${avg.toFixed(2)}% theoretical GM`], ["Items at risk", data.actions?.length || 0, "Red and amber signals"], ["Planning source", "Live", "Zoho Analytics"]].map(([label, value, note]) => `<article><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
  const highest = Math.max(...outlets.map(row => num(row.gross_margin)), 1);
  document.querySelector("#outlets").innerHTML = outlets.map(row => `<div class="bar"><div><b>${html(row.store)}</b><small>${num(row.gross_margin_pct).toFixed(2)}% GM</small></div><i><span style="width:${num(row.gross_margin) / highest * 100}%"></span></i><b>${rupees(row.gross_margin)}</b></div>`).join("") || "No outlet rows returned.";
  const risk = (data.actions || [])[0];
  if (risk) { document.querySelector("#decision-title").textContent = `Protect ${risk.item_name}`; document.querySelector("#decision-copy").textContent = `${risk.risk_color} risk at ${risk.store}. ${rupees(risk.exposure)} margin exposure — take owner action today.`; }
  document.querySelector("#actions").innerHTML = (data.actions || []).map(row => `<tr><td><span class="pill ${String(row.risk_color).toLowerCase()}">${html(row.risk_color)}</span></td><td><b>${html(row.item_name)}</b></td><td>${html(row.store)}</td><td>${html(row.subject_type)}</td><td>${rupees(row.exposure)}</td><td>${html(row.impacted_menu_item_count || "—")}</td></tr>`).join("") || "<tr><td colspan='6'>No red or amber items in the current complete snapshot.</td></tr>";
  document.querySelector("#menu").innerHTML = (data.menu || []).slice(0, 6).map(row => `<p class="line"><b>${html(row.menu_item)}</b><span>${rupees(row.gross_margin)} · ${num(row.gross_margin_pct).toFixed(2)}%</span></p>`).join("");
  document.querySelector("#procurement").innerHTML = (data.procurement || []).slice(0, 6).map(row => `<p class="line"><b>${html(row.vendor_name)}</b><span>${html(row.store)} · ${rupees(row.open_liability)}</span></p>`).join("");
}

async function load() {
  try {
    const response = await fetch(`${API}/api/tower`, { credentials: "include" });
    const payload = await response.json();
    if (response.status === 401) return;
    if (!response.ok) throw new Error(payload.message || "Live data unavailable");
    render(payload.data);
  } catch (error) { document.querySelector("#status").textContent = "Live connection needs attention"; document.querySelector("#decision-copy").textContent = error.message; }
}
load();
