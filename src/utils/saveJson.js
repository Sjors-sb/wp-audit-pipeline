import fs from 'fs';
import path from 'path';

export function saveJson(filepath, obj) {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(obj, null, 2));
}
