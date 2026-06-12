# 2WikiMultihopQA 多跳问答数据管理实验报告

## 选题

本实验选择 2WikiMultihopQA 数据集，并使用 ArangoDB 管理多跳问答数据。数据来自 Hugging Face 镜像 `xanhho/2WikiMultihopQA`，本项目网页演示数据从本地 `dev.json` 抽取 80 条真实记录。

## 数据模型

2WikiMultihopQA 的核心字段包括问题、答案、上下文文章、supporting facts 和 evidences。ArangoDB 同时支持文档模型和图模型，因此适合把这些字段拆成文档集合和边集合。

| 集合 | 类型 | 用途 |
| --- | --- | --- |
| `questions` | 文档集合 | 保存问题、题型、答案和 supporting facts |
| `entities` | 文档集合 | 保存文章标题、证据实体和答案实体 |
| `context_edges` | 边集合 | 连接问题和上下文文章 |
| `evidence_edges` | 边集合 | 连接证据实体，表示多跳推理关系 |

这种设计可以同时支持普通检索和图遍历。比如一个 compositional 问题可以表示成：

```text
Polish-Russian War -> director -> Xawery Żuławski -> mother -> Małgorzata Braunek
```

## 查询与检索

网页端提供关键词检索，可以搜索问题、答案、上下文、实体和关系词。数据库端可以使用 AQL 在 `questions` 和 `entities` 中检索，也可以进一步配置 ArangoSearch View 提升文本搜索能力。

多跳查询使用 ArangoDB 的图遍历语法完成：

```aql
FOR v, e, p IN 1..3 OUTBOUND start evidence_edges
  FILTER p.edges[*].question_id ANY == @question_id
  RETURN {
    path: p.vertices[*].name,
    relations: p.edges[*].relation
  }
```

## 简单聚类

本项目采用轻量聚类方法，把每条问题的第一条 evidence 关系作为主要特征进行分组，例如 `director`、`father`、`publication date` 等。这个方法实现简单，结果也容易解释，适合作为课程网页中的聚类展示。

如果后续需要更完整的聚类，可以使用问题文本、答案和 evidence 关系词做 TF-IDF，再用 KMeans 生成聚类标签。旧数据目录中已经有按全量数据生成 JSONL 的处理结果，可以继续扩展。

## 可视化

网页使用 Canvas 绘制实体关系图，每个问题会显示：

- 起点实体
- 中间证据实体
- 答案实体
- evidence 关系边

同时页面还展示多跳路径列表和 AQL 查询思路，便于把前端演示和数据库查询对应起来。

## GitHub Pages 部署

项目是纯静态网页，可以直接部署到 GitHub Pages。仓库中已加入 `.github/workflows/pages.yml`，新仓库启用 Pages 的 GitHub Actions 发布方式后，每次推送 `main` 分支都会自动发布网页。
