// Forks in the Forecast: prototype
// One region selection drives every chart on the page.

// ---------- shared settings ----------
const regionNames = {
  "Arabian-Peninsula": "Arabian Peninsula", "C.Australia": "Central Australia",
  "C.North-America": "Central North America", "Caribbean": "Caribbean",
  "Central-Africa": "Central Africa", "E.Antarctica": "East Antarctica",
  "E.Asia": "East Asia", "E.Australia": "Eastern Australia",
  "E.C.Asia": "East Central Asia", "E.Europe": "Eastern Europe",
  "E.North-America": "Eastern North America", "E.Siberia": "East Siberia",
  "E.Southern-Africa": "East Southern Africa", "Greenland/Iceland": "Greenland and Iceland",
  "Madagascar": "Madagascar", "Mediterranean": "Mediterranean",
  "N.Australia": "Northern Australia", "N.Central-America": "Northern Central America",
  "N.E.North-America": "Northeastern North America", "N.E.South-America": "Northeastern South America",
  "N.Eastern-Africa": "Northeastern Africa", "N.Europe": "Northern Europe",
  "N.South-America": "Northern South America", "N.W.North-America": "Northwestern North America",
  "N.W.South-America": "Northwestern South America", "New-Zealand": "New Zealand",
  "Russian-Arctic": "Russian Arctic", "Russian-Far-East": "Russian Far East",
  "S.Asia": "South Asia", "S.Australia": "Southern Australia",
  "S.Central-America": "Southern Central America", "S.E.Asia": "Southeast Asia",
  "S.E.South-America": "Southeastern South America", "S.Eastern-Africa": "Southeastern Africa",
  "S.South-America": "Southern South America", "S.W.South-America": "Southwestern South America",
  "Sahara": "Sahara", "South-American-Monsoon": "South American Monsoon",
  "Tibetan-Plateau": "Tibetan Plateau", "W.Antarctica": "West Antarctica",
  "W.C.Asia": "West Central Asia", "W.North-America": "Western North America",
  "W.Siberia": "West Siberia", "W.Southern-Africa": "West Southern Africa",
  "West&Central-Europe": "Western and Central Europe", "Western-Africa": "Western Africa"
};
const pretty = r => regionNames[r] || r.replace(/[.-]/g, " ");

const colors = {
  historical: "#555", ssp126: "#1a9850", ssp245: "#fdae61",
  ssp370: "#f46d43", ssp585: "#a50026"
};
const textColors = { ...colors, ssp245: "#d4861f" };   // darker orange so text stays readable
const names = {
  historical: "Historical", ssp126: "SSP1-2.6 (low emissions)", ssp245: "SSP2-4.5 (middle)",
  ssp370: "SSP3-7.0 (high)", ssp585: "SSP5-8.5 (very high)"
};
const shortNames = { ssp126: "Low", ssp245: "Middle", ssp370: "High", ssp585: "Very high" };
const futures = ["ssp126", "ssp245", "ssp370", "ssp585"];
const fmt = d3.format("+.1f");
const W = 850;

const state = { region: "W.North-America", active: new Set(["historical", ...futures]), threshold: 2 };
const tooltip = d3.select("#tooltip");

function showTip(e, html) {
  const left = e.clientX > window.innerWidth - 360 ? e.pageX - 350 : e.pageX + 14;
  tooltip.style("display", "block").style("left", left + "px").style("top", (e.pageY - 14) + "px").html(html);
}
const hideTip = () => tooltip.style("display", "none");

