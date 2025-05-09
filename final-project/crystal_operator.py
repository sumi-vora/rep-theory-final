from copy import deepcopy

def reading_word(tableau):
    """Bottom-to-top, left-to-right row reading."""
    return [cell for row in reversed(tableau) for cell in row]

def positions_in_reading_order(tableau):
    """Returns list of (row, col) in reading word order."""
    pos = []
    for r in reversed(range(len(tableau))):
        for c in range(len(tableau[0])):
            pos.append((r, c))
    return pos

def is_ssyt(tableau):
    """Check tableau is a valid SSYT."""
    rows, cols = len(tableau), len(tableau[0])
    for r in range(rows):
        for c in range(cols - 1):
            if tableau[r][c] > tableau[r][c + 1]:
                return False
    for r in range(rows - 1):
        for c in range(cols):
            if tableau[r][c] >= tableau[r + 1][c]:
                return False
    return True

def f_i(tableau, i):
    """Apply Kashiwara operator f_i to a tableau (returns new tableau or None)."""
    word = reading_word(tableau)
    pos = positions_in_reading_order(tableau)

    # Step 1: build signature
    sig = []
    sig_pos = []
    for idx, val in enumerate(word):
        if val == i:
            sig.append("+")
            sig_pos.append(idx)
        elif val == i + 1:
            sig.append("-")
            sig_pos.append(idx)

    # Step 2: cancel -+ pairs left to right
    stack = []
    uncanceled_plus_idx = []
    for symbol, idx in zip(sig, sig_pos):
        if symbol == "-":
            if stack:
                stack.pop()  # cancel one +
            else:
                continue  # no + to cancel
        else:  # +
            stack.append(idx)
    if not stack:
        return None  # f_i is undefined

    change_idx = stack[-1]  # rightmost uncanceled +
    r, c = pos[change_idx]

    new_tableau = deepcopy(tableau)
    new_tableau[r][c] = i + 1

    if is_ssyt(new_tableau):
        return new_tableau
    else:
        return None  # result violates SSYT condition
