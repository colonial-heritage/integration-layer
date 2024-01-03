# Graph create GeoNames

Creates or updates a graph by dereferencing GeoNames IRIs

## Testing

### DBpedia - without a 'must run' check

    ./dist/cli.js create \
      --resource-dir ./tmp/geonames/resources \
      --data-file ./tmp/geonames/data.sqlite \
      --iterate-endpoint-url "https://dbpedia.org/sparql" \
      --iterate-locations-query-file ./fixtures/queries/iterate-locations.rq \
      --iterate-countries-query-file ./fixtures/queries/iterate-countries.rq \
      --iterate-wait-between-requests 100 \
      --iterate-timeout-per-request 300000 \
      --iterate-number-of-iris-per-request 10 \
      --dereference-wait-between-requests 100 \
      --dereference-timeout-per-request 300000 \
      --dereference-number-of-concurrent-requests 1 \
      --dereference-batch-size 10 \
      --triplydb-instance-url "$TRIPLYDB_INSTANCE_URL" \
      --triplydb-api-token "$TRIPLYDB_API_TOKEN" \
      --triplydb-account "$TRIPLYDB_ACCOUNT_DEVELOPMENT" \
      --triplydb-dataset "$TRIPLYDB_DATASET_KG_DEVELOPMENT" \
      --triplydb-service-name kg \
      --triplydb-service-type virtuoso \
      --graph-name "https://example.org/geonames" \
      --temp-dir ./tmp

### DBpedia - with a 'must run continue' check

    ./dist/cli.js create \
      --resource-dir ./tmp/geonames/resources \
      --data-file ./tmp/geonames/data.sqlite \
      --check-endpoint-url "https://dbpedia.org/sparql" \
      --check-if-run-must-continue-query-file ./fixtures/queries/check-must-continue-run-dbpedia.rq \
      --check-if-run-must-continue-timeout 300000 \
      --iterate-endpoint-url "https://dbpedia.org/sparql" \
      --iterate-locations-query-file ./fixtures/queries/iterate-locations.rq \
      --iterate-countries-query-file ./fixtures/queries/iterate-countries.rq \
      --iterate-wait-between-requests 100 \
      --iterate-timeout-per-request 300000 \
      --iterate-number-of-iris-per-request 10 \
      --dereference-wait-between-requests 100 \
      --dereference-timeout-per-request 300000 \
      --dereference-number-of-concurrent-requests 1 \
      --dereference-batch-size 10 \
      --triplydb-instance-url "$TRIPLYDB_INSTANCE_URL" \
      --triplydb-api-token "$TRIPLYDB_API_TOKEN" \
      --triplydb-account "$TRIPLYDB_ACCOUNT_DEVELOPMENT" \
      --triplydb-dataset "$TRIPLYDB_DATASET_KG_DEVELOPMENT" \
      --triplydb-service-name kg \
      --triplydb-service-type virtuoso \
      --graph-name "https://example.org/geonames" \
      --temp-dir ./tmp
