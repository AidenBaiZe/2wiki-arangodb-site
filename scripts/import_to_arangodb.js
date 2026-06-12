const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Database } = require("arangojs");

const endpoint = process.env.ARANGO_URL || "http://127.0.0.1:8529";
const databaseName = process.env.ARANGO_DB || "two_wiki_multihop";
const username = process.env.ARANGO_USER || "root";
const password = process.env.ARANGO_PASSWORD || "";

const dataPath = path.join(__dirname, "..", "data", "questions.json");
const records = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const root = new Database({ url: endpoint });
root.useBasicAuth(username, password);

function key(value) {
  const raw = String(value);
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 180);
  const digest = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 10);
  return `${cleaned || "entity"}_${digest}`;
}

async function ensureDatabase() {
  const exists = await root.listDatabases();
  if (!exists.includes(databaseName)) {
    await root.createDatabase(databaseName);
  }
  root.useDatabase(databaseName);
  root.useBasicAuth(username, password);
}

async function ensureCollection(name, edge = false) {
  const collection = edge ? root.edgeCollection(name) : root.collection(name);
  if (!(await collection.exists())) {
    edge ? await collection.create() : await collection.create();
  }
  return collection;
}

async function upsert(collection, doc) {
  try {
    await collection.save(doc, { overwriteMode: "replace" });
  } catch (error) {
    if (error.code !== 409) throw error;
  }
}

async function main() {
  await ensureDatabase();
  const questions = await ensureCollection("questions");
  const entities = await ensureCollection("entities");
  const evidenceEdges = await ensureCollection("evidence_edges", true);
  const contextEdges = await ensureCollection("context_edges", true);

  for (const record of records) {
    await upsert(questions, {
      _key: record._id,
      type: record.type,
      question: record.question,
      answer: record.answer,
      supporting_facts: record.supporting_facts
    });

    for (const item of record.context) {
      await upsert(entities, {
        _key: key(item.title),
        name: item.title,
        content: item.content,
        kind: "context"
      });

      await upsert(contextEdges, {
        _key: `${record._id}_${key(item.title)}`,
        _from: `questions/${record._id}`,
        _to: `entities/${key(item.title)}`,
        relation: "has_context"
      });
    }

    for (const edge of record.evidences) {
      await upsert(entities, {
        _key: key(edge.fact),
        name: edge.fact,
        kind: "entity"
      });
      await upsert(entities, {
        _key: key(edge.entity),
        name: edge.entity,
        kind: edge.entity === record.answer ? "answer" : "entity"
      });

      await upsert(evidenceEdges, {
        _key: `${record._id}_${key(edge.fact)}_${key(edge.relation)}_${key(edge.entity)}`,
        _from: `entities/${key(edge.fact)}`,
        _to: `entities/${key(edge.entity)}`,
        question_id: record._id,
        relation: edge.relation
      });
    }
  }

  console.log(`导入完成：${records.length} 条问题，数据库 ${databaseName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
