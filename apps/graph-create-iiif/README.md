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
      --dereference-batch-size 10
