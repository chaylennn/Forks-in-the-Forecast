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

// regions grouped by part of the world for the dropdown
const regionGroups = [
  ["North America", ["W.North-America", "C.North-America", "E.North-America", "N.W.North-America", "N.E.North-America"]],
  ["Central America & Caribbean", ["N.Central-America", "S.Central-America", "Caribbean"]],
  ["South America", ["N.W.South-America", "N.South-America", "N.E.South-America", "South-American-Monsoon",
    "S.W.South-America", "S.E.South-America", "S.South-America"]],
  ["Europe", ["N.Europe", "West&Central-Europe", "E.Europe", "Mediterranean"]],
  ["Africa", ["Sahara", "Western-Africa", "Central-Africa", "N.Eastern-Africa", "S.Eastern-Africa",
    "W.Southern-Africa", "E.Southern-Africa", "Madagascar"]],
  ["Asia", ["Arabian-Peninsula", "W.C.Asia", "E.C.Asia", "Tibetan-Plateau", "E.Asia", "S.Asia", "S.E.Asia",
    "W.Siberia", "E.Siberia", "Russian-Far-East"]],
  ["Oceania", ["N.Australia", "C.Australia", "E.Australia", "S.Australia", "New-Zealand"]],
  ["Polar regions", ["Greenland/Iceland", "Russian-Arctic", "E.Antarctica", "W.Antarctica"]]
];

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

// charts animate the first time they scroll into view
const revealed = { stripes: false, fork: false, threshold: false, cost: false };
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  // grouped by part of the world, alphabetical inside each group; anything unlisted goes in "Other"
  const listed = new Set(regionGroups.flatMap(g => g[1]));
  const groups = regionGroups.map(([name, rs]) => [name, rs.filter(r => regions.includes(r))]);
  const other = regions.filter(r => !listed.has(r));
  if (other.length) groups.push(["Other", other]);
  select.selectAll("optgroup").data(groups.filter(g => g[1].length)).join("optgroup")
    .attr("label", d => d[0])
    .selectAll("option").data(d => [...d[1]].sort((a, b) => pretty(a).localeCompare(pretty(b))))
    .join("option").attr("value", d => d).text(pretty);
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
  const fork = buildFork(rowsFor, late);
  const threshold = buildThreshold(crossing);
  const cost = buildCost(gaps, late);

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
      `In ${pretty(r)}, taking the low path instead of the very high one avoids about ` +
      `<strong>${(hi - lo).toFixed(1)}°C</strong> of warming by the end of the century (${fmt(lo)}°C instead of ${fmt(hi)}°C). ` +
      `That is ${rankText} of all ${gaps.length} regions. The future is not fixed: the path we choose still matters.`);
  }

  setRegion(state.region);

  // scroll effects: fade each section in and play its chart animation once
  const charts = { stripes, fork, threshold, cost };
  const steps = document.querySelectorAll(".step");
  if (!("IntersectionObserver" in window) || reduceMotion) {
    steps.forEach(el => el.classList.add("in"));
    Object.values(charts).forEach(c => c.reveal(false));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        const c = charts[entry.target.dataset.chart];
        if (c) setTimeout(() => c.reveal(true), 250);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    steps.forEach(el => io.observe(el));
  }
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
    bars.selectAll("rect").data(rows, d => d.year)
      .join(enter => enter.append("rect").attr("opacity", revealed.stripes ? 1 : 0))
      .attr("x", d => x(d.year)).attr("width", x.bandwidth() + 0.5).attr("y", 0).attr("height", h)
      .on("mousemove", (e, d) => showTip(e, `<strong>${d.year}</strong><br>${fmt(d.median)}°C vs 1850-1900`))
      .on("mouseleave", hideTip)
      .transition().duration(400).attr("fill", d => color(d.median));
    const last = rows[rows.length - 1];
    d3.select("#stripes-note").html(
      `By 2014, ${pretty(state.region)} had already warmed about <strong>${fmt(last.median)}°C</strong> ` +
      `(10-year average). Every scenario starts from here.`);
  }
  // fill the stripes in year by year
  function reveal(animate) {
    revealed.stripes = true;
    const r = bars.selectAll("rect");
    if (!animate) { r.attr("opacity", 1); return; }
    r.transition("reveal").delay((d, i) => i * 9).duration(250).attr("opacity", 1);
  }
  return { update, reveal };
}

