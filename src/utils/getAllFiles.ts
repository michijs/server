import fs from 'fs';
import { getPath } from './getPath';

export const getAllFiles = function (dirPath: string, dirToShow: string = dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const normalizedPath = getPath(`${dirPath}/${file}`);
    const filePath = `${dirToShow}/${file}`;
    if (fs.statSync(normalizedPath).isDirectory()) {
      arrayOfFiles = getAllFiles(normalizedPath, filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
};