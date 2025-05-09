from itertools import combinations
from collections import Counter

def entries_from_weight(weight):
    """Convert weight vector to flat multiset list."""
    entries = []
    for i, count in enumerate(weight):
        entries.extend([i + 1] * count)
    return entries

def is_valid(tableau, row, col, val):
    """Check if placing val at (row, col) keeps SSYT properties."""
    if col > 0 and val < tableau[row][col - 1]:  # row must be weakly increasing
        return False
    if row > 0 and val <= tableau[row - 1][col]:  # column must be strictly increasing
        return False
    return True

def generate_ssyts(weight, shape=(3, 4)):
    """Generate all SSYTs of given shape and weight."""
    total_cells = shape[0] * shape[1]
    if sum(weight) != total_cells:
        return []

    entries = entries_from_weight(weight)
    entries.sort()  # for lexicographic ordering
    results = []

    def backtrack(pos, tableau, remaining):
        if pos == total_cells:
            results.append([row[:] for row in tableau])
            return
        row, col = divmod(pos, shape[1])
        used = set()
        for i, val in enumerate(remaining):
            if val in used:
                continue  # skip duplicates at this level
            if not is_valid(tableau, row, col, val):
                continue
            tableau[row][col] = val
            backtrack(pos + 1, tableau, remaining[:i] + remaining[i+1:])
            tableau[row][col] = 0
            used.add(val)

    tableau = [[0 for _ in range(shape[1])] for _ in range(shape[0])]
    backtrack(0, tableau, entries)
    return results

weight = [1, 2, 1, 1, 0, 0, 1, 2, 1, 1, 1, 1]
tableaux = generate_ssyts(weight)
print(f"Found {len(tableaux)} SSYTs:")
for T in tableaux:
    for row in T:
        print(row)
        print("---")
