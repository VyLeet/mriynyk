import pandas as pd


# pd.read_parquet("data/benchmark_absences.parquet")
# pd.read_parquet("data/benchmark_absences.parquet")
df = pd.read_parquet("data/lms_questions_dev.parquet")
df.to_csv("questions.csv")
print(df.head)
print(df.shape)
