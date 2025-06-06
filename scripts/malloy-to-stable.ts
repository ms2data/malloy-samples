/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as path from 'path';
import {inspect} from 'util';
import {pathToFileURL} from 'url';
import type {Connection} from '@malloydata/malloy';
import {Malloy, modelDefToModelInfo} from '@malloydata/malloy';
import {BigQueryConnection} from '@malloydata/db-bigquery';
import {DuckDBConnection} from '@malloydata/db-duckdb';
import {readFile} from 'fs/promises';
import {readFileSync} from 'fs';

export function pretty(thing: unknown): string {
  return inspect(thing, {breakLength: 72, depth: Infinity});
}

async function printTranslatedMalloy(fileSrc: string, url: URL) {
  const parse = Malloy.parse({source: fileSrc, url});
  const bqConn = new BigQueryConnection('bigquery');
  const ddbCon = new DuckDBConnection(
    'duckdb',
    ':memory:',
    path.dirname(url.pathname)
  );
  const lookupConnection = async function (name: string): Promise<Connection> {
    if (name === 'bigquery' || name === undefined) {
      return bqConn;
    } else if (name === 'duckdb') {
      return ddbCon;
    }
    throw new Error(`No connection ${name}`);
  };

  const readURL = async function (url: URL): Promise<string> {
    const filePath = url.pathname;
    const src = await readFile(filePath, {encoding: 'utf-8'});
    return src;
  };

  try {
    const model = await Malloy.compile({
      urlReader: {readURL},
      connections: {lookupConnection},
      parse,
    });
    const stable = modelDefToModelInfo(model._modelDef);
    console.info(pretty(stable));
  } catch (e) {
    console.error(e);
  }
}

async function main() {
  for (const fileArg of process.argv.slice(2)) {
    const filePath = path.resolve(fileArg);
    const src = readFileSync(filePath, 'utf-8');
    const url = pathToFileURL(filePath);
    await printTranslatedMalloy(src, url);
  }
}

main();
