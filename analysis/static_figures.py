import pandas as pd, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm
d = pd.read_csv("../data/climate_paths.csv").query("year <= 2100")
C = {"historical":"#555","ssp126":"#1a9850","ssp245":"#e69138","ssp370":"#f46d43","ssp585":"#a50026"}
N = {"historical":"Historical","ssp126":"SSP1-2.6 (low)","ssp245":"SSP2-4.5 (middle)","ssp370":"SSP3-7.0 (high)","ssp585":"SSP5-8.5 (very high)"}
F = ["ssp126","ssp245","ssp370","ssp585"]
plt.rcParams.update({"font.size":11,"axes.spines.top":False,"axes.spines.right":False,"figure.dpi":150})
REG = "W.North-America"
out = "../images/"
def path(region, s):
    h = d.query("region==@region and scenario=='historical'")
    f = d.query("region==@region and scenario==@s")
    return pd.concat([h, f]).sort_values("year")

# 1 warming stripes, one row per future
fig, axes = plt.subplots(4,1, figsize=(11,4.2), sharex=True)
cmap = plt.get_cmap("RdBu_r"); norm = TwoSlopeNorm(vcenter=0, vmin=-1.5, vmax=8)
for ax, s in zip(axes, F):
    p = path(REG, s)
    ax.bar(p.year, 1, width=1, color=cmap(norm(p["median"].values)))
    ax.set_yticks([]); ax.set_ylim(0,1)
    for sp in ax.spines.values(): sp.set_visible(False)
    ax.text(1848, 0.5, N[s], ha="right", va="center", fontsize=10, color=C[s], fontweight="bold")
    ax.axvline(2014.5, color="k", lw=1)
axes[0].text(2016, 1.15, "paths split", fontsize=9, transform=axes[0].get_xaxis_transform())
axes[-1].set_xlim(1850,2100)
sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
cb = fig.colorbar(sm, ax=axes, fraction=0.025, pad=0.01); cb.set_label("Warming vs 1850-1900 (°C)")
fig.suptitle(f"Warming stripes for {REG}: one past, four futures", x=0.45, fontsize=13, fontweight="bold")
fig.savefig(out+"fig1_stripes.png", bbox_inches="tight"); plt.close()

# 2 land average paths with bands
g = d.groupby(["scenario","year"])[["median","low","high"]].mean().reset_index()
fig, ax = plt.subplots(figsize=(10,5))
for s, x in g.groupby("scenario"):
    ax.fill_between(x.year, x.low, x.high, color=C[s], alpha=0.15, lw=0)
    ax.plot(x.year, x["median"], color=C[s], lw=2, label=N[s])
ax.axvline(2015, ls="--", c="gray", lw=1); ax.axhline(0, c="#ccc", lw=1)
last = g.query("year==2014")["median"].iloc[0]
ax.annotate(f"Already about +{last:.1f}°C\nby 2014", xy=(2014, last), xytext=(1945, last+1.6),
            arrowprops=dict(arrowstyle="->", color="#333"), fontsize=10)
ax.set(title="Average of 46 land regions: the fork after 2015", xlabel="Year", ylabel="Warming vs 1850-1900 (°C)", xlim=(1850,2100))
ax.legend(frameon=False, loc="upper left", fontsize=9)
fig.savefig(out+"fig2_land_paths.png", bbox_inches="tight"); plt.close()

# 3 small multiples
regs = ["W.North-America","Mediterranean","S.Asia","Western-Africa","N.Europe","Russian-Arctic"]
fig, axes = plt.subplots(2,3, figsize=(12,6.5), sharex=True, sharey=True)
for ax, r in zip(axes.flat, regs):
    for s in ["historical"]+F:
        x = d.query("region==@r and scenario==@s")
        ax.fill_between(x.year, x.low, x.high, color=C[s], alpha=0.12, lw=0)
        ax.plot(x.year, x["median"], color=C[s], lw=1.6)
    ax.axvline(2015, ls="--", c="gray", lw=0.8); ax.set_title(r, fontsize=11)