// ---------- 2. the fork: lines + model-range bands ----------
function buildFork(rowsFor, late) {
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

  // clip used to "draw" the chart left to right on first view
  const clipRect = d3.select(g.node().ownerSVGElement).append("defs").append("clipPath").attr("id", "fork-clip")
    .append("rect").attr("x", -2).attr("y", -20).attr("height", h + 40).attr("width", revealed.fork ? w + 90 : 0);
  plot.attr("clip-path", "url(#fork-clip)");

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

    const lo = late(state.region, "ssp126"), hi = late(state.region, "ssp585");
    d3.select("#fork-note").html(
      `By the end of the century (2081-2100 average), ${pretty(state.region)} is about <strong>${fmt(lo)}°C</strong> ` +
      `warmer on the low path and <strong>${fmt(hi)}°C</strong> warmer on the very high path. Same past, very different futures.`);
  }
  // draw the shared past first, pause at the fork, then let the four paths branch out
  function reveal(animate) {
    revealed.fork = true;
    if (!animate) { clipRect.attr("width", w + 90); return; }
    clipRect.attr("width", 0)
      .transition().duration(1400).ease(d3.easeCubicOut).attr("width", x(2015))
      .transition().delay(300).duration(2200).ease(d3.easeCubicInOut).attr("width", w + 90);
  }
  return { update, reveal };
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
    const pos = d => `translate(${px(d)},${y(d.k) + y.bandwidth() / 2})`;
    if (!revealed.threshold) {
      sel.attr("opacity", 0).attr("transform", d => `translate(${x(2015)},${y(d.k) + y.bandwidth() / 2})`);
    } else {
      sel.attr("opacity", 1).transition().duration(350).attr("transform", pos);
    }
    sel
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
  // dots start at the 2015 split and slide out to their years
  function reveal(animate) {
    revealed.threshold = true;
    const sel = dots.selectAll("g.dot");
    const t = state.threshold;
    const place = d => {
      const yr = crossing(state.region, d.k, t);
      const px = yr == null ? neverX : x(Math.max(1950, yr));
      return `translate(${px},${y(d.k) + y.bandwidth() / 2})`;
    };
    if (!animate) { sel.attr("opacity", 1).attr("transform", place); return; }
    sel.transition("reveal").delay((d, i) => i * 180).duration(900).ease(d3.easeCubicOut)
      .attr("opacity", 1).attr("transform", place);
  }
  return { update, reveal };
}

