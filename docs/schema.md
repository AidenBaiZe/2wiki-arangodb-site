# ArangoDB 设计说明

本项目把 2WikiMultihopQA 建成一个小型图数据库，适合表达“问题 -> 证据实体 -> 答案”的多跳关系。

## 集合

| 集合 | 类型 | 说明 |
| --- | --- | --- |
| `questions` | document | 保存 `_id`、题型、问题文本、答案、supporting facts |
| `entities` | document | 保存上下文标题、证据实体、答案实体 |
| `context_edges` | edge | `questions -> entities`，表示某问题包含某篇上下文 |
| `evidence_edges` | edge | `entities -> entities`，表示 evidence 中的关系跳转 |

## 典型 AQL

```aql
FOR q IN questions
  SEARCH ANALYZER(q.question IN TOKENS(@keyword, "text_en"), "text_en")
  LIMIT 20
  RETURN q
```

```aql
LET start = FIRST(
  FOR e IN entities
    FILTER e.name == @start_entity
    RETURN e
)
FOR v, e, p IN 1..3 OUTBOUND start evidence_edges
  FILTER p.edges[*].question_id ANY == @question_id
  RETURN {
    path: p.vertices[*].name,
    relation: p.edges[*].relation
  }
```

```aql
FOR e IN evidence_edges
  COLLECT relation = e.relation WITH COUNT INTO count
  SORT count DESC
  RETURN { relation, count }
```

## 索引建议

```aql
FOR view IN ["question_search"]
  RETURN view
```

实际部署时可以创建 ArangoSearch View，把 `questions.question`、`questions.answer`、`entities.name`、`entities.content` 纳入检索字段。
