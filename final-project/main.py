from preprocess.preprocess_data import *

if __name__ == "__main__":

    # data preprocessing pipeline 
    valid_path = "data/3_4_12_valid.txt"
    invalid_path = "data/3_4_12_invalid.txt"
    output_path = "data/tableaux_embeddings.json"

    tableaux = load_tableaux_from_txt(valid_path, invalid_path)
    basis_vectors = embed_tableaux(tableaux, mode='reading_word')
    weight_vectors = embed_tableaux(tableaux, mode='weight_vectors')

    word_embeddings = reduce_dimensionality(basis_vectors, n_components=3)
    dominance_embeddings = reduce_dimensionality(weight_vectors, n_components=2)

    json_data = get_embedding_data(tableaux, word_embeddings, dominance_embeddings)

    weight_equivalence_class_data = weight_equivalence_classes(json_data)

    weight_vector_to_class_id = {
    tuple(item['weight_vector']): item['id']
    for item in weight_equivalence_class_data
}
    


    for item in json_data:
        weights = item['weight_vector']
        try:
            item["class_id"] = weight_vector_to_class_id[tuple(weights)]
        except:
            item["class_id"] = 0
            continue # this means that it was one of the ones that was in a very small class 
        
    
    
    with open('data/tableaux_embeddings.json', 'w') as f:
        json.dump(json_data, f, indent=2)


    with open('data/equivalence_classes.json', 'w') as f:
        json.dump(weight_equivalence_class_data, f, indent=2)
