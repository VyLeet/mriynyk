import pandas as pd


def main():
    df = pd.read_parquet("/Users/admin/Developer/.personal/mriynyk/data/Lapathon2026 Mriia public files/benchmark_scores.parquet")
    print(df.head(100))


if __name__ == "__main__":
    main()
