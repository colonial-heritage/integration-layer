#!/bin/env node

import {cac} from 'cac';
import type {Input} from './run.js';

const cli = cac();

cli
  .command('create', 'Create or update a graph by dereferencing GeoNames IRIs')
  .option('--resource-dir <string>', 'Directory for storing RDF resources')
  .option('--data-file <string>', 'File with data')
  .option('--check-endpoint-url <string>', 'SPARQL endpoint URL')
  .option(
    '--check-if-run-must-continue-query-file <string>',
    'File with a SPARQL query'
  )
  .option(
    '--check-if-run-must-continue-timeout [number]',
    'Timeout, in milliseconds'
  )
  .option('--iterate-endpoint-url <string>', 'SPARQL endpoint URL')
  .option(
    '--iterate-locations-query-file <string>',
    'File with a SPARQL query for collecting locations'
  )
  .option(
    '--iterate-countries-query-file <string>',
    'File with a SPARQL query for collecting countries'
  )
  .option(
    '--iterate-wait-between-requests [number]',
    'Wait between requests, in milliseconds'
  )
  .option(
    '--iterate-timeout-per-request [number]',
    'Timeout per request, in milliseconds'
  )
  .option(
    '--iterate-number-of-iris-per-request [number]',
    'Number of IRIs to collect per request'
  )
  .option(
    '--dereference.credentials [string]',
    'Credentials: type, username and password'
  )
  .option('--dereference.headers [string]', 'Headers for dereferencing IRIs')
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
    'Number of IRIs from the queue to process'
  )
  .option('--triplydb-instance-url <string>', 'TriplyDB instance URL')
  .option('--triplydb-api-token <string>', 'TriplyDB API token')
  .option('--triplydb-account <string>', 'TriplyDB account')
  .option('--triplydb-dataset <string>', 'TriplyDB dataset')
  .option('--triplydb-service-name <string>', 'TriplyDB service name')
  .option('--triplydb-service-type <string>', 'TriplyDB service type')
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
