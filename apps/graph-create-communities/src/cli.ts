#!/bin/env node

import {cac} from 'cac';
import type {Input} from './run.js';

const cli = cac();

cli
  .command(
    'create',
    'Create a graph by fetching communities from the data source'
  )
  .option('--resource-dir <string>', 'Directory for storing RDF resources')
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