function makeSvg(sel, height, margin) {
  const svg = d3.select(sel).append("svg").attr("viewBox", [0, 0, W, height]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  return { g, w: W - margin.left - margin.right, h: height - margin.top - margin.bottom };
}

// ---------- load data once, then build every chart ----------
d3.csv("data/climate_paths.csv", d3.autoType).then(raw => {
  const data = raw.filter(d => d.year <= 2100);
  const byKey = d3.group(data, d => d.region, d => d.scenario);
  const rowsFor = (r, s) => (byKey.get(r) && byKey.get(r).get(s)) || [];
  const late = (r, s) => d3.mean(rowsFor(r, s).filter(d => d.year >= 2081), d => d.median);
  const crossing = (r, s, t) => {
    const hit = [...rowsFor(r, "historical"), ...rowsFor(r, s)].find(d => d.median >= t);
    return hit ? hit.year : null;
  };

  const regions = [...byKey.keys()].sort((a, b) => pretty(a).localeCompare(pretty(b)));
  if (!regions.includes(state.region)) state.region = regions[0];

  // region picker + quick picks
  const select = d3.select("#region-select");
  select.selectAll("option").data(regions).join("option").attr("value", d => d).text(pretty);
  select.property("value", state.region).on("change", e => setRegion(e.target.value));

  const gaps = regions.map(r => ({ region: r, gap: late(r, "ssp585") - late(r, "ssp126") }))
    .sort((a, b) => b.gap - a.gap);
  const hottest = [...regions].sort((a, b) => late(b, "ssp585") - late(a, "ssp585"));
  const picks = [
    { label: "Western North America", region: "W.North-America" },
    { label: `Fastest: ${pretty(hottest[0])}`, region: hottest[0] },
    { label: `Slowest: ${pretty(hottest[hottest.length - 1])}`, region: hottest[hottest.length - 1] }
  ];
  const quick = d3.select("#quick-picks");
  quick.append("span").text("Try: ");
  quick.selectAll("button").data(picks).join("button").attr("class", "pick").text(d => d.label)
    .on("click", (e, d) => setRegion(d.region));

  const stripes = buildStripes(rowsFor);
  const fork = buildFork(rowsFor);
  const threshold = buildThreshold(crossing);
  const cost = buildCost(gaps);

  d3.select("#threshold").on("input", e => {
    state.threshold = +e.target.value;
    d3.select("#threshold-value").text(`${fmt(state.threshold)}°C`);
    threshold.update();
  });

  function setRegion(r) {
    state.region = r;
    select.property("value", r);
    d3.selectAll(".region-name").text(pretty(r));
    stripes.update(); fork.update(); threshold.update(); cost.update();

    const lo = late(r, "ssp126"), hi = late(r, "ssp585");
    const rank = gaps.findIndex(d => d.region === r) + 1;
    const rankText = rank === 1 ? "the largest gap" : `the ${ordinal(rank)} largest gap`;
    d3.select("#takeaway").html(
      `<strong>Therefore:</strong> in ${pretty(r)}, taking the low path instead of the very high one avoids about ` +
      `<strong>${(hi - lo).toFixed(1)}°C</strong> of warming by the end of the century (${fmt(lo)}°C instead of ${fmt(hi)}°C). ` +
      `That is ${rankText} of all ${gaps.length} regions. The future is not fixed: the path we choose still matters.`);
  }

  setRegion(state.region);
});

const ordinal = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

// ---------- 1. warming stripes (historical) ----------
function buildStripes(rowsFor) {
  const { g, w, h } = makeSvg("#stripes", 150, { top: 10, right: 10, bottom: 30, left: 10 });
  const x = d3.scaleBand().domain(d3.range(1850, 2015)).range([0, w]).padding(0);
  const color = d3.scaleDiverging(t => d3.interpolateRdBu(1 - t)).domain([-1, 0, 2.5]).clamp(true);
  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(d3.range(1860, 2015, 20)).tickSizeOuter(0));
  const bars = g.append("g");

  function update() {
    const rows = rowsFor(state.region, "historical").filter(d => d.year <= 2014);
    bars.selectAll("rect").data(rows, d => d.year).join("rect")
      .attr("x", d => x(d.year)).attr("width", x.bandwidth() + 0.5).attr("y", 0).attr("height", h)
      .on("mousemove", (e, d) => showTip(e, `<strong>${d.year}</strong><br>${fmt(d.median)}°C vs 1850-1900`))
      .on("mouseleave", hideTip)
      .transition().duration(400).attr("fill", d => color(d.median));
    const last = rows[rows.length - 1];
    d3.select("#stripes-note").html(
      `By 2014, ${pretty(state.region)} had already warmed about <strong>${fmt(last.median)}°C</strong> ` +
      `(10-year average). Every scenario starts from here.`);
  }
  return { update };
}

