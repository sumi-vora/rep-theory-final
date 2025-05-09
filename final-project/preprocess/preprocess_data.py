import ast 
from sklearn.decomposition import PCA
import json 
from collections import defaultdict
import numpy as np
from itertools import combinations

# loading the data from the text file (to-do: add error handling)
def load_tableaux_from_txt(valid_path, invalid_path): 
    '''loads valid and invalid data and adds it to a list'''
    print("loading data...")
    data = [] 

    # load valid data 
    with open(valid_path) as f: 
        for line in f: 
            tableau = ast.literal_eval(line.strip())
            data.append({"tableau": tableau, "is_cluster": 1})
    
    # load invalid data 
    with open(invalid_path) as f: 
        for line in f: 
            tableau = ast.literal_eval(line.strip())
            data.append({"tableau": tableau, "is_cluster": 0})
    
    return data 

# generating embeddings for the tableaux by either plactic monoid or weight vector 
def reading_word(tableau):
    '''gets the reading word corresponding to plactic monoid and path in B(lambda)'''
    return [cell for row in tableau for cell in row]

def weight_vector(tableau):
    '''weight of basis elt in cartan subalgebra/action of e_i, f_i on crystal graph'''
    weights = [0]*12  
    for row in tableau:
        for cell in row:
            if 1 <= cell <= 12:
                weights[cell-1] += 1
    return weights

def embed_tableaux(data, mode='reading_word'):
    '''applies embedding map to every tableau in the dataset'''
    print("generating embeddings...")
    if mode == 'flatten':
        embedding_fn = reading_word
    else: 
        embedding_fn = weight_vector
    return [embedding_fn(t["tableau"]) for t in data]

def reduce_dimensionality(vectors, n_components=3):
    '''get lower-dimensional embeddings of vectors'''
    print("applying pca...")
    pca = PCA(n_components=n_components)
    return pca.fit_transform(vectors)

# get plucker coordinates - to-do: change to plucker vectors! 
def plucker_minor(matrix, indices):
    '''compute the plücker coordinate p_I for a 3xN matrix, given column indices I (length 3).'''
    submatrix = matrix[:, [i - 1 for i in indices]]  # -1 for 0-based indexing
    return np.linalg.det(submatrix)

def compute_plucker_from_ssyt(matrix, ssyt):
    num_rows = len(ssyt)
    num_cols = len(ssyt[0])

    # transpose to get columns
    columns = list(zip(*ssyt))
    
    product = 1.0
    for col in columns:
        indices = list(col)
        if len(set(indices)) < 3:
            print(f"Warning: repeated entries in column {col}, determinant will be 0.")
        minor = plucker_minor(matrix, indices)
        product *= minor
    return product

import numpy as np

def sl3_weight_from_vector(weight_vector):
    if len(weight_vector) != 12:
        raise ValueError("Expected weight_vector of length 12.")

    m1 = sum(weight_vector[i] for i in [0, 3, 6, 9])
    m2 = sum(weight_vector[i] for i in [1, 4, 7, 10])
    m0 = sum(weight_vector[i] for i in [2, 5, 8, 11])

    total = m1 + m2 + m0
    avg = total // 3

    # Use native Python types
    w1 = int(m1 - avg)
    w2 = int(m2 - avg)
    w3 = int(m0 - avg)

    # Coordinates
    x = int(w1 - w2)
    y = int(w2 - w3)

    return {
        "sl3_weight": [w1, w2, w3],
        "alcove_coordinates": (x, y),
        "fundamental_weights": (x, y)
    }



# exporting to json file 
def get_embedding_data(tableaux, word_embeddings, dominance_embeddings):
    '''converts preprocessed data to json'''
    print("exporting as json...")

    json_data = []

    # identity with zeros at the end 
    I = np.zeros((3, 12))
    I[:, :3] = np.eye(3)

    for tableau, word_embedding, dominance_embedding in zip(tableaux, word_embeddings, dominance_embeddings):
        ssyt = tableau["tableau"]
        weight_vec = weight_vector(ssyt)
        sl3_weights = sl3_weight_from_vector(weight_vec)
        #print(sl3_weights)

        json_data.append({
            "tableau": ssyt,
            "is_cluster": tableau["is_cluster"],
            "weight_vector": weight_vec, 
            "x": word_embedding[0],
            "y": word_embedding[1],
            "z": word_embedding[2] if len(word_embedding) > 2 else 0, 
            "x_d": dominance_embedding[0],
            "y_d": dominance_embedding[1],
            "z_d": dominance_embedding[2] if len(dominance_embedding) > 2 else 0, 
            "plucker coordinates": compute_plucker_from_ssyt(I, ssyt),
            "sl3_weight": sl3_weights["sl3_weight"],
            "alcove_coordinates": sl3_weights["alcove_coordinates"],
            "fundamental_weights": sl3_weights["fundamental_weights"]
            
        })
    
    return json_data


def weight_equivalence_classes(data):
    ''' given the tableaux data, it groups data by weight equivalence '''
    # group by weight vector 
    equiv_classes = defaultdict(list)
    for item in data:
        weight_tuple = tuple(item.get('weight_vector', []))
        equiv_classes[weight_tuple].append(item)
    
    # gather statistics 
    results = []

    for weight_vector, items in equiv_classes.items():
        total_count = len(items)
        if total_count <= 6: # get rid of the super small classes 
            continue 

        # count the number of things that index a cluster variable 
        num_valid = sum(1 for item in items if item.get('is_cluster') == 1)

        results.append({
            'weight_vector': list(weight_vector),
            'total_count': total_count,
            'valid_count': num_valid,
            'invalid_count': total_count - num_valid,
            # note: these loops are not expensive because each class only has like 10 things in it 
            'example_tableau_valid': next((item['tableau'] for item in items if item.get('is_cluster') == 1), None),
            'example_tableau_invalid': next((item['tableau'] for item in items if item.get('is_cluster') == 0), None),
        })
    
    # sort by total count and add id 
    results.sort(key=lambda x: x['total_count'], reverse=True)
    for i, item in enumerate(results):
        item['id'] = i+1
    
    
    return results

def print_sample_results(results):
    """
    Prints the results from analyzing the sample data.
    """
    print("\nEquivalence Classes by Weight Vector (Sample Data):")
    print("-" * 80)
    
    for i, result in enumerate(results, 1):
        print(f"Class #{i}:")
        print(f"  Weight Vector: {result['weight_vector']}")
        print(f"  Total Count: {result['total_count']}")
        print(f"  Cluster Count (is_cluster=1): {result['cluster_count']}")
        print(f"  Non-Cluster Count (is_cluster=0): {result['non_cluster_count']}")
        print(f"  Cluster Percentage: {result['cluster_percentage']}%")
        
        print("  Example Tableau:")
        for row in result['example_tableau']:
            print(f"    {row}")
        print()
