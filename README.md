# 2WikiMultihopQA + ArangoDB 多跳查询网站

这是大数据存储实验的网页项目，使用 2WikiMultihopQA 数据集的结构设计 ArangoDB 图数据库，并在静态网页中展示多跳查询、检索、简单聚类和关系可视化。

数据集来源：<https://huggingface.co/datasets/xanhho/2WikiMultihopQA>

## 功能

- 问题、实体、答案、关系词检索
- 按题型筛选
- 展示每条问题的多跳 evidence 路径
- 输入起点实体，递归查询 1 到 3 跳 evidence 路径
- 根据 evidence 关系词做简单聚类
- 使用 Canvas 绘制实体关系图
- 提供 ArangoDB 导入脚本和 AQL 查询示例

## 数据说明

当前网页数据来自本机已经下载的 `2WikiMultihopQA/dev.json`，抽取了 1200 条真实记录放在 `data/questions.json`。原始完整数据文件较大，没有直接放进网页仓库。

## 本地运行

```bash
npm run start
```

也可以不用 npm，直接运行：

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

浏览器打开：

```text
http://127.0.0.1:5173
```

## 数据库导入

先安装依赖：

```bash
npm install
```

启动本地 ArangoDB 后执行：

```bash
ARANGO_URL=http://127.0.0.1:8529 \
ARANGO_DB=two_wiki_multihop \
ARANGO_USER=root \
ARANGO_PASSWORD=你的密码 \
node scripts/import_to_arangodb.js
```

## 使用真实 parquet 抽样

如果已经下载 Hugging Face 的 `dev.parquet`，或者已有原始 `dev.json`，可以重新生成网页数据：

```bash
python3 scripts/build_sample_from_parquet.py dev.json data/questions.json 1200
```

只有读取 `.parquet` 时才需要额外安装：

```bash
python3 -m pip install pandas pyarrow
```

## GitHub Pages

仓库推到 GitHub 后，在仓库设置里打开 Pages：

- Source 选择 `GitHub Actions`

仓库里已经放了 `.github/workflows/pages.yml`，推送 `main` 分支后会自动发布。

如果不使用 Actions，也可以改成分支发布：

- Source 选择 `Deploy from a branch`
- Branch 选择 `main`
- Folder 选择 `/root`

保存后等待 Pages 构建完成即可访问网页。

## 新仓库推送命令

创建空的 GitHub 仓库后，在本地执行：

```bash
git remote add origin https://github.com/你的账号/你的仓库名.git
git push -u origin main
```
