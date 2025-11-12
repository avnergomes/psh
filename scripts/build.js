#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

const filesToCopy = [
  'index.html',
  'styles.css',
  'script.js',
  'app.py',
  'README.md'
];

const directoriesToCopy = [
  'assets',
  'data',
  'utils'
];

async function cleanDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
}

async function copyFile(file) {
  const source = path.join(rootDir, file);
  const target = path.join(distDir, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyDirectory(dir) {
  const source = path.join(rootDir, dir);
  const target = path.join(distDir, dir);
  await fs.cp(source, target, { recursive: true });
}

async function main() {
  await cleanDist();

  await Promise.all(
    filesToCopy.map(async file => {
      try {
        await copyFile(file);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    })
  );

  await Promise.all(
    directoriesToCopy.map(async dir => {
      try {
        await copyDirectory(dir);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    })
  );

  console.log(`Build concluído em ${distDir}`);
}

main().catch(error => {
  console.error('Falha ao construir distribuição estática:', error);
  process.exitCode = 1;
});
