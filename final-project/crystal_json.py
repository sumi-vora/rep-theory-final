import json
from generate_ssyts import generate_ssyts
from crystal_operator import f_i

def tableau_to_str(tableau):
    return json.dumps(tableau)  # consistent, hashable

def build_crystal_graph(weight_vector, shape=(3, 4)):
    tableaux = generate_ssyts(weight_vector, shape)
    tableau_ids = {}
    nodes = []
    links = []

    # Assign unique IDs
    for idx, T in enumerate(tableaux):
        tid = tableau_to_str(T)
        tableau_ids[tid] = idx
        nodes.append({"id": idx, "tableau": T})

    # Apply f_i for i in 1..11
    for T in tableaux:
        source_id = tableau_ids[tableau_to_str(T)]
        for i in range(1, 12):  # f_1 to f_11
            result = f_i(T, i)
            if result:
                tid = tableau_to_str(result)
                if tid in tableau_ids:
                    target_id = tableau_ids[tid]
                    links.append({
                        "source": source_id,
                        "target": target_id,
                        "operator": f"f_{i}"
                    })

    return {"nodes": nodes, "links": links}

weight = [1, 2, 1, 1, 0, 0, 1, 2, 1, 1, 1, 1]
graph = build_crystal_graph(weight)

with open("crystal_graph.json", "w") as f:
        json.dump(graph, f, indent=2)

print(f"Saved {len(graph['nodes'])} nodes and {len(graph['links'])} edges.")