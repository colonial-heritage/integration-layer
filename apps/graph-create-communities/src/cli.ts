#!/bin/env node

import {cac} from 'cac';
import type {Input} from './run.js';

const cli = cac();

cli
  .command(
    'create',
    'Create a graph by fetching communities from the data source'
  )
  .option('--file <string>', 'RDF file to upload')
  .option('--graph <string>', 'IRI of the graph')
  .option('--triplydb-instance-url <string>', 'TriplyDB instance URL')
  .option('--triplydb-api-token <string>', 'TriplyDB API token')
  .option('--triplydb-account <string>', 'TriplyDB account')
  .option('--triplydb-dataset <string>', 'TriplyDB dataset')
  .option('--triplydb-service <string>', 'TriplyDB service')
  .option(
    '--triplydb-service-templates-file [string]',
    'Templates file for the TriplyDB service'
  )
  .action(async (input: Input) => {
    import('./run.js').then(action => action.run(input));
  });

cli.help();
cli.parse();
