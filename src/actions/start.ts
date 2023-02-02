import http from 'http';
import fs from 'fs';
import { config, hostURL, localURL, connections } from '../config/config';
import coloredString from '../utils/coloredString';
import { getPath } from '../utils/getPath';
import open from 'open';
import { context } from 'esbuild';
import watch from 'node-watch';
import { copyFile } from '../utils/copy';
import { sep } from 'path';
import { transformers } from '../utils/transformers';

export const start = (callback: () => void) => {

  config.esbuildOptions.plugins?.push({
    name: 'michijs-dev-server-watch-public-folder',
    setup(build) {
      if (config.public.path)
        watch(config.public.path, {
          encoding: 'utf-8',
          persistent: true,
          recursive: true,
        }, (event, fileChangedPath) => {
          const updated = new Array<string>();
          const removed = new Array<string>();
          const added = new Array<string>();
          const splittedPath = fileChangedPath.split(sep);
          const srcDir = splittedPath.slice(0, -1).join(sep)
          const fileName = splittedPath.at(-1)!
          const outDir = srcDir.replace(config.public.path!, build.initialOptions.outdir!)

          fs.rmSync(getPath(`${outDir}/${transformers.find(x => x.fileRegex.test(fileName))?.pathTransformer?.(fileName) ?? fileName}`), { force: true, recursive: true })
          if (event === 'remove')
            removed.push(fileChangedPath);
          else {
            updated.push(fileChangedPath);
            copyFile(srcDir, fileName, outDir, transformers)
          }

          // Refresh browser
          connections.forEach(x => x.write(`event: change\ndata: ${JSON.stringify({
            added, removed, updated
          })}\n\n`))
        })
    }
  })

  context(config.esbuildOptions).then(async buildContext => {
    const { host: esbuildHost, port: esbuildPort } = await buildContext.serve({
      servedir: config.esbuildOptions.outdir,
    })

    http.createServer(async (req, res) => {
      if (req.url === '/esbuild')
        connections.push(res)
      const esbuildProxyRequestOptions = {
        hostname: esbuildHost,
        port: esbuildPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      }

      // Forward each incoming request to esbuild
      const proxyReq = http.request(esbuildProxyRequestOptions, proxyRes => {
        // If esbuild returns "not found", send a custom 404 page
        if (!proxyRes.statusCode || proxyRes.statusCode === 404) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          // TODO: Find a better way to do this
          res.end(fs.readFileSync(getPath(`${config.esbuildOptions.outdir}/${config.public.indexName}`)));
          return
        }

        // Otherwise, forward the response from esbuild to the client
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res, { end: true })
      })

      // Forward the body of the request to esbuild
      req.pipe(proxyReq, { end: true })

    }).listen(config.port)

    console.log(`
  Server running at:
  
  > Network:  ${coloredString(hostURL)}
  > Local:    ${coloredString(localURL)}`);
    callback();
    buildContext.watch()
    if (config.openBrowser)
      open(localURL);

  })
};