// ---------- 2. the fork: lines + model-range bands ----------
function buildFork(rowsFor) {
  const margin = { top: 20, right: 80, bottom: 36, left: 52 };
  const { g, w, h } = makeSvg("#fork", 440, margin);
  const x = d3.scaleLinear().domain([1850, 2100]).range([0, w]);
  const y = d3.scaleLinear().range([h, 0]);
  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  const yAxis = g.append("g");
  g.append("text").attr("x", -h / 2).attr("y", -38).attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle").attr("font-size", 13).text("Warming vs 1850-1900 (°C)");
  g.append("line").attr("x1", x(2015)).attr("x2", x(2015)).attr("y1", 0).attr("y2", h)
    .attr("stroke", "#999").attr("stroke-dasharray", "4 4");
  g.append("text").attr("x", x(2015) + 5).attr("y", 12).attr("font-size", 12).attr("fill", "#666").text("Paths split");
  const ref = g.append("g"), plot = g.append("g");

  const area = d3.area().x(d => x(d.year)).y0(d => y(d.low)).y1(d => y(d.high));
  const line = d3.line().x(d => x(d.year)).y(d => y(d.median));
  let current = [];

  d3.select("#scenario-toggles").selectAll("button").data(futures).join("button")
    .attr("class", "toggle on").style("--c", d => colors[d]).text(d => names[d])
    .on("click", (e, d) => {
      state.active.has(d) ? state.active.delete(d) : state.active.add(d);
      d3.select(e.currentTarget).classed("on", state.active.has(d));
      update();
    });

  // hover layer
  const hoverLine = g.append("line").attr("y1", 0).attr("y2", h).attr("stroke", "#333")
    .style("pointer-events", "none").style("display", "none");
  g.append("rect").attr("width", w).attr("height", h).attr("fill", "transparent").style("cursor", "crosshair")
    .on("mousemove", e => {
      const year = Math.round(x.invert(d3.pointer(e)[0]));
      const rows = current.filter(d => d.year === year);
      if (!rows.length) return;
      hoverLine.style("display", null).attr("x1", x(year)).attr("x2", x(year));
      marks.style("display", null);
      marks.selectAll("circle").data(rows, d => d.scenario).join("circle")
        .attr("cx", x(year)).attr("cy", d => y(d.median)).attr("r", 5)
        .attr("fill", d => colors[d.scenario]).attr("stroke", "#fff").attr("stroke-width", 2);
      showTip(e, `<strong>${year}</strong><br>` + rows.sort((a, b) => b.median - a.median)
        .map(d => `<span class="dot" style="background:${colors[d.scenario]}"></span>${names[d.scenario]}: ` +
          `${fmt(d.median)}°C <span style="color:#888">(${fmt(d.low)} to ${fmt(d.high)})</span>`).join("<br>"));
    })
    .on("mouseleave", () => { hoverLine.style("display", "none"); marks.style("display", "none"); hideTip(); });
  const marks = g.append("g").style("pointer-events", "none");

  function update() {
    const keys = ["historical", ...futures].filter(k => state.active.has(k));
    const series = keys.map(k => [k, rowsFor(state.region, k)]);
    current = series.flatMap(s => s[1]);
    y.domain([Math.min(0, d3.min(current, d => d.low)), d3.max(current, d => d.high)]).nice();
    yAxis.transition().duration(500).call(d3.axisLeft(y));

    plot.selectAll(".band").data(series, d => d[0]).join("path").attr("class", "band")
      .attr("fill", d => colors[d[0]]).attr("opacity", 0.12)
      .transition().duration(500).attr("d", d => area(d[1]));
    plot.selectAll(".path").data(series, d => d[0]).join("path").attr("class", "path")
      .attr("fill", "none").attr("stroke", d => colors[d[0]]).attr("stroke-width", 2)
      .transition().duration(500).attr("d", d => line(d[1]));

    const show2 = y.domain()[1] > 2;
    ref.selectAll("line").data(show2 ? [2] : []).join("line").attr("x1", 0).attr("x2", w)
      .attr("stroke", "#333").attr("stroke-dasharray", "2 4").attr("opacity", 0.6)
      .transition().duration(500).attr("y1", y(2)).attr("y2", y(2));
    ref.selectAll("text").data(show2 ? [2] : []).join("text").attr("x", 4).attr("font-size", 11).text("+2°C")
      .transition().duration(500).attr("y", y(2) - 4);

    // end labels, nudged apart
    const labels = series.filter(s => s[0] !== "historical")
      .map(([k, rows]) => ({ k, y: y(rows[rows.length - 1].median) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 14);
    plot.selectAll(".label").data(labels, d => d.k).join("text").attr("class", "label")
      .attr("x", w + 6).attr("font-size", 12).attr("font-weight", 600).attr("dominant-baseline", "middle")
      .attr("fill", d => textColors[d.k]).text(d => shortNames[d.k])
      .transition().duration(500).attr("y", d => d.y);

    const lo = rowsFor(state.region, "ssp126").at(-1), hi = rowsFor(state.region, "ssp585").at(-1);
    d3.select("#fork-note").html(
      `By 2100, ${pretty(state.region)} reaches about <strong>${fmt(lo.median)}°C</strong> on the low path ` +
      `and <strong>${fmt(hi.median)}°C</strong> on the very high path. Same past, very different futures.`);
  }
  return { update };
}

// ---------- 3. threshold timeline ----------
function buildThreshold(crossing) {
  const margin = { top: 16, right: 30, bottom: 36, left: 150 };
  const { g, w, h } = makeSvg("#threshold-chart", 220, margin);
  const plotW = w - 90;
  const x = d3.scaleLinear().domain([1950, 2100]).range([0, plotW]);
  const y = d3.scaleBand().domain(futures).range([0, h]).padding(0.3);
  const neverX = w - 40;

  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y).tickFormat(k => names[k]).tickSize(0))
    .call(a => a.select(".domain").remove()).selectAll("text").attr("font-size", 12)
    .attr("fill", k => textColors[k]).attr("font-weight", 600);
  g.selectAll(".row").data(futures).join("line").attr("class", "row")
    .attr("x1", 0).attr("x2", w).attr("y1", k => y(k) + y.bandwidth() / 2).attr("y2", k => y(k) + y.bandwidth() / 2)
    .attr("stroke", "#eee");
  g.append("line").attr("x1", x(2015)).attr("x2", x(2015)).attr("y1", 0).attr("y2", h)
    .attr("stroke", "#999").attr("stroke-dasharray", "4 4");
  g.append("line").attr("x1", plotW + 30).attr("x2", plotW + 30).attr("y1", 0).attr("y2", h).attr("stroke", "#ddd");
  g.append("text").attr("x", neverX).attr("y", h + 24).attr("text-anchor", "middle")
    .attr("font-size", 11).attr("fill", "#666").text("not by 2100");
  const dots = g.append("g");

  function update() {
    const t = state.threshold;
    const rows = futures.map(k => ({ k, year: crossing(state.region, k, t) }));
    const px = d => d.year == null ? neverX : x(Math.max(1950, d.year));
    const sel = dots.selectAll("g.dot").data(rows, d => d.k).join(enter => {
      const e = enter.append("g").attr("class", "dot");
      e.append("circle").attr("r", 8).attr("stroke", "#fff").attr("stroke-width", 2);
      e.append("text").attr("font-size", 12).attr("font-weight", 600).attr("dy", -12).attr("text-anchor", "middle");
      return e;
    });
    sel.attr("transform", d => `translate(${px(d)},${y(d.k) + y.bandwidth() / 2})`)
      .on("mousemove", (e, d) => showTip(e, `${names[d.k]}: ` +
        (d.year == null ? `does not reach ${fmt(t)}°C by 2100` : `reaches ${fmt(t)}°C in ${d.year}`)))
      .on("mouseleave", hideTip);
    sel.select("circle").attr("fill", d => d.year == null ? "#fff" : colors[d.k])
      .attr("stroke", d => d.year == null ? colors[d.k] : "#fff");
    sel.select("text").attr("fill", d => textColors[d.k]).text(d => d.year == null ? "" : d.year);

    const lo = rows[0], hi = rows[3];
    let note;
    if (hi.year == null) note = `${pretty(state.region)} does not reach ${fmt(t)}°C by 2100 on any path.`;
    else if (lo.year != null && lo.year < 2015) note = `${pretty(state.region)} had already passed ${fmt(t)}°C by ${lo.year}, before the paths split.`;
    else if (lo.year == null) note = `On the very high path, ${pretty(state.region)} reaches ${fmt(t)}°C around ${hi.year}. On the low path, it never does.`;
    else note = `On the very high path, ${pretty(state.region)} reaches ${fmt(t)}°C around ${hi.year}. On the low path, around ${lo.year}.`;
    d3.select("#threshold-note").text(note);
  }
  return { update };
}

