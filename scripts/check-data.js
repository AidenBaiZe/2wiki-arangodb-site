const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "questions.json");
const records = JSON.parse(fs.readFileSync(file, "utf8"));

const required = ["_id", "type", "question", "answer", "context", "supporting_facts", "evidences"];
const ids = new Set();
let edgeCount = 0;

for (const record of records) {
  for (const key of required) {
    if (!(key in record)) {
      throw new Error(`${record._id || "unknown"} 缺少字段 ${key}`);
    }
  }
  if (ids.has(record._id)) {
    throw new Error(`重复 _id: ${record._id}`);
  }
  ids.add(record._id);
  if (!Array.isArray(record.context) || !Array.isArray(record.evidences)) {
    throw new Error(`${record._id} 的 context/evidences 必须是数组`);
  }
  for (const edge of record.evidences) {
    for (const key of ["fact", "relation", "entity"]) {
      if (!edge[key]) {
        throw new Error(`${record._id} 的 evidence 缺少 ${key}`);
      }
    }
    edgeCount += 1;
  }
}

if (edgeCount === 0) {
  throw new Error("没有 evidence 边，无法支持多跳查询");
}

console.log(`数据检查通过：${records.length} 条问题样例，${edgeCount} 条 evidence 边`);
