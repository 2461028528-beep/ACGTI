import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const ROOT = process.cwd();
const inputArg = process.argv[2] || '大如传题库.xlsx';
const inputPath = path.resolve(ROOT, inputArg);
const outputDir = path.resolve(ROOT, 'src', 'data');

const DIMENSION_HEADERS = ['I/E', 'N/S', 'T/F', 'J/P'];
const TRAIT_HEADERS = ['体面', '少年郎', '安分', '道德资本', '出身', '心机'];
const OPTION_IDS = ['a', 'b', 'c', 'd'];

function fail(message) {
  console.error(`\n转换失败：${message}\n`);
  process.exit(1);
}

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseScoreToken(raw, context) {
  const text = clean(raw).replace(/\s+/g, '');
  if (!text) return null;

  const match = text.match(/^(.+?)([+-])(\d+(?:\.\d+)?)$/);
  if (!match) {
    fail(`${context} 的赋分格式不正确：“${text}”。正确示例：E+1、体面-2。`);
  }

  const [, key, operator, numberText] = match;
  const value = Number(numberText) * (operator === '+' ? 1 : -1);
  return { key, value };
}

function parseQuestionNumber(text, fallbackNumber) {
  const match = clean(text).match(/^\s*(\d+)\s*[.、．:]?\s*(.*)$/s);
  if (!match) {
    return { number: fallbackNumber, prompt: clean(text) };
  }
  return { number: Number(match[1]), prompt: match[2].trim() };
}

function dimensionPairForLetter(letter) {
  const map = {
    I: 'E_I', E: 'E_I',
    N: 'S_N', S: 'S_N',
    T: 'T_F', F: 'T_F',
    J: 'J_P', P: 'J_P',
  };
  return map[letter] || null;
}

function signedDimensionValue(letter, amount) {
  const positiveLetters = new Set(['E', 'S', 'T', 'J']);
  return positiveLetters.has(letter) ? amount : -amount;
}

function parseQuestionSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  if (rows.length < 2) fail('“题库”工作表为空。');

  const headers = rows[0].map(clean);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  for (const required of [...DIMENSION_HEADERS, ...TRAIT_HEADERS]) {
    if (!headerIndex.has(required)) fail(`“题库”缺少列：${required}`);
  }

  const questions = [];
  let rowIndex = 1;
  let fallbackNumber = 1;

  while (rowIndex < rows.length) {
    const firstCell = clean(rows[rowIndex]?.[0]);
    if (!firstCell) {
      rowIndex += 1;
      continue;
    }

    if (!/^\d+\s*[.、．:]/.test(firstCell)) {
      fail(`“题库”第 ${rowIndex + 1} 行应为题目，但读到：“${firstCell}”`);
    }

    const { number, prompt } = parseQuestionNumber(firstCell, fallbackNumber);
    fallbackNumber = number + 1;

    const optionRows = [];
    for (let offset = 1; offset <= 4; offset += 1) {
      const row = rows[rowIndex + offset];
      if (!row) fail(`第 ${number} 题不足 4 个选项。`);
      optionRows.push(row);
    }

    const options = optionRows.map((row, optionIndex) => {
      const rawLabel = clean(row[0]);
      const prefix = String.fromCharCode(65 + optionIndex);
      const label = rawLabel.replace(new RegExp(`^${prefix}[.、．:]\\s*`, 'i'), '').trim();
      if (!label) fail(`第 ${number} 题的 ${prefix} 选项为空。`);

      const dimensionScores = {};
      const traitScores = {};

      for (const header of DIMENSION_HEADERS) {
        const token = parseScoreToken(
          row[headerIndex.get(header)],
          `第 ${number} 题 ${prefix} 选项 ${header} 列`,
        );
        if (!token) continue;

        const pair = dimensionPairForLetter(token.key);
        if (!pair) {
          fail(`第 ${number} 题 ${prefix} 选项出现未知 MBTI 字母：“${token.key}”`);
        }
        dimensionScores[pair] = (dimensionScores[pair] || 0)
          + signedDimensionValue(token.key, Math.abs(token.value));
      }

      for (const header of TRAIT_HEADERS) {
        const token = parseScoreToken(
          row[headerIndex.get(header)],
          `第 ${number} 题 ${prefix} 选项 ${header} 列`,
        );
        if (!token) continue;
        if (!TRAIT_HEADERS.includes(token.key)) {
          fail(`第 ${number} 题 ${prefix} 选项出现未知角色维度：“${token.key}”`);
        }
        traitScores[token.key] = (traitScores[token.key] || 0) + token.value;
      }

      return {
        id: OPTION_IDS[optionIndex],
        label,
        dimensionScores,
        traitScores,
      };
    });

    questions.push({
      id: `q${number}`,
      prompt,
      scene: `大如传情境 ${number}`,
      options,
    });

    rowIndex += 5;
  }

  return questions;
}

