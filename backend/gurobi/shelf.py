from __future__ import annotations

import gurobipy as gp
from gurobipy import GRB


def optimize_shelf(clusters, scores, fixed_left=None, fixed_right=None,
                   left_of=None, fixed_pos=None):
    if len(clusters) <= 1:
        return list(clusters)

    count = len(clusters)
    visibility = {position: (count - position) / count for position in range(count)}

    model = gp.Model("gondol_shelf_order")
    model.Params.OutputFlag = 0
    x = model.addVars(clusters, range(count), vtype=GRB.BINARY, name="x")
    position = {
        cluster: gp.quicksum(index * x[cluster, index] for index in range(count))
        for cluster in clusters
    }

    for cluster in clusters:
        model.addConstr(gp.quicksum(x[cluster, index] for index in range(count)) == 1)
    for index in range(count):
        model.addConstr(gp.quicksum(x[cluster, index] for cluster in clusters) == 1)

    for cluster, index in (fixed_pos or {}).items():
        if cluster in clusters:
            model.addConstr(position[cluster] == index)
    if fixed_left and fixed_left in clusters:
        model.addConstr(position[fixed_left] == 0)
    if fixed_right and fixed_right in clusters:
        model.addConstr(position[fixed_right] == count - 1)
    for left, right in (left_of or []):
        if left in clusters and right in clusters:
            model.addConstr(position[left] <= position[right] - 1)

    model.setObjective(
        gp.quicksum(
            scores[cluster] * visibility[index] * x[cluster, index]
            for cluster in clusters for index in range(count)
        ),
        GRB.MAXIMIZE,
    )
    model.optimize()
    if model.Status != GRB.OPTIMAL:
        return list(clusters)
    return sorted(
        clusters,
        key=lambda cluster: sum(index * x[cluster, index].X for index in range(count)),
    )

