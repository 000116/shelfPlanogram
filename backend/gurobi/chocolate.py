from __future__ import annotations

from dataclasses import dataclass

import gurobipy as gp
from gurobipy import GRB


@dataclass(frozen=True)
class ChocolateSolution:
    shelf_by_sku: dict[str, int]
    facing_by_sku: dict[str, int]


def target_facing(score: float, min_facing: int, max_facing: int) -> int:
    """Return the document-defined facing target for a normalized score."""
    score_x1000 = score * 1000.0
    if score_x1000 >= 60:
        target = 4
    elif score_x1000 >= 45:
        target = 3
    elif score_x1000 >= 30:
        target = 3
    elif score_x1000 >= 15:
        target = 2
    elif score_x1000 >= 8:
        target = 2
    else:
        target = 1
    return max(min_facing, min(target, max_facing))


def optimize_chocolate_planogram(products, shelves, auto):
    """Select products when needed and assign every selected product to one shelf."""
    if not products:
        return ChocolateSolution({}, {})

    shelf_by_no = {shelf["shelf_no"]: shelf for shelf in shelves}
    shelf_nos = sorted(shelf_by_no)
    has_package_shelf = any(bool(shelf["package_only"]) for shelf in shelves)
    facing = {
        sku: target_facing(data["score"], data["min_facing"], data["max_facing"])
        for sku, data in products.items()
    }

    feasible = []
    for sku, product in products.items():
        for shelf_no in shelf_nos:
            package_only = bool(shelf_by_no[shelf_no]["package_only"])
            if has_package_shelf and package_only != bool(product["is_package"]):
                continue
            feasible.append((sku, shelf_no))

    model = gp.Model("chocolate_planogram")
    model.Params.OutputFlag = 0
    x = model.addVars(feasible, vtype=GRB.BINARY, name="shelf")
    selected = model.addVars(products.keys(), vtype=GRB.BINARY, name="selected")

    for sku, product in products.items():
        choices = gp.quicksum(x[sku, shelf_no] for shelf_no in shelf_nos
                              if (sku, shelf_no) in x)
        model.addConstr(choices == selected[sku])
        if not auto or product.get("required", False):
            model.addConstr(selected[sku] == 1)

    for shelf_no, shelf in shelf_by_no.items():
        model.addConstr(
            gp.quicksum(
                products[sku]["width"] * facing[sku] * x[sku, shelf_no]
                for sku in products if (sku, shelf_no) in x
            ) <= shelf["width_cm"]
        )

    # priority_rank is authoritative: 1 -> 3 -> 2 -> 4 -> 5.
    # The documented multiplier remains a secondary preference and is shown in the UI.
    objective = gp.quicksum(
        (products[sku]["score"] * 1000.0 + 0.001)
        * facing[sku]
        * ((6 - shelf_by_no[shelf_no]["priority_rank"]) * 10.0
           + shelf_by_no[shelf_no]["multiplier"])
        * x[sku, shelf_no]
        for sku, shelf_no in feasible
    )
    model.setObjective(objective, GRB.MAXIMIZE)
    model.optimize()

    if model.Status != GRB.OPTIMAL:
        raise ValueError(
            "Seçilen ürünler facing ve raf kurallarıyla dolaba sığmıyor. "
            "Daha az ürün seçin veya otomatik öneriyi kullanın."
        )

    shelf_assignment = {
        sku: shelf_no
        for sku, shelf_no in feasible
        if x[sku, shelf_no].X > 0.5
    }
    facing_assignment = {sku: facing[sku] for sku in shelf_assignment}
    return ChocolateSolution(shelf_assignment, facing_assignment)