// ---------- 4. cost of the path: low vs very high warming per region ----------
function buildCost(gaps, late) {
  const all = gaps.map(d => ({ region: d.region, gap: d.gap, lo: late(d.region, "ssp126"), hi: late(d.region, "ssp585") }));
  const x0 = d3.max(all, d => d.hi);
  let showAll = false;

  const btn = d3.select("#cost-toggle").on("click", () => {
    showAll = !showAll;
    btn.text(showAll ? "Show fewer regions" : `Show all ${all.length} regions`);
    draw(false);
  });

  // short view: the 5 largest gaps, the 5 smallest, and the reader's region if it isn't already there
  function rowsToShow() {
    if (showAll) return all;
    const top = all.slice(0, 5), bottom = all.slice(-5);
    const mine = all.find(d => d.region === state.region);
    const rows = [...top];
    if (!top.includes(mine) && !bottom.includes(mine)) rows.push({ sep: "a" }, mine, { sep: "b" });
    else rows.push({ sep: "a" });
    return rows.concat(bottom);
  }

  function draw(animate) {
    d3.select("#cost").selectAll("svg").remove();
    const rows = rowsToShow();
    const rowH = showAll ? 18 : 30, font = showAll ? 11 : 13;
    const margin = { top: 34, right: 90, bottom: 36, left: showAll ? 190 : 220 };
    const { g, w, h } = makeSvg("#cost", rows.length * rowH + margin.top + margin.bottom, margin);
    const x = d3.scaleLinear().domain([0, x0]).nice().range([0, w]);
    const y = (d, i) => i * rowH + rowH / 2;

    // grid + axis
    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d => `+${d}°C`));
    g.append("g").selectAll("line").data(x.ticks()).join("line")
      .attr("x1", d => x(d)).attr("x2", d => x(d)).attr("y1", 0).attr("y2", h).attr("stroke", "#f0f0f0");
    g.append("text").attr("x", w / 2).attr("y", h + 32).attr("text-anchor", "middle").attr("font-size", 12)
      .attr("fill", "#555").text("Average warming in 2081-2100 vs 1850-1900");

    // legend
    const lg = g.append("g").attr("transform", "translate(0,-22)");
    [["ssp126", "Low path"], ["ssp585", "Very high path"]].forEach(([k, label], i) => {
      lg.append("circle").attr("cx", i * 130 + 6).attr("cy", 0).attr("r", 6).attr("fill", colors[k]);
      lg.append("text").attr("x", i * 130 + 16).attr("y", 4).attr("font-size", 12).text(label);
    });
    lg.append("text").attr("x", w + 10).attr("y", 4).attr("font-size", 11).attr("fill", "#666").text("gap");

    const row = g.selectAll(".row").data(rows).join("g").attr("class", "row")
      .attr("transform", (d, i) => `translate(0,${y(d, i)})`);

    // separators between the groups in the short view
    row.filter(d => d.sep).append("text").attr("x", -10).attr("text-anchor", "end").attr("dy", 4)
      .attr("font-size", 14).attr("fill", "#999").text("···");

    const real = row.filter(d => !d.sep);
    const isMine = d => d.region === state.region;
    real.append("rect").attr("x", -margin.left).attr("y", -rowH / 2).attr("width", w + margin.left + margin.right)
      .attr("height", rowH).attr("fill", d => isMine(d) ? "#fbeaec" : "transparent")
      .on("mousemove", (e, d) => showTip(e, `<strong>${pretty(d.region)}</strong><br>` +
        `<span class="dot" style="background:${colors.ssp126}"></span>Low path: ${fmt(d.lo)}°C<br>` +
        `<span class="dot" style="background:${colors.ssp585}"></span>Very high path: ${fmt(d.hi)}°C<br>` +
        `Gap: ${d.gap.toFixed(1)}°C`))
      .on("mouseleave", hideTip);
    real.append("text").attr("x", -10).attr("dy", 4).attr("text-anchor", "end").attr("font-size", font)
      .attr("font-weight", d => isMine(d) ? 700 : 400).attr("fill", d => isMine(d) ? "#a50026" : "#333")
      .text(d => pretty(d.region)).style("pointer-events", "none");

    const grow = animate && !revealed.cost;
    const line = real.append("line").attr("x1", d => x(d.lo)).attr("x2", d => grow ? x(d.lo) : x(d.hi))
      .attr("stroke", d => isMine(d) ? "#a50026" : "#bbb").attr("stroke-width", showAll ? 2 : 3)
      .style("pointer-events", "none");
    real.append("circle").attr("cx", d => x(d.lo)).attr("r", showAll ? 4.5 : 6).attr("fill", colors.ssp126)
      .style("pointer-events", "none");
    const hiDot = real.append("circle").attr("cx", d => grow ? x(d.lo) : x(d.hi)).attr("r", showAll ? 4.5 : 6)
      .attr("fill", colors.ssp585).attr("opacity", grow ? 0 : 1).style("pointer-events", "none");
    const gapText = real.append("text").attr("x", w + 10).attr("dy", 4).attr("font-size", font)
      .attr("font-weight", d => isMine(d) ? 700 : 400).attr("fill", d => isMine(d) ? "#a50026" : "#666")
      .attr("opacity", grow ? 0 : 1).text(d => `+${d.gap.toFixed(1)}°C`).style("pointer-events", "none");

    if (!revealed.cost && !animate) {   // not on screen yet: wait for the scroll reveal
      line.attr("x2", d => x(d.lo)); hiDot.attr("cx", d => x(d.lo)).attr("opacity", 0); gapText.attr("opacity", 0);
    }
    if (grow) {
      revealed.cost = true;
      line.transition().delay((d, i) => i * 60).duration(800).ease(d3.easeCubicOut).attr("x2", d => x(d.hi));
      hiDot.transition().delay((d, i) => i * 60).duration(800).ease(d3.easeCubicOut).attr("cx", d => x(d.hi)).attr("opacity", 1);
      gapText.transition().delay((d, i) => i * 60 + 600).duration(300).attr("opacity", 1);
    }
  }

  const update = () => draw(false);
  // lines stretch from the low path to the very high path, row by row
  function reveal(animate) {
    if (!animate) { revealed.cost = true; draw(false); return; }
    draw(true);
  }
  return { update, reveal };
}
