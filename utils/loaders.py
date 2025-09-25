import pandas as pd

def load_data(path):
    if path.endswith(".xlsx"):
        return pd.read_excel(path)
    elif path.endswith(".csv"):
        return pd.read_csv(path, sep=";")
    else:
        return pd.DataFrame()
