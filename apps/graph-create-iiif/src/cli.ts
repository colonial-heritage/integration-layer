#!/bin/env node

import {cac} from 'cac';
import type {Input} from './run.js';

const cli = cac();

cli
  .command(
    'create',
    'Create a graph by querying a IIIF Change Discovery endpoint'
  )
  .option('--resource-dir <string>', 'Directory for storing RDF resources')
  .option('--data-file <string>', 'File with data')
  .option(
    '--iterate-endpoint-url <string>',
    'IIIF Change Discovery endpoint URL'
  )
  .option(
    '--iterate-credentials [string]',
    'Credentials: type, username and password'
  )
  .option(
    '--iterate-wait-between-requests [number]',
    'Wait between requests, in milliseconds'
  )
  .option(
    '--dereference-credentials [string]',
    'Credentials: type, username and password'
  )
  .option('--dereference-headers [string]', 'Headers for dereferencing IRIs')
  .option(
    '--dereference-wait-between-requests [number]',
    'Wait between requests, in milliseconds'
  )
  .option(
    '--dereference-timeout-per-request [number]',
    'Timeout per request, in milliseconds'
  )
  .option(
    '--dereference-number-of-concurrent-requests [number]',
    'Number of concurrent requests'
  )
  .option(
    '--dereference-batch-size [number]',
    'Number of IRIs from the queue to process. If not set, process the entire queue'
  )
  .option('--triplydb-instance-url <string>', 'TriplyDB instance URL')
  .option('--triplydb-api-token <string>', 'TriplyDB API token')
  .option('--triplydb-account <string>', 'TriplyDB account')
  .option('--triplydb-dataset <string>', 'TriplyDB dataset')
  .option('--triplydb-service <string>', 'TriplyDB service')
  .option(
    '--triplydb-service-templates-file [string]',
    'Templates file for the TriplyDB service'
  )
  .option(
    '--graph-name <string>',
    'Name of the graph to upload the RDF resources to'
  )
  .option('--temp-dir [string]', 'Directory for storing temporary files')
  .action(async (input: Input) => {
    import('./run.js').then(action => action.run(input));
  });

cli.help();
cli.parse();