// ---------- 4. cost of the path: ranking of all regions ----------
function buildCost(gaps) {
  const margin = { top: 10, right: 50, bottom: 36, left: 200 };
  const { g, w, h } = makeSvg("#cost", gaps.length * 15 + 46, margin);
  const y = d3.scaleBand().domain(gaps.map(d => d.region)).range([0, h]).padding(0.2);
  const x = d3.scaleLinear().domain([0, d3.max(gaps, d => d.gap)]).nice().range([0, w]);
  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d => d + "°C"));
  const yAx = g.append("g").call(d3.axisLeft(y).tickFormat(pretty).tickSize(0)).call(a => a.select(".domain").remove());
  yAx.selectAll("text").attr("font-size", 10);
  const bars = g.selectAll("rect").data(gaps).join("rect")
    .attr("y", d => y(d.region)).attr("height", y.bandwidth()).attr("x", 0).attr("width", d => x(d.gap))
    .on("mousemove", (e, d) => showTip(e, `<strong>${pretty(d.region)}</strong><br>+${d.gap.toFixed(1)}°C more warming on the very high path`))
    .on("mouseleave", hideTip);
  const val = g.selectAll(".val").data(gaps).join("text").attr("class", "val")
    .attr("x", d => x(d.gap) + 4).attr("y", d => y(d.region) + y.bandwidth() / 2 + 3)
    .attr("font-size", 10).text(d => d.gap.toFixed(1));

  function update() {
    const sel = d => d.region === state.region;
    bars.transition().duration(300).attr("fill", d => sel(d) ? "#a50026" : "#d9d9d9");
    val.attr("fill", d => sel(d) ? "#a50026" : "#888").attr("font-weight", d => sel(d) ? 700 : 400);
    yAx.selectAll("text").attr("font-weight", r => r === state.region ? 700 : 400)
      .attr("fill", r => r === state.region ? "#a50026" : "#333");
  }
  return { update };
}
