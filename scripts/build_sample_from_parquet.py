"""
从 2WikiMultihopQA 的 parquet/json/jsonl 文件抽取网页演示数据。

用法：
  python3 -m pip install pandas pyarrow
  python3 scripts/build_sample_from_parquet.py /path/to/dev.json data/questions.json 80
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd


def parse_jsonish(value):
    if isinstance(value, str):
        return json.loads(value) if value.strip() else []
    return value or []


def convert_row(row: pd.Series) -> dict:
    return {
        "_id": row["_id"],
        "type": row["type"],
        "question": row["question"],
        "context": [
            {"title": item[0], "content": item[1]}
            for item in parse_jsonish(row["context"])
        ],
        "supporting_facts": [
            {"title": item[0], "sent_id": item[1]}
            for item in parse_jsonish(row["supporting_facts"])
        ],
        "evidences": [
            {"fact": item[0], "relation": item[1], "entity": item[2]}
            for item in parse_jsonish(row["evidences"])
        ],
        "answer": row["answer"],
    }


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("参数：输入 parquet、输出 json、可选条数")

    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 80

    if source.suffix == ".parquet":
        df = pd.read_parquet(source).head(limit)
    elif source.suffix == ".json":
        df = pd.DataFrame(json.loads(source.read_text(encoding="utf-8"))).head(limit)
    elif source.suffix == ".jsonl":
        rows = []
        with source.open(encoding="utf-8") as handle:
            for index, line in enumerate(handle):
                if index >= limit:
                    break
                rows.append(json.loads(line))
        df = pd.DataFrame(rows)
    else:
        raise SystemExit(f"不支持的文件格式：{source.suffix}")
    records = [convert_row(row) for _, row in df.iterrows()]
    target.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入 {len(records)} 条记录到 {target}")


if __name__ == "__main__":
    main()
