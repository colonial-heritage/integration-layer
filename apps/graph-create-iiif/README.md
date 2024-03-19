# Graph create IIIF Change Discovery

Creates a graph according to the IIIF Change Discovery protocol

## Testing

### Bodleian Libraries

    ./dist/cli.js create \
      --resource-dir ./tmp/bodleian/resources \
      --data-file ./tmp/bodleian/data.sqlite \
      --iterate-endpoint-url "https://iiif.bodleian.ox.ac.uk/iiif/activity/all-changes" \
      --iterate-wait-between-requests 100 \
      --dereference-wait-between-requests 100 \
      --dereference-timeout-per-request 300000 \
      --dereference-number-of-concurrent-requests 1 \
      --dereference-batch-size 10 \
      --triplydb-instance-url "$TRIPLYDB_INSTANCE_URL" \
      --triplydb-api-token "$TRIPLYDB_API_TOKEN" \
      --triplydb-account "$TRIPLYDB_ACCOUNT_DEVELOPMENT" \
      --triplydb-dataset "$TRIPLYDB_DATASET_KG_DEVELOPMENT" \
      --triplydb-service "kg" \
      --graph-name "https://example.org/bodleian" \
      --temp-dir ./tmp

With additional settings:

    ./dist/cli.js create \
      --resource-dir ./tmp/bodleian/resources \
      --data-file ./tmp/bodleian/data.sqlite \
      --iterate-credentials.type "basic-auth" \
      --iterate-credentials.username "username" \
      --iterate-credentials.password "password" \
      --iterate-endpoint-url "https://iiif.bodleian.ox.ac.uk/iiif/activity/all-changes" \
      --iterate-wait-between-requests 100 \
      --dereference-credentials.type "basic-auth" \
      --dereference-credentials.username "username" \
      --dereference-credentials.password "password" \
      --dereference-headers.accept "application/n-triples" \
      --dereference-wait-between-requests 100 \
      --dereference-timeout-per-request 300000 \
      --dereference-number-of-concurrent-requests 1 \
      --dereference-batch-size 10 \
      --triplydb-instance-url "$TRIPLYDB_INSTANCE_URL" \
      --triplydb-api-token "$TRIPLYDB_API_TOKEN" \
      --triplydb-account "$TRIPLYDB_ACCOUNT_DEVELOPMENT" \
      --triplydb-dataset "$TRIPLYDB_DATASET_KG_DEVELOPMENT" \
      --triplydb-service "kg" \
      --graph-name "https://example.org/bodleian" \
      --temp-dir ./tmp
