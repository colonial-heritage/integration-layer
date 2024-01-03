# TriplyDB

Helper functions for working with TriplyDB, the data platform used by Colonial Collections

## Custom mappings for Elasticsearch

At this moment TriplyDB always indexes fields with datatype "text", even if the RDF source data is of datatype "xsd:date" or "xsd:integer". This leads to strange results when searching for and ordering dates and numbers. To resolve this a custom mapping has to be provided when creating an Elastic service:

```bash
curl -H "Authorization: Bearer $TRIPLYDB_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @data/search-graph-mappings.json \
  -X POST "$TRIPLYDB_SERVICES_ENDPOINT"
```

Where `$TRIPLYDB_SERVICES_ENDPOINT` can be:

1. Development: https://data.colonialcollections.nl/_api/datasets/data-hub-development/search-graph/services/
1. Testing: https://data.colonialcollections.nl/_api/datasets/data-hub-testing/search-graph/services/
1. Production: https://data.colonialcollections.nl/_api/datasets/data-hub/search-graph/services/
