import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np
import seaborn as sns
from matplotlib.patches import Patch

# Load data, skipping the two sub-header rows (full question text + import IDs)
df = pd.read_csv("Maestro Survey_March 28, 2026_09.42.csv", header=0, skiprows=[1, 2])

# --- NASA TLX columns and labels ---
tlx_cols = [
    "Mental Demand",
    "Physical Demand",
    "Temporal Demand",
    "Performance",
    "Effort",
    "Frustration",
]
tlx_labels = [
    "Mental\nDemand",
    "Physical\nDemand",
    "Temporal\nDemand",
    "Performance*",
    "Effort",
    "Frustration",
]

tlx_data = df[tlx_cols].astype(float)

# --- Likert data ---
likert_cols = [
    "Creativity 1",
    "Creativity 2",
    "Agency 1",
    "Agency 2",
    "Ownership 1",
    "Ownership 2",
]
likert_labels = [
    "I felt creative while\nusing the system",
    "The input method\nconstrained my creativity*",
    "I felt in control\nof the outcome",
    "The system overrode or failed to\nrespond to my intentions*",
    "I felt responsible\nfor the final output",
    "I felt the AI was responsible\nfor the final output",
]

# Reverse-code negatively-worded items (indices 1 and 3): 1<->5, 2<->4
likert_data = df[likert_cols].astype(float).copy()
likert_data["Creativity 2"] = 6 - likert_data["Creativity 2"]
likert_data["Agency 2"] = 6 - likert_data["Agency 2"]
n_respondents = len(likert_data)

# Diverging colour scheme: red (disagree) -> grey (neutral) -> blue (agree)
colors = {
    1: "#c1272d",  # Strongly disagree — dark red
    2: "#ef8a62",  # Somewhat disagree — light red
    3: "#cccccc",  # Neither — grey
    4: "#67a9cf",  # Somewhat agree — light blue
    5: "#2166ac",  # Strongly agree — dark blue
}
response_labels = {
    1: "Strongly disagree",
    2: "Somewhat disagree",
    3: "Neither",
    4: "Somewhat agree",
    5: "Strongly agree",
}

# =====================================================================
# Combined figure with aligned subplots
# =====================================================================
fig, (ax2, ax1) = plt.subplots(1, 2, figsize=(18, 5))

# --- Top: Beeswarm (NASA TLX) ---
rng = np.random.default_rng(42)
tlx_long = tlx_data.melt(var_name="Item", value_name="Score")
tlx_long["Item"] = pd.Categorical(tlx_long["Item"], categories=tlx_cols, ordered=True)
tlx_long["Score"] = tlx_long["Score"] + rng.uniform(-0.05, 0.05, size=len(tlx_long))

sns.swarmplot(data=tlx_long, x="Score", y="Item", color="#4878CF",
              edgecolor="white", linewidth=0.5, size=7, ax=ax1)

ax1.set_yticklabels(tlx_labels, fontsize=11)
ax1.set_xlim(0.5, 7.5)
ax1.set_xticks(range(1, 8))
ax1.set_xticklabels(["1\nVery Low\n(Performance: Perfect*)", "2", "3", "4", "5", "6",
                      "7\nVery High\n(Performance: Failure*)"], fontsize=10)
ax1.grid(axis="x", linestyle="--", alpha=0.3)
ax1.set_xlabel("")
ax1.set_ylabel("")
ax1.set_title("Raw NASA TLX Responses", fontsize=14, pad=10)

# --- Bottom: Stacked bar (Likert) ---
for i, col in enumerate(likert_cols):
    vals = likert_data[col].dropna().values.astype(int)
    counts = {k: 0 for k in range(1, 6)}
    for v in vals:
        counts[v] += 1
    left = 0
    for level in range(1, 6):
        ax2.barh(i, counts[level], left=left,
                 color=colors[level], edgecolor="white", linewidth=0.5, height=0.6)
        left += counts[level]

ax2.set_yticks(range(len(likert_cols)))
ax2.set_yticklabels(likert_labels, fontsize=11)
ax2.invert_yaxis()
ax2.set_xlim(0, n_respondents)
ax2.set_xticks(range(0, n_respondents + 1))
ax2.tick_params(axis="x", labelsize=10)
ax2.set_xlabel("Number of responses", fontsize=11)
ax2.set_title("Creative Process Responses", fontsize=14, pad=10)

legend_handles = [Patch(facecolor=colors[k], edgecolor="white", label=response_labels[k])
                  for k in range(1, 6)]
ax2.legend(handles=legend_handles, loc="lower center", bbox_to_anchor=(0.5, -0.18),
           ncol=5, fontsize=10, frameon=False)

# Align plot edges: fix the top and bottom margins so both axes line up
fig.subplots_adjust(top=0.90, bottom=0.18, wspace=0.45)

fig.savefig("survey_results.png", dpi=200, bbox_inches="tight")
print("Saved survey_results.png")

plt.show()
