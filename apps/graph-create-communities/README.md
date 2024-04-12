# Graph create: communities

Creates a graph by fetching community information from its data source (currently: Clerk), transforming it into RDF and uploading it to the data platform

## Testing

    ./dist/cli.js create \
      --file "./tmp/communities.nt" \
      --graph "http://example.org/communities" \
      --triplydb-instance-url "$TRIPLYDB_INSTANCE_URL" \
      --triplydb-api-token "$TRIPLYDB_API_TOKEN" \
      --triplydb-account "$TRIPLYDB_ACCOUNT_DEVELOPMENT" \
      --triplydb-dataset "$TRIPLYDB_DATASET_KG_DEVELOPMENT" \
      --triplydb-service "kg"
