# Data Registry

Creates or updates graphs by uploading RDF files in the Data Registry to the data platform

## Testing

### Upload all RDF files to the data platform

    ./dist/cli.js upload \
      --glob-pattern "fixtures/**/*.ttl" \
      --graph-base-iri "http://example.org" \
      --triplydb-instance-url "$TRIPLYDB_INSTANCE_URL" \
      --triplydb-api-token "$TRIPLYDB_API_TOKEN" \
      --triplydb-account "$TRIPLYDB_ACCOUNT_DEVELOPMENT" \
      --triplydb-dataset "$TRIPLYDB_DATASET_KG_DEVELOPMENT" \
      --triplydb-service-name kg \
      --triplydb-service-type virtuoso

### Upload a specific RDF file to the data platform

    ./dist/cli.js upload \
      --glob-pattern "fixtures/1.ttl" \
      --graph-base-iri "http://example.org" \
      --triplydb-instance-url "$TRIPLYDB_INSTANCE_URL" \
      --triplydb-api-token "$TRIPLYDB_API_TOKEN" \
      --triplydb-account "$TRIPLYDB_ACCOUNT_DEVELOPMENT" \
      --triplydb-dataset "$TRIPLYDB_DATASET_KG_DEVELOPMENT" \
      --triplydb-service-name kg \
      --triplydb-service-type virtuoso
