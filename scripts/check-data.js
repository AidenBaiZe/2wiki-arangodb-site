const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "questions.json");
const records = JSON.parse(fs.readFileSync(file, "utf8"));

const required = ["_id", "type", "question", "answer", "context", "supporting_facts", "evidences"];
const ids = new Set();

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
}

console.log(`数据检查通过：${records.length} 条问题样例`);