fig.supylabel("Warming vs 1850-1900 (°C)"); fig.supxlabel("Year")
fig.legend([plt.Line2D([],[],color=C[s],lw=2) for s in F], [N[s] for s in F], loc="lower center", ncol=4, frameon=False, bbox_to_anchor=(0.5,-0.04))
fig.suptitle("Same scenarios, very different outcomes by region", fontsize=13, fontweight="bold")
fig.tight_layout(); fig.savefig(out+"fig3_regions.png", bbox_inches="tight"); plt.close()

# 4 threshold crossing years for one region
th = [1.5, 2.0, 3.0, 4.0]
fig, ax = plt.subplots(figsize=(10,4.5))
for i, s in enumerate(F):
    p = path(REG, s)
    for j, t in enumerate(th):
        hit = p[p["median"] >= t]
        yv = j + (i-1.5)*0.16
        if len(hit):
            ax.scatter(hit.year.iloc[0], yv, color=C[s], s=60, zorder=3)
        else:
            ax.scatter(2104, yv, color=C[s], s=60, marker="x", zorder=3)
ax.set_yticks(range(len(th))); ax.set_yticklabels([f"+{t:g}°C" for t in th])
ax.axvline(2101, color="#ddd"); ax.text(2104, len(th)-0.5, "not by\n2100", ha="center", fontsize=9, color="#666")
ax.set(xlim=(1990,2110), title=f"{REG}: when does each warming threshold arrive?", xlabel="Year first reached (7-model median)")
ax.legend(handles=[plt.Line2D([],[],marker="o",ls="",color=C[s]) for s in F], labels=[N[s] for s in F], frameon=False, fontsize=9, loc="lower left")
fig.savefig(out+"fig4_thresholds.png", bbox_inches="tight"); plt.close()

# 5 cost of the path: extra warming SSP5-8.5 vs SSP1-2.6, all regions
late = d.query("year>=2081").groupby(["region","scenario"])["median"].mean().unstack()
gap = (late.ssp585 - late.ssp126).sort_values()
fig, ax = plt.subplots(figsize=(8,11))
cols = plt.get_cmap("Reds")((gap - gap.min())/(gap.max()-gap.min())*0.7+0.3)
ax.barh(gap.index, gap.values, color=cols)
for y, v in enumerate(gap.values): ax.text(v+0.05, y, f"{v:.1f}", va="center", fontsize=8)
ax.set(title="Extra warming by 2081-2100 if we take the\nvery high path instead of the low path", xlabel="SSP5-8.5 minus SSP1-2.6 (°C)")
ax.tick_params(axis="y", labelsize=8)
fig.savefig(out+"fig5_cost.png", bbox_inches="tight"); plt.close()

# 6 how fast: warming rate per decade, past vs future
def rate(x, a, b):
    x = x[(x.year>=a)&(x.year<=b)]
    return np.polyfit(x.year, x["median"], 1)[0]*10
gr = g  # land average
past = rate(gr.query("scenario=='historical'"), 1950, 2014)
vals = [("1950-2014\n(historical runs)", past, "#555")] + [(N[s].replace(" (","\n("), rate(gr.query("scenario==@s"), 2015, 2060), C[s]) for s in F]
fig, ax = plt.subplots(figsize=(9,4.5))
ax.bar([v[0] for v in vals], [v[1] for v in vals], color=[v[2] for v in vals])
for i, v in enumerate(vals): ax.text(i, v[1]+0.01, f"{v[1]:.2f}", ha="center", fontsize=10)
ax.set(title="How fast is it warming? Land average, past vs 2015-2060", ylabel="°C per decade")
ax.tick_params(axis="x", labelsize=9)
fig.savefig(out+"fig6_rate.png", bbox_inches="tight"); plt.close()
print("past", round(past,3)); print(gap.tail(3).round(2).to_dict()); print(gap.head(3).round(2).to_dict())