function parseCharacterTendencies(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headers = rows[0].map(clean);
  const result = {};

  for (let r = 1; r < rows.length; r += 1) {
    const name = clean(rows[r][0]);
    if (!name) continue;
    const affinities = {};

    for (let c = 1; c < headers.length; c += 1) {
      const questionId = clean(headers[c]).toLowerCase();
      const raw = clean(rows[r][c]);
      if (!questionId || !raw) continue;

      affinities[questionId] = raw.split('/').map((part) => {
        const match = clean(part).match(/^([A-Da-d])\+(\d+(?:\.\d+)?)$/);
        if (!match) {
          fail(`“角色倾向表”中 ${name} 的 ${headers[c]} 格式错误：“${part}”。正确示例：A+2/B+1。`);
        }
        return { optionId: match[1].toLowerCase(), weight: Number(match[2]) };
      });
    }

    result[name] = affinities;
  }

  return result;
}

function parseCharacterProfiles(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headers = rows[0].map(clean);
  const index = new Map(headers.map((header, i) => [header, i]));
  for (const required of ['MBTI', ...TRAIT_HEADERS]) {
    if (!index.has(required)) fail(`“角色画像表”缺少列：${required}`);
  }

  const profiles = [];
  for (let r = 1; r < rows.length; r += 1) {
    const name = clean(rows[r][0]);
    if (!name) continue;

    const traits = {};
    for (const trait of TRAIT_HEADERS) {
      const raw = rows[r][index.get(trait)];
      const value = Number(raw);
      if (!Number.isFinite(value)) fail(`“角色画像表”中 ${name} 的 ${trait} 不是数字。`);
      traits[trait] = value;
    }

    profiles.push({
      id: name,
      name,
      mbti: clean(rows[r][index.get('MBTI')]).toUpperCase(),
      traits,
    });
  }

  return profiles;
}

function writeJson(filename, data) {
  const target = path.join(outputDir, filename);
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`已生成：${path.relative(ROOT, target)}`);
}

if (!fs.existsSync(inputPath)) fail(`找不到 Excel 文件：${inputPath}`);
fs.mkdirSync(outputDir, { recursive: true });

const workbook = XLSX.readFile(inputPath);
for (const sheetName of ['题库', '角色倾向表', '角色画像表']) {
  if (!workbook.Sheets[sheetName]) fail(`Excel 中缺少工作表：“${sheetName}”`);
}

const questions = parseQuestionSheet(workbook.Sheets['题库']);
const characterTendencies = parseCharacterTendencies(workbook.Sheets['角色倾向表']);
const characterProfiles = parseCharacterProfiles(workbook.Sheets['角色画像表']);

writeJson('questions.json', questions);
writeJson('daruCharacterTendencies.json', characterTendencies);
writeJson('daruCharacterProfiles.json', characterProfiles);

console.log(`\n转换完成：${questions.length} 道题，${characterProfiles.length} 个角色。`);
console.log('注意：questions.json 已改为四选一结构，下一步还需要修改题卡组件和评分引擎。');